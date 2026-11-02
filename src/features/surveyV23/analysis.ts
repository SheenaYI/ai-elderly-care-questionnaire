import {
  BACKGROUND,
  CHECKS,
  ITEM_IDS,
  TASKS,
  WEIGHT_KEYS,
  type RespondentType,
} from "./content";
import { PROFILES, PROFILE_IDS } from "../../data/profiles";
import type { SurveyV23 } from "./model";

export interface V23Row {
  participant_id: string;
  survey_version: string;
  respondent_type: RespondentType;
  sample_channel: SurveyV23["sample_channel"];
  split_version: "A" | "B" | null;
  submitted_at: string;
  payload: SurveyV23;
}
export type V23Dataset =
  | "v23_raw"
  | "v23_answers"
  | "v23_dce"
  | "v23_ratings"
  | "v23_autonomy"
  | "v23_weights"
  | "v23_preferences"
  | "v23_long";
export const V23_DATASETS: V23Dataset[] = [
  "v23_raw",
  "v23_answers",
  "v23_dce",
  "v23_ratings",
  "v23_autonomy",
  "v23_weights",
  "v23_preferences",
  "v23_long",
];
type FlatRow = Record<string, unknown>;
const baseColumns = [
  "participant_id",
  "survey_version",
  "instrument_revision",
  "respondent_type",
  "sample_channel",
  "split_version",
  "submitted_at",
];
const columns: Record<V23Dataset, string[]> = {
  v23_raw: [...baseColumns, "started_at", "payload"],
  v23_answers: [
    ...baseColumns,
    "question_id",
    "answer",
    "answer_label",
    "first_answer",
    "first_correct",
    "retry_count",
    "care_years",
  ],
  v23_dce: [
    ...baseColumns,
    "task_id",
    "display_order",
    "scheme_a_configuration_id",
    "scheme_b_configuration_id",
    "left_configuration_id",
    "right_configuration_id",
    "selected_side",
    "selected_configuration_id",
    "response_duration_ms",
  ],
  v23_ratings: [
    ...baseColumns,
    "configuration_id",
    "x1",
    "x2",
    "x3",
    "rating_order",
    "wording_version",
    "item_id",
    "score",
  ],
  v23_autonomy: [
    ...baseColumns,
    "scenario_id",
    "configuration_id",
    "attribute_id",
    "authorization_condition",
    "display_order",
    "choice",
  ],
  v23_weights: [
    ...baseColumns,
    "question_id",
    "mode",
    "security",
    "privacy",
    "autonomy",
    "sum_valid",
    "ranking",
    "attention_question_id",
    "attention_answer",
    "attention_passed",
  ],
  v23_preferences: [...baseColumns, "x1_choice", "x2_choice", "x3_choice"],
  v23_long: [
    ...baseColumns,
    "task_id",
    "display_order",
    "alternative_position",
    "configuration_id",
    "canonical_scheme",
    "x1",
    "x2",
    "x3",
    "chosen",
    "response_duration_ms",
  ],
};
export function exportV23(rows: V23Row[], dataset: V23Dataset) {
  const output: FlatRow[] = [];
  for (const row of rows) {
    const d = row.payload,
      prefix = d.respondent_type === "elder" ? "a" : "b";
    const base = Object.fromEntries(
      baseColumns.map((k) => [
        k,
        k === "instrument_revision"
          ? (d.instrument_revision ?? "legacy")
          : row[k as keyof V23Row],
      ]),
    );
    const push = (fields: FlatRow) => output.push({ ...base, ...fields });
    if (dataset === "v23_raw") push({ started_at: d.started_at, payload: d });
    if (dataset === "v23_answers") {
      for (const [question_id, answer] of Object.entries(d.answers))
        push({
          question_id,
          answer,
          answer_label:
            question_id === "b4" && typeof answer === "number"
              ? ((d.instrument_revision
                  ? ["独居", "与您同住", "与伴侣居住", "和其他家庭成员居住"]
                  : ["独居", "与您同住", "轮流居住", "住在养老机构"])[answer] ??
                null)
              : null,
          care_years: question_id === "b3" ? d.care_years : null,
        });
      for (const c of d.comprehension)
        push({
          question_id: c.question_id,
          answer: c.final_answer,
          first_answer: c.first_answer,
          first_correct: c.first_correct,
          retry_count: c.retry_count,
        });
    }
    if (dataset === "v23_dce") d.dce_choices.forEach((c) => push({ ...c }));
    if (dataset === "v23_ratings")
      d.profile_ratings.forEach((r) =>
        ITEM_IDS.forEach((item_id) => {
          const p = PROFILES[r.configuration_id];
          push({
            configuration_id: r.configuration_id,
            x1: p.X1,
            x2: p.X2,
            x3: p.X3,
            rating_order: r.rating_order,
            wording_version: r.wording_version,
            item_id,
            score: r.scores[item_id] ?? null,
          });
        }),
      );
    if (dataset === "v23_autonomy")
      d.autonomy_choices.forEach((c) => push({ ...c }));
    if (dataset === "v23_weights")
      push({
        question_id: `${prefix}11`,
        mode: d.weight_allocation.mode,
        ...d.weight_allocation.scores,
        sum_valid:
          d.weight_allocation.mode === "ranking_only"
            ? null
            : WEIGHT_KEYS.every(
                (k) => d.weight_allocation.scores[k] !== null,
              ) &&
              WEIGHT_KEYS.reduce(
                (s, k) => s + (d.weight_allocation.scores[k] ?? 0),
                0,
              ) === 100,
        ranking: d.weight_allocation.ranking,
        attention_question_id: `${prefix}-check`,
        attention_answer: d.answers[`${prefix}-check`] ?? null,
        attention_passed: d.answers[`${prefix}-check`] === 2,
      });
    if (dataset === "v23_preferences" && d.respondent_type === "elder")
      push({
        x1_choice: d.elder_preferences.X1 ?? null,
        x2_choice: d.elder_preferences.X2 ?? null,
        x3_choice: d.elder_preferences.X3 ?? null,
      });
    if (dataset === "v23_long")
      d.dce_choices.forEach((c) => {
        for (const alternative_position of ["left", "right"] as const) {
          const configuration_id =
              alternative_position === "left"
                ? c.left_configuration_id
                : c.right_configuration_id,
            p = PROFILES[configuration_id];
          push({
            task_id: c.task_id,
            display_order: c.display_order,
            alternative_position,
            configuration_id,
            canonical_scheme:
              TASKS[c.task_id].A === configuration_id ? "A" : "B",
            x1: p.X1,
            x2: p.X2,
            x3: p.X3,
            chosen: c.selected_configuration_id === configuration_id ? 1 : 0,
            response_duration_ms: c.response_duration_ms,
          });
        }
      });
  }
  return {
    columns: columns[dataset],
    rows: output.map((row) =>
      columns[dataset].map((k) => {
        const value = row[k];
        return value !== null && typeof value === "object"
          ? JSON.stringify(value)
          : (value ?? null);
      }),
    ),
  };
}

