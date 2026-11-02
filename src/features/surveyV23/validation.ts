import { z } from "zod";
import {
  BACKGROUND,
  CHECKS,
  SURVEY_VERSION,
  INSTRUMENT_REVISION,
  ITEM_IDS,
  WEIGHT_KEYS,
} from "./content";
import { randomPlans, type SurveyV23 } from "./model";
import { PROFILES, PROFILE_IDS } from "../../data/profiles";

const profile = z.enum(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]);
const attribute = z.enum(["X1", "X2", "X3"]);
const task = z.enum(["T01", "T02", "T07", "T08", "T04", "T05", "T06", "T10"]);
const order = z.number().int().min(1).max(6);
const score = z.number().int().min(1).max(5);
const weightKey = z.enum(WEIGHT_KEYS);
const plan = z
  .object({
    task_id: task,
    display_order: order,
    scheme_a_configuration_id: profile,
    scheme_b_configuration_id: profile,
    left_configuration_id: profile,
    right_configuration_id: profile,
  })
  .strict();
const autonomyPlan = z
  .object({
    scenario_id: z.string().max(30),
    configuration_id: z.enum(["C4", "C7", "C8"]),
    attribute_id: attribute,
    authorization_condition: z.enum(["self", "children"]),
    display_order: order,
  })
  .strict();
const shape = z
  .object({
    survey_version: z.literal(SURVEY_VERSION),
    instrument_revision: z.literal(INSTRUMENT_REVISION).optional(),
    participant_id: z.string().uuid(),
    respondent_type: z.enum(["elder", "caregiver"]),
    sample_channel: z.enum(["formal", "pilot", "test"]),
    split_version: z.enum(["A", "B"]).nullable(),
    consent: z.literal(true),
    consent_at: z.string().datetime(),
    eligible: z.literal(true),
    care_years: z.number().min(0).max(100).nullable(),
    configuration_snapshot: z
      .array(
        z
          .object({
            configuration_id: profile,
            x1: z.number().int().min(0).max(1),
            x2: z.number().int().min(0).max(1),
            x3: z.number().int().min(0).max(1),
          })
          .strict(),
      )
      .length(8),
    started_at: z.string().datetime(),
    submitted_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    answers: z.record(
      z.union([
        z.string().max(2000),
        z.number().int(),
        z.array(z.string()).max(2),
      ]),
    ),
    comprehension: z
      .array(
        z
          .object({
            question_id: z.string(),
            first_answer: z.number().int().min(0).max(2),
            first_correct: z.boolean(),
            final_answer: z.number().int().min(0).max(2),
            retry_count: z.number().int().min(0).max(100),
          })
          .strict(),
      )
      .length(2),
    dce_plan: z.array(plan).max(4),
    dce_choices: z
      .array(
        plan
          .extend({
            selected_side: z.enum(["left", "right"]),
            selected_configuration_id: profile,
            response_duration_ms: z.number().int().min(0).max(86400000),
          })
          .strict(),
      )
      .max(4),
    rating_plan: z.array(profile).length(2),
    profile_ratings: z
      .array(
        z
          .object({
            configuration_id: profile,
            rating_order: z.number().int().min(1).max(2),
            wording_version: z.enum(["standard", "colloquial"]),
            scores: z
              .object({
                s1: score,
                s2: score,
                p1: score,
                p2: score,
                a1: score,
                a2: score,
                i1: score,
                i2: score,
              })
              .strict(),
          })
          .strict(),
      )
      .length(2),
    elder_preferences: z
      .object({
        X1: z.union([z.literal(0), z.literal(50), z.literal(100)]).optional(),
        X2: z.union([z.literal(0), z.literal(50), z.literal(100)]).optional(),
        X3: z.union([z.literal(0), z.literal(50), z.literal(100)]).optional(),
      })
      .strict(),
    autonomy_plan: z.array(autonomyPlan).max(6),
    autonomy_choices: z
      .array(
        autonomyPlan
          .extend({ choice: z.enum(["willing", "unwilling", "indifferent"]) })
          .strict(),
      )
      .max(6),
    weight_allocation: z
      .object({
        mode: z.enum(["scores", "ranking_only"]),
        scores: z
          .object({
            security: z.number().int().min(0).max(100).nullable(),
            privacy: z.number().int().min(0).max(100).nullable(),
            autonomy: z.number().int().min(0).max(100).nullable(),
          })
          .strict(),
        ranking: z.array(weightKey).max(3),
      })
      .strict(),
    simulation_events: z
      .array(
        z
          .object({
            configuration_id: profile,
            task_id: task.nullable(),
            event_type: z.enum([
              "open",
              "close",
              "complete",
              "view_details",
              "replay",
            ]),
            elapsed_ms: z.number().int().min(0),
            duration_ms: z.number().int().min(0).nullable(),
          })
          .strict(),
      )
      .max(500),
    step: z.number().int().min(0).max(6),
  })
  .strict();

