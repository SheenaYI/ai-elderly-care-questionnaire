import { createSurvey, type SurveyV23 } from "../src/features/surveyV23/model";
import {
  BACKGROUND,
  CHECKS,
  ITEM_IDS,
} from "../src/features/surveyV23/content";

export function completeV23(
  type: "elder" | "caregiver",
  id?: string,
): SurveyV23 {
  const d = createSurvey(type, "test", id),
    prefix = type === "elder" ? "a" : "b";
  d.consent = true;
  d.consent_at = new Date().toISOString();
  d.eligible = true;
  for (const q of BACKGROUND[type]) d.answers[q.id] = 0;
  d.comprehension = CHECKS[type].map((q) => ({
    question_id: q.id,
    first_answer: q.correct,
    first_correct: true,
    final_answer: q.correct,
    retry_count: 0,
  }));
  d.profile_ratings.forEach((r) => {
    r.scores = Object.fromEntries(ITEM_IDS.map((k) => [k, 4]));
  });
  d.dce_choices = d.dce_plan.map((p) => ({
    ...p,
    selected_side: "left",
    selected_configuration_id: p.left_configuration_id,
    response_duration_ms: 2500,
  }));
  if (type === "elder") {
    d.elder_preferences = { X1: 0, X2: 50, X3: 100 };
    d.autonomy_choices = d.autonomy_plan.map((p) => ({
      ...p,
      choice: "indifferent",
    }));
  }
  d.answers[`${prefix}9`] = 4;
  d.answers[`${prefix}10`] = ["0", "1"];
  d.answers[`${prefix}11`] = "scores";
  d.answers[`${prefix}-check`] = 2;
  d.weight_allocation = {
    mode: "scores",
    scores: { security: 50, privacy: 30, autonomy: 20 },
    ranking: type === "elder" ? ["security", "privacy", "autonomy"] : [],
  };
  d.submitted_at = new Date().toISOString();
  return d;
}
