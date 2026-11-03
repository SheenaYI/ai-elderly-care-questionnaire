import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminCharts from "../src/features/surveyV23/AdminCharts";
import { v23Stats, type V23Row } from "../src/features/surveyV23/analysis";
import { completeV23 } from "./v23Fixtures";
function row(d: ReturnType<typeof completeV23>): V23Row {
  return {
    participant_id: d.participant_id,
    survey_version: d.survey_version,
    respondent_type: d.respondent_type,
    sample_channel: d.sample_channel,
    split_version: d.split_version,
    submitted_at: d.submitted_at!,
    payload: d,
  };
}
describe("V2.3仪表盘统计口径", () => {
  it("左右交换不影响固定配置的选择分布", () => {
    const d = completeV23("caregiver"),
      c = d.dce_choices[0]!;
    c.selected_configuration_id = c.scheme_a_configuration_id;
    c.left_configuration_id = c.scheme_b_configuration_id;
    c.right_configuration_id = c.scheme_a_configuration_id;
    c.selected_side = "right";
    const result = v23Stats([row(d)]).tasks.find(
      (t) => t.task_id === c.task_id,
    )!;
    expect(result).toMatchObject({
      canonical_a: 1,
      canonical_b: 0,
      left: 0,
      right: 1,
      n: 1,
    });
  });
  it("未评分不填零；仅排序不混入分配均值", () => {
    const d = completeV23("elder");
    d.weight_allocation.mode = "ranking_only";
    d.profile_ratings[0]!.scores.p1 = undefined;
    const s = v23Stats([row(d)]),
      r = s.ratings.find(
        (r) => r.id === d.profile_ratings[0]!.configuration_id,
      )!;
    expect(r.means.find((m) => m.item === "p1")).toMatchObject({
      mean: null,
      n: 0,
    });
    expect(s.weights.every((w) => w.mean === null && w.n === 0)).toBe(true);
    expect(s.rankings.find((r) => r.key === "security")!.first).toBe(1);
  });
  it("旧修订b4不会用新标签解释", () => {
    const d = completeV23("caregiver");
    delete d.instrument_revision;
    d.answers.b4 = 2;
    const q = v23Stats([row(d)]).backgrounds.find((q) => q.id === "b4")!;
    expect(q.options.find((o) => o.label === "轮流居住")!.count).toBe(1);
    expect(q.options.find((o) => o.label === "与伴侣居住")!.count).toBe(0);
  });
  it("空状态完整渲染且没有NaN或伪造均值", () => {
    const html = renderToStaticMarkup(<AdminCharts rows={[]} />);
    expect(html).toContain("暂无已提交答卷");
    expect(html).not.toContain("NaN");
    expect(html).toContain("n=0");
  });
  it("图表含配置编号、原始计数、语义区分及全部板块", () => {
    const html = renderToStaticMarkup(
      <AdminCharts
        rows={[row(completeV23("elder")), row(completeV23("caregiver"))]}
      />,
    );
    for (const text of [
      "配置 C1",
      "展示位置检查（非配置偏好）",
      "感知评价",
      "老人自主授权情景",
      "100 分权重分配",
      "老人三档偏好",
      "受访者基本情况",
      "各题完成情况",
    ])
      expect(html).toContain(text);
  });
});