export const v23SubmissionSchema = shape.superRefine((d, ctx) => {
  const issue = (path: string, message: string) =>
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: path.split("."),
      message,
    });
  const prefix = d.respondent_type === "elder" ? "a" : "b";
  const expected = randomPlans(
    d.participant_id,
    d.respondent_type,
    d.instrument_revision ?? "legacy",
  );
  if (
    JSON.stringify(d.configuration_snapshot) !==
    JSON.stringify(
      PROFILE_IDS.map((id) => ({
        configuration_id: id,
        x1: PROFILES[id].X1,
        x2: PROFILES[id].X2,
        x3: PROFILES[id].X3,
      })),
    )
  )
    issue("configuration_snapshot", "配置编号与属性快照不一致。");
  for (const key of [
    "split_version",
    "dce_plan",
    "rating_plan",
    "autonomy_plan",
  ] as const) {
    if (JSON.stringify(d[key]) !== JSON.stringify(expected[key]))
      issue(key, "随机计划不匹配，请恢复本份答卷原始计划。");
  }
  const allowed = new Set([
    ...BACKGROUND[d.respondent_type].map((q) => q.id),
    `${prefix}9`,
    `${prefix}10`,
    `${prefix}11`,
    `${prefix}12`,
    `${prefix}-check`,
  ]);
  for (const id of Object.keys(d.answers))
    if (!allowed.has(id)) issue(`answers.${id}`, "未知或非本卷的小写题号。");
  for (const q of BACKGROUND[d.respondent_type]) {
    const answer = d.answers[q.id];
    if (
      typeof answer !== "number" ||
      !Number.isInteger(answer) ||
      answer < 0 ||
      answer >= q.options.length
    )
      issue(`answers.${q.id}`, "请完成本题。");
  }
  if (d.respondent_type === "caregiver" && d.answers.b0 !== 0)
    issue("answers.b0", "仅有实际照护经历的家庭成员可提交。");
  if (
    d.respondent_type === "caregiver" &&
    d.answers.b3 === 3 &&
    d.care_years === null
  )
    issue("care_years", "请填写偶尔帮忙的照护年限。");
  for (const q of CHECKS[d.respondent_type]) {
    const records = d.comprehension.filter((r) => r.question_id === q.id);
    const c = records[0];
    if (
      records.length !== 1 ||
      !c ||
      c.first_correct !== (c.first_answer === q.correct) ||
      c.final_answer !== q.correct ||
      (c.first_answer !== c.final_answer && c.retry_count < 1)
    )
      issue("comprehension", "请完成理解检查；首次答案不得被覆盖。");
  }
  for (const id of [`${prefix}9`, `${prefix}-check`]) {
    const answer = d.answers[id];
    if (typeof answer !== "number" || answer < 1 || answer > 5)
      issue(`answers.${id}`, "请选择一项。");
  }
  const concerns = d.answers[`${prefix}10`];
  if (
    d.answers[`${prefix}12`] !== undefined &&
    typeof d.answers[`${prefix}12`] !== "string"
  )
    issue(`answers.${prefix}12`, "开放题应保存为文本。");
  if (
    !Array.isArray(concerns) ||
    concerns.length < 1 ||
    concerns.length > 2 ||
    new Set(concerns).size !== concerns.length ||
    concerns.some((c) => !["0", "1", "2", "3", "4"].includes(c))
  )
    issue(`answers.${prefix}10`, "请选 1–2 项担忧。");
  const w = d.weight_allocation;
  if (d.answers[`${prefix}11`] !== w.mode)
    issue(`answers.${prefix}11`, "权重题模式与记录不一致。");
  if (w.mode === "ranking_only") {
    if (
      d.respondent_type !== "elder" ||
      WEIGHT_KEYS.some((k) => w.scores[k] !== null)
    )
      issue("weight_allocation", "仅老人版可使用仅排序，分数必须留空。");
  } else if (
    WEIGHT_KEYS.some((k) => w.scores[k] === null) ||
    WEIGHT_KEYS.reduce((sum, k) => sum + (w.scores[k] ?? 0), 0) !== 100
  )
    issue("weight_allocation", "三项必须全部填写，且合计正好 100 分。");
  if (
    (w.mode === "ranking_only" || w.ranking.length > 0) &&
    (w.ranking.length !== 3 || new Set(w.ranking).size !== 3)
  )
    issue("weight_allocation.ranking", "请完成三项重要性排序。");
  if (
    d.respondent_type === "caregiver" &&
    (Object.keys(d.elder_preferences).length || d.autonomy_choices.length)
  )
    issue("elder_preferences", "照护者版不能包含老人版偏好或授权答案。");
  if (
    d.respondent_type === "elder" &&
    (["X1", "X2", "X3"] as const).some(
      (k) => d.elder_preferences[k] === undefined,
    )
  )
    issue("elder_preferences", "请完成三道三档偏好选择。");
  if (d.dce_choices.length !== d.dce_plan.length)
    issue("dce_choices", "请完成本分卷的全部 4 道任务。");
  for (const p of d.dce_plan) {
    const matches = d.dce_choices.filter((c) => c.task_id === p.task_id);
    const c = matches[0];
    if (
      matches.length !== 1 ||
      !c ||
      Object.keys(p).some(
        (k) => c[k as keyof typeof p] !== p[k as keyof typeof p],
      ) ||
      c.selected_configuration_id !==
        (c.selected_side === "left"
          ? p.left_configuration_id
          : p.right_configuration_id)
    )
      issue("dce_choices", "DCE 任务、配置、展示位置或选择不一致。");
  }
  if (d.autonomy_choices.length !== d.autonomy_plan.length)
    issue("autonomy_choices", "请完成 6 道自主授权情景。");
  for (const p of d.autonomy_plan) {
    const rows = d.autonomy_choices.filter(
      (c) => c.scenario_id === p.scenario_id,
    );
    if (
      rows.length !== 1 ||
      Object.keys(p).some(
        (k) => rows[0]?.[k as keyof typeof p] !== p[k as keyof typeof p],
      )
    )
      issue("autonomy_choices", "授权情景或顺序不一致。");
  }
  d.profile_ratings.forEach((r, i) => {
    if (
      r.configuration_id !== d.rating_plan[i] ||
      r.rating_order !== i + 1 ||
      r.wording_version !==
        (d.respondent_type === "elder" ? "colloquial" : "standard") ||
      ITEM_IDS.some((k) => !r.scores[k])
    )
      issue("profile_ratings", "配置评价、题项版本或评价顺序不一致。");
  });
  const duration = Date.parse(d.submitted_at) - Date.parse(d.started_at);
  if (
    Date.parse(d.consent_at) < Date.parse(d.started_at) ||
    Date.parse(d.consent_at) > Date.parse(d.submitted_at)
  )
    issue("consent_at", "知情同意时间不合理。");
  if (duration < 0 || Date.parse(d.submitted_at) > Date.now() + 300000)
    issue("submitted_at", "提交时间不合理。");
});

export function submissionProblems(draft: SurveyV23): string[] {
  const result = v23SubmissionSchema.safeParse({
    ...draft,
    submitted_at: draft.submitted_at ?? new Date().toISOString(),
  });
  return result.success
    ? []
    : [...new Set(result.error.issues.map((i) => i.message))];
}
