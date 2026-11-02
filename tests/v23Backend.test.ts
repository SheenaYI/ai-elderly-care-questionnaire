import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { completeV23 } from "./v23Fixtures";
import type { V23Row } from "../src/features/surveyV23/analysis";

const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  active: true,
  admin: true,
  tokenValid: true,
  rows: [] as V23Row[],
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async () =>
        mock.tokenValid
          ? {
              data: { user: { email: "researcher@example.test" } },
              error: null,
            }
          : { data: { user: null }, error: { code: "bad_token" } },
    },
    rpc: (...args: unknown[]) => {
      if (args[0] === "is_research_admin_email")
        return Promise.resolve({ data: mock.admin, error: null });
      return mock.rpc(...args);
    },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({
          data:
            table === "questionnaire_versions"
              ? { id: "V2.3", is_active: mock.active }
              : null,
          error: null,
        }),
        range: async (from: number, to: number) => ({
          data: mock.rows.slice(from, to + 1),
          error: null,
        }),
      };
      return query;
    },
  }),
}));
import submit, {
  __resetRateLimiterForTests,
} from "../netlify/functions/submit-survey";
import exportHandler from "../netlify/functions/admin-export";

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-only-key");
  mock.rpc.mockReset().mockResolvedValue({ error: null });
  mock.active = true;
  mock.admin = true;
  mock.tokenValid = true;
  mock.rows = [];
  __resetRateLimiterForTests();
});
afterEach(() => vi.unstubAllEnvs());
describe("V2.3 Netlify提交边界（内存替身，不访问正式库）", () => {
  it.each(["elder", "caregiver"] as const)(
    "%s 通过既有安全接口调用新RPC并保留完整载荷",
    async (type) => {
      const d = completeV23(type);
      const response = await submit(
        new Request("http://localhost/api/submit-survey", {
          method: "POST",
          body: JSON.stringify(d),
        }),
      );
      expect(response.status).toBe(200);
      expect(mock.rpc).toHaveBeenCalledWith("submit_survey_v23", {
        payload: d,
      });
      expect(await response.text()).not.toContain("test-server-only-key");
    },
  );
  it("缺失评价、无资格、无效总分和篡改配对在写入前被拒绝", async () => {
    for (const mutate of [
      (d: ReturnType<typeof completeV23>) => {
        d.answers.b0 = 1;
      },
      (d: ReturnType<typeof completeV23>) => {
        d.weight_allocation.scores.security = 51;
      },
      (d: ReturnType<typeof completeV23>) => {
        d.profile_ratings.pop();
      },
      (d: ReturnType<typeof completeV23>) => {
        d.dce_choices[0]!.scheme_a_configuration_id = "C8";
      },
    ]) {
      const d = completeV23("caregiver");
      mutate(d);
      const r = await submit(
        new Request("http://localhost/api/submit-survey", {
          method: "POST",
          body: JSON.stringify(d),
        }),
      );
      expect(r.status).toBe(400);
    }
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("版本未启用不写入", async () => {
    mock.active = false;
    const r = await submit(
      new Request("http://localhost/api/submit-survey", {
        method: "POST",
        body: JSON.stringify(completeV23("elder")),
      }),
    );
    expect(r.status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("RPC重复答卷返回409，数据库失败不伪装成功", async () => {
    mock.rpc.mockResolvedValue({ error: { code: "23505" } });
    const r = await submit(
      new Request("http://localhost/api/submit-survey", {
        method: "POST",
        body: JSON.stringify(completeV23("elder")),
      }),
    );
    expect(r.status).toBe(409);
    expect((await r.json()).ok).toBe(false);
  });
  it("无服务端配置时503，草稿不会被当作已保存", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const r = await submit(
      new Request("http://localhost/api/submit-survey", {
        method: "POST",
        body: JSON.stringify(completeV23("elder")),
      }),
    );
    expect(r.status).toBe(503);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});

describe("V2.3导出保持现有真实鉴权与白名单", () => {
  it("未登录401；非白名单403", async () => {
    const url = "http://localhost/api/admin/export?dataset=v23_raw";
    expect((await exportHandler(new Request(url))).status).toBe(401);
    mock.admin = false;
    expect(
      (
        await exportHandler(
          new Request(url, {
            headers: { Authorization: "Bearer signed-test-token" },
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("按类型与样本渠道筛选，完整原始JSON和结构化编码可导出", async () => {
    const d = completeV23("elder");
    mock.rows = [
      {
        participant_id: d.participant_id,
        survey_version: "V2.3",
        respondent_type: "elder",
        sample_channel: "test",
        split_version: null,
        submitted_at: d.submitted_at!,
        payload: d,
      },
    ];
    const r = await exportHandler(
      new Request(
        "http://localhost/api/admin/export?dataset=v23_raw&sample_channel=test&respondent_type=elder",
        { headers: { Authorization: "Bearer signed-test-token" } },
      ),
    );
    expect(r.status).toBe(200);
    const csv = await r.text();
    expect(csv).toContain("elder_preferences");
    expect(csv).toContain("V2.3");
    const formal = await exportHandler(
      new Request("http://localhost/api/admin/export?dataset=v23_raw", {
        headers: { Authorization: "Bearer signed-test-token" },
      }),
    );
    expect(await formal.text()).not.toContain(d.participant_id);
  });
});
