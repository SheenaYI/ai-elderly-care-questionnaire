import { createRng, shuffle } from "../../lib/randomization";
import { PROFILES, PROFILE_IDS } from "../../data/profiles";
import type { ProfileId, AttributeKey } from "../../types";
import {
  SURVEY_VERSION,
  INSTRUMENT_REVISION,
  TASKS,
  ATTRIBUTE_COPY,
  type V23TaskId,
  type RespondentType,
  type Answer,
  type ItemId,
  type WeightKey,
} from "./content";

export interface TaskPlan {
  task_id: V23TaskId;
  display_order: number;
  scheme_a_configuration_id: ProfileId;
  scheme_b_configuration_id: ProfileId;
  left_configuration_id: ProfileId;
  right_configuration_id: ProfileId;
}
export interface Choice extends TaskPlan {
  selected_side: "left" | "right";
  selected_configuration_id: ProfileId;
  response_duration_ms: number;
}
export interface AutonomyPlan {
  scenario_id: string;
  configuration_id: "C4" | "C7" | "C8";
  attribute_id: AttributeKey;
  authorization_condition: "self" | "children";
  display_order: number;
}
export interface CheckRecord {
  question_id: string;
  first_answer: number;
  first_correct: boolean;
  final_answer: number;
  retry_count: number;
}
export interface SurveyV23 {
  survey_version: typeof SURVEY_VERSION;
  instrument_revision?: typeof INSTRUMENT_REVISION;
  participant_id: string;
  respondent_type: RespondentType;
  sample_channel: "formal" | "pilot" | "test";
  split_version: "A" | "B" | null;
  consent: boolean;
  consent_at: string | null;
  eligible: boolean;
  care_years: number | null;
  started_at: string;
  submitted_at: string | null;
  configuration_snapshot: {
    configuration_id: ProfileId;
    x1: number;
    x2: number;
    x3: number;
  }[];
  answers: Record<string, Answer>;
  comprehension: CheckRecord[];
  dce_plan: TaskPlan[];
  dce_choices: Choice[];
  rating_plan: ProfileId[];
  profile_ratings: {
    configuration_id: ProfileId;
    rating_order: number;
    wording_version: "colloquial" | "standard";
    scores: Partial<Record<ItemId, number>>;
  }[];
  elder_preferences: Partial<Record<AttributeKey, 0 | 50 | 100>>;
  autonomy_plan: AutonomyPlan[];
  autonomy_choices: (AutonomyPlan & {
    choice: "willing" | "unwilling" | "indifferent";
  })[];
  weight_allocation: {
    mode: "scores" | "ranking_only";
    scores: Record<WeightKey, number | null>;
    ranking: WeightKey[];
  };
  simulation_events: {
    configuration_id: ProfileId;
    task_id: string | null;
    event_type: string;
    elapsed_ms: number;
    duration_ms: number | null;
  }[];
  step: number;
  updated_at: string;
}

export function profileDescription(id: ProfileId): string {
  const p = PROFILES[id];
  return (
    (["X1", "X2", "X3"] as const)
      .map((k) => ATTRIBUTE_COPY[k].clauses[p[k]])
      .join("；") + "。"
  );
}