export function v23Stats(rows: V23Row[]) {
  const surveys = rows.map((r) => r.payload),
    avg = (values: number[]) =>
      values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  return {
    total: rows.length,
    elder: rows.filter((r) => r.respondent_type === "elder").length,
    caregiver: rows.filter((r) => r.respondent_type === "caregiver").length,
    splits: (["A", "B"] as const).map((split) => ({
      split,
      count: rows.filter(
        (r) => r.respondent_type === "caregiver" && r.split_version === split,
      ).length,
    })),
    tasks: Object.keys(TASKS).map((task_id) => {
      const choices = surveys
        .flatMap((s) => s.dce_choices)
        .filter((c) => c.task_id === task_id);
      return {
        task_id,
        n: choices.length,
        canonical_a: choices.filter(
          (c) => c.selected_configuration_id === c.scheme_a_configuration_id,
        ).length,
        canonical_b: choices.filter(
          (c) => c.selected_configuration_id === c.scheme_b_configuration_id,
        ).length,
        left: choices.filter((c) => c.selected_side === "left").length,
      };
    }),
    completion: (["elder", "caregiver"] as const).flatMap((type) =>
      [
        ...BACKGROUND[type].map((q) => q.id),
        ...CHECKS[type].map((q) => q.id),
        `${type === "elder" ? "a" : "b"}9`,
        `${type === "elder" ? "a" : "b"}10`,
        `${type === "elder" ? "a" : "b"}11`,
        `${type === "elder" ? "a" : "b"}-check`,
        `${type === "elder" ? "a" : "b"}12`,
      ].map((question_id) => ({
        question_id,
        n: surveys.filter(
          (d) =>
            d.respondent_type === type &&
            (question_id.endsWith("7") || question_id.endsWith("8")
              ? d.comprehension.some((c) => c.question_id === question_id)
              : d.answers[question_id] !== undefined &&
                d.answers[question_id] !== ""),
        ).length,
      })),
    ),
    ratings: PROFILE_IDS.map((id) => {
      const ratings = surveys
        .flatMap((s) => s.profile_ratings)
        .filter((r) => r.configuration_id === id);
      return {
        id,
        n: ratings.length,
        means: ITEM_IDS.map((item) => ({
          item,
          mean: avg(
            ratings
              .map((r) => r.scores[item])
              .filter((v): v is number => typeof v === "number"),
          ),
        })),
      };
    }),
    autonomy: [
      "C4_self",
      "C4_children",
      "C7_self",
      "C7_children",
      "C8_self",
      "C8_children",
    ].map((scenario_id) => {
      const choices = surveys
        .flatMap((d) => d.autonomy_choices)
        .filter((c) => c.scenario_id === scenario_id);
      return {
        scenario_id,
        willing: choices.filter((c) => c.choice === "willing").length,
        unwilling: choices.filter((c) => c.choice === "unwilling").length,
        indifferent: choices.filter((c) => c.choice === "indifferent").length,
      };
    }),
    weights: WEIGHT_KEYS.map((key) => ({
      key,
      mean: avg(
        surveys
          .filter((d) => d.weight_allocation.mode === "scores")
          .map((d) => d.weight_allocation.scores[key])
          .filter((v): v is number => typeof v === "number"),
      ),
    })),
    rankingOnly: surveys.filter(
      (d) => d.weight_allocation.mode === "ranking_only",
    ).length,
    attentionFailed: surveys.filter(
      (d) =>
        d.answers[d.respondent_type === "elder" ? "a-check" : "b-check"] !== 2,
    ).length,
  };
}
