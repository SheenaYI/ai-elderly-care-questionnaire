import { describe, it, expect } from "vitest";
import {
  createSurvey,
  randomPlans,
  saveSurvey,
  restoreSurvey,
  profileDescription,
  type SurveyV23,
} from "../src/features/surveyV23/model";
import { BACKGROUND, ITEM_IDS, TASKS } from "../src/features/surveyV23/content";
import { completeV23 } from "./v23Fixtures";
import { v23SubmissionSchema } from "../src/features/surveyV23/validation";
import {
  exportV23,
  v23Stats,
  type V23Row,
} from "../src/features/surveyV23/analysis";
import { PROFILES } from "../src/data/profiles";

function row(d: SurveyV23): V23Row {
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

describe("V2.3 原文与研究编码", () => {
  it("八配置编码与已批准任务配对逐一吻合", () => {
    expect(
      Object.values(PROFILES).map((p) => `${p.id}:${p.X1}${p.X2}${p.X3}`),
    ).toEqual([
      "C1:000",
      "C2:001",
      "C3:011",
      "C4:100",
      "C5:101",
      "C6:010",
      "C7:110",
      "C8:111",
    ]);
    expect(
      Object.entries(TASKS)
        .map(([id, t]) => `${t.split}:${id}:${t.A}:${t.B}`)
        .sort(),
    ).toEqual([
      "A:T01:C1:C3",
      "A:T02:C5:C6",
      "A:T07:C3:C5",
      "A:T08:C3:C7",
      "B:T04:C2:C4",
      "B:T05:C2:C6",
      "B:T06:C2:C8",
      "B:T10:C3:C4",
    ]);
  });
  it("正式题号小写且居住与关系选项使用修订表述", () => {
    expect(BACKGROUND.elder.find((q) => q.id === "a2")!.options).toContain(
      "和其他家庭成员一起住",
    );
    expect(BACKGROUND.caregiver.find((q) => q.id === "b2")!.options).toContain(
      "其他家庭成员",
    );
    expect(ITEM_IDS).toHaveLength(8);
    expect(BACKGROUND.caregiver.find((q) => q.id === "b4")?.options).toEqual([
      "独居",
      "与您同住",
      "与伴侣居住",
      "和其他家庭成员居住",
    ]);
    expect(profileDescription("C4")).toBe(
      "接收者还可以查看与事件相关的详细记录（异常前后的活动记录或视频）；信息只发给指定的子女；设备平时只做基础判断，出现异常时才开始详细监测与记录。",
    );
  });
  it("两分卷差分矩阵秩均为3", () => {
    for (const split of ["A", "B"]) {
      const matrix = Object.values(TASKS)
        .filter((t) => t.split === split)
        .map((t) =>
          (["X1", "X2", "X3"] as const).map(
            (k) => PROFILES[t.B][k] - PROFILES[t.A][k],
          ),
        );
      let rank = 0;
      for (let col = 0; col < 3; col++) {
        const pivot = matrix.findIndex(
          (r, i) => i >= rank && Math.abs(r[col]!) > 0.001,
        );
        if (pivot < 0) continue;
        [matrix[pivot], matrix[rank]] = [matrix[rank]!, matrix[pivot]!];
        const p = matrix[rank]!,
          scale = p[col]!;
        for (let j = col; j < 3; j++) p[j] = p[j]! / scale;
        matrix.forEach((r, i) => {
          if (i !== rank) {
            const f = r[col]!;
            for (let j = col; j < 3; j++) r[j] = r[j]! - f * p[j]!;
          }
        });
        rank++;
      }
      expect(rank).toBe(3);
    }
  });
});

describe("V2.3 随机计划及恢复", () => {
  it("旧草稿留在原键，不恢复为新修订", () => {
    const legacy = completeV23("caregiver");
    delete legacy.instrument_revision;
    localStorage.setItem("aiecq:V2.3:caregiver:test", JSON.stringify(legacy));
    expect(restoreSurvey("caregiver", "test")).toBeNull();
    expect(
      JSON.parse(localStorage.getItem("aiecq:V2.3:caregiver:test")!),
    ).toEqual(legacy);
  });
  it("200份随机计划每卷恰好4题、两个不重复配置；覆盖两卷与左右交换", () => {
    const splits = new Set(),
      positions = new Set();
    for (let i = 0; i < 200; i++) {
      const p = randomPlans(`sample-${i}`, "caregiver");
      splits.add(p.split_version);
      expect(p.dce_plan).toHaveLength(4);
      expect(new Set(p.rating_plan).size).toBe(2);
      p.dce_plan.forEach((t) => {
        expect(TASKS[t.task_id].split).toBe(p.split_version);
        positions.add(
          t.left_configuration_id === TASKS[t.task_id].A
            ? "original"
            : "swapped",
        );
      });
      expect(p).toEqual(randomPlans(`sample-${i}`, "caregiver"));
    }
    expect([...splits].sort()).toEqual(["A", "B"]);
    expect(positions.size).toBe(2);
  });
  it("老人无DCE分卷，授权固定为100自行/授权→110自行/授权→111自行/授权", () => {
    const d = createSurvey("elder");
    expect(d.split_version).toBeNull();
    expect(d.dce_plan).toHaveLength(0);
    expect(d.autonomy_plan).toHaveLength(6);
    expect(d.autonomy_plan.map((p) => p.scenario_id)).toEqual([
      "C4_self",
      "C4_children",
      "C7_self",
      "C7_children",
      "C8_self",
      "C8_children",
    ]);
    for (const id of ["C4", "C7", "C8"])
      expect(
        d.autonomy_plan
          .filter((p) => p.configuration_id === id)
          .map((p) => p.authorization_condition)
          .sort(),
      ).toEqual(["children", "self"]);
  });
  it("刷新恢复保存答案与计划且双入口/样本渠道隔离", () => {
    const d = completeV23("caregiver");
    saveSurvey(d);
    expect(restoreSurvey("caregiver", "test")).toEqual(d);
    expect(restoreSurvey("elder", "test")).toBeNull();
    expect(restoreSurvey("caregiver", "formal")).toBeNull();
  });
});

describe("V2.3 双端完整性校验", () => {
  it("老人100分模式不再要求排序", () => {
    const d = completeV23("elder");
    d.weight_allocation.ranking = [];
    expect(v23SubmissionSchema.safeParse(d).success).toBe(true);
  });
  it("旧答卷随机计划与b4含义保留，不标为新修订", () => {
    const d = completeV23("elder");
    delete d.instrument_revision;
    d.autonomy_plan = randomPlans(
      d.participant_id,
      "elder",
      "legacy",
    ).autonomy_plan;
    d.autonomy_choices = d.autonomy_plan.map((p) => ({
      ...p,
      choice: "indifferent",
    }));
    expect(v23SubmissionSchema.safeParse(d).success).toBe(true);
    const c = completeV23("caregiver");
    c.answers.b4 = 2;
    const old = structuredClone(c);
    delete old.instrument_revision;
    for (const [draft, label] of [
      [c, "与伴侣居住"],
      [old, "轮流居住"],
    ] as const) {
      const exported = exportV23([row(draft)], "v23_answers");
      const answer = exported.rows.find(
        (r) => r[exported.columns.indexOf("question_id")] === "b4",
      )!;
      expect(answer[exported.columns.indexOf("answer_label")]).toBe(label);
    }
  });
  it.each(["elder", "caregiver"] as const)("%s 完整答卷通过校验", (type) =>
    expect(v23SubmissionSchema.safeParse(completeV23(type)).success).toBe(true),
  );
  it("拒绝无照护经历、不足4题、位置/配置篡改和分卷改变", () => {
    for (const mutate of [
      (d: SurveyV23) => {
        d.answers.b0 = 1;
      },
      (d: SurveyV23) => {
        d.dce_choices.pop();
      },
      (d: SurveyV23) => {
        d.dce_choices[0]!.selected_configuration_id =
          d.dce_choices[0]!.right_configuration_id;
      },
      (d: SurveyV23) => {
        d.split_version = d.split_version === "A" ? "B" : "A";
      },
    ]) {
      const d = completeV23("caregiver");
      mutate(d);
      expect(v23SubmissionSchema.safeParse(d).success).toBe(false);
    }
  });
  it("拒绝分数空值、负数、总分不为100", () => {
    for (const value of [null, -1, 49]) {
      const d = completeV23("elder");
      d.weight_allocation.scores.security = value;
      expect(v23SubmissionSchema.safeParse(d).success).toBe(false);
    }
  });
  it("仅老人允许仅排序且分数必须为空，不能填0代替缺失", () => {
    const d = completeV23("elder");
    d.answers.a11 = "ranking_only";
    d.weight_allocation.mode = "ranking_only";
    d.weight_allocation.scores = {
      security: null,
      privacy: null,
      autonomy: null,
    };
    expect(v23SubmissionSchema.safeParse(d).success).toBe(true);
    d.weight_allocation.scores.security = 0;
    expect(v23SubmissionSchema.safeParse(d).success).toBe(false);
  });
  it("三档仅0/50/100；必须保留6个配对且不得合并都可以", () => {
    const d = completeV23("elder");
    expect(d.autonomy_choices.every((c) => c.choice === "indifferent")).toBe(
      true,
    );
    d.elder_preferences.X1 = 25 as 0;
    expect(v23SubmissionSchema.safeParse(d).success).toBe(false);
    d.elder_preferences.X1 = 0;
    d.autonomy_choices[0]!.authorization_condition =
      d.autonomy_choices[0]!.authorization_condition === "self"
        ? "children"
        : "self";
    expect(v23SubmissionSchema.safeParse(d).success).toBe(false);
  });
  it("拒绝两个相同评价配置、漏项、量表0分和额外旧题", () => {
    for (const change of [
      (d: SurveyV23) => {
        d.profile_ratings[1]!.configuration_id = d.rating_plan[0]!;
      },
      (d: SurveyV23) => {
        delete d.profile_ratings[0]!.scores.p1;
      },
      (d: SurveyV23) => {
        d.profile_ratings[0]!.scores.p1 = 0;
      },
      (d: SurveyV23) => {
        d.answers.Q8 = 4;
      },
    ]) {
      const d = completeV23("elder");
      change(d);
      expect(v23SubmissionSchema.safeParse(d).success).toBe(false);
    }
  });
  it("保留理解检查首次错误，重答后可继续；首次正确标记不得伪造", () => {
    const d = completeV23("elder");
    d.comprehension[0] = {
      question_id: "a7",
      first_answer: 1,
      first_correct: false,
      final_answer: 0,
      retry_count: 1,
    };
    expect(v23SubmissionSchema.safeParse(d).success).toBe(true);
    d.comprehension[0]!.first_correct = true;
    expect(v23SubmissionSchema.safeParse(d).success).toBe(false);
  });
  it("注意力核对失败仍完整保存；最多两个担忧，其他不得混淆", () => {
    const d = completeV23("elder");
    d.answers["a-check"] = 3;
    expect(v23SubmissionSchema.safeParse(d).success).toBe(true);
    d.answers.a10 = ["0", "1", "2"];
    expect(v23SubmissionSchema.safeParse(d).success).toBe(false);
  });
});

describe("V2.3 统计导出", () => {
  it("分开统计受访者、分卷、注意力、都可以与仅排序", () => {
    const a = completeV23("elder"),
      b = completeV23("caregiver");
    a.answers["a-check"] = 1;
    const stats = v23Stats([row(a), row(b)]);
    expect(stats.total).toBe(2);
    expect(stats.elder).toBe(1);
    expect(stats.caregiver).toBe(1);
    expect(stats.splits.reduce((s, b) => s + b.count, 0)).toBe(1);
    expect(stats.attentionFailed).toBe(1);
    expect(stats.autonomy.reduce((s, c) => s + c.indifferent, 0)).toBe(6);
  });
  it("每配置每item分开导出；DCE两行长表每题恰好一个chosen", () => {
    const d = completeV23("caregiver"),
      rows = [row(d)];
    expect(exportV23(rows, "v23_ratings").rows).toHaveLength(16);
    const data = exportV23(rows, "v23_long");
    expect(data.rows).toHaveLength(8);
    const chosen = data.columns.indexOf("chosen");
    expect(
      data.rows.reduce<number>((sum, r) => sum + Number(r[chosen]), 0),
    ).toBe(4);
    const raw = exportV23(rows, "v23_raw");
    expect(
      JSON.parse(String(raw.rows[0]![raw.columns.indexOf("payload")])),
    ).toEqual(d);
  });
});