export function randomPlans(
  id: string,
  type: RespondentType,
  revision: string = INSTRUMENT_REVISION,
) {
  const rng = createRng(`${SURVEY_VERSION}:${id}`);
  const split = rng() < 0.5 ? "A" : "B";
  const taskIds = (Object.keys(TASKS) as V23TaskId[]).filter(
    (k) => TASKS[k].split === split,
  );
  const dce_plan: TaskPlan[] =
    type === "caregiver"
      ? shuffle(taskIds, rng).map((task_id, i) => {
          const t = TASKS[task_id],
            swapped = rng() < 0.5;
          return {
            task_id,
            display_order: i + 1,
            scheme_a_configuration_id: t.A,
            scheme_b_configuration_id: t.B,
            left_configuration_id: swapped ? t.B : t.A,
            right_configuration_id: swapped ? t.A : t.B,
          };
        })
      : [];
  const autonomy: AutonomyPlan[] = [];
  if (type === "elder")
    for (const [i, configuration_id] of (
      ["C4", "C7", "C8"] as const
    ).entries()) {
      for (const authorization_condition of ["self", "children"] as const)
        autonomy.push({
          scenario_id: `${configuration_id}_${authorization_condition}`,
          configuration_id,
          attribute_id: (["X1", "X2", "X3"] as const)[i]!,
          authorization_condition,
          display_order: 0,
        });
    }
  return {
    split_version: type === "caregiver" ? split : null,
    dce_plan,
    rating_plan: shuffle(PROFILE_IDS, rng).slice(0, 2),
    autonomy_plan: (revision === INSTRUMENT_REVISION
      ? autonomy
      : shuffle(autonomy, rng)
    ).map((p, i) => ({
      ...p,
      display_order: i + 1,
    })),
  } as const;
}

export function createSurvey(
  type: RespondentType,
  channel: SurveyV23["sample_channel"] = "formal",
  id: string = crypto.randomUUID(),
): SurveyV23 {
  const now = new Date().toISOString(),
    plans = randomPlans(id, type);
  return {
    survey_version: SURVEY_VERSION,
    instrument_revision: INSTRUMENT_REVISION,
    participant_id: id,
    respondent_type: type,
    sample_channel: channel,
    ...plans,
    consent: false,
    consent_at: null,
    eligible: false,
    care_years: null,
    started_at: now,
    submitted_at: null,
    configuration_snapshot: PROFILE_IDS.map((id) => ({
      configuration_id: id,
      x1: PROFILES[id].X1,
      x2: PROFILES[id].X2,
      x3: PROFILES[id].X3,
    })),
    answers: {},
    comprehension: [],
    dce_choices: [],
    elder_preferences: {},
    autonomy_choices: [],
    profile_ratings: plans.rating_plan.map((configuration_id, i) => ({
      configuration_id,
      rating_order: i + 1,
      wording_version: type === "elder" ? "colloquial" : "standard",
      scores: {},
    })),
    weight_allocation: {
      mode: "scores",
      scores: { security: null, privacy: null, autonomy: null },
      ranking: [],
    },
    simulation_events: [],
    step: 0,
    updated_at: now,
  };
}

export function draftKey(
  type: RespondentType,
  channel: SurveyV23["sample_channel"],
) {
  return `aiecq:V2.3:${INSTRUMENT_REVISION}:${type}:${channel}`;
}
export function saveSurvey(d: SurveyV23): boolean {
  try {
    localStorage.setItem(
      draftKey(d.respondent_type, d.sample_channel),
      JSON.stringify(d),
    );
    return true;
  } catch {
    return false;
  }
}
export function restoreSurvey(
  type: RespondentType,
  channel: SurveyV23["sample_channel"],
): SurveyV23 | null {
  try {
    const text = localStorage.getItem(draftKey(type, channel));
    if (!text) return null;
    const d = JSON.parse(text) as SurveyV23;
    return d.survey_version === SURVEY_VERSION &&
      d.instrument_revision === INSTRUMENT_REVISION &&
      d.respondent_type === type &&
      d.sample_channel === channel &&
      Array.isArray(d.dce_plan) &&
      Array.isArray(d.rating_plan) &&
      Array.isArray(d.autonomy_plan)
      ? d
      : null;
  } catch {
    return null;
  }
}

export function autonomyText(p: AutonomyPlan): string {
  const condition =
    p.authorization_condition === "self"
      ? "如果您自己就能改设置、不用问子女"
      : "如果改这个设置前要先征得子女同意";
  const action = {
    X1: "您愿意让家人看到您的详细活动记录或视频吗？",
    X2: "您愿意让签约的养老服务机构（经审核、可上门服务的养老公司）也看到您的信息吗？",
    X3: "您愿意让设备全天不停详细监测记录吗？",
  }[p.attribute_id];
  return `${condition}，${action}`;
}
