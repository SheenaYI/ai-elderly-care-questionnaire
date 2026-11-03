import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { Activity, Eye, UsersRound } from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import { Button, ButtonLink } from "../../components/ui/Button";
import SimulationModal from "../simulation/SimulationModal";
import { config, detectDataMode } from "../../lib/config";
import type { ProfileId, TaskId } from "../../types";
import {
  ATTRIBUTE_COPY,
  BACKGROUND,
  COMMON_PREMISES,
  BOUNDARY,
  CHECKS,
  ITEM_IDS,
  OPENING,
  RATINGS,
  SCENARIO_INTRO,
  SURVEY_VERSION,
  type Answer,
  type RespondentType,
} from "./content";
import {
  createSurvey,
  draftKey,
  restoreSurvey,
  saveSurvey,
  type SurveyV23,
} from "./model";
import { submissionProblems } from "./validation";
import {
  ChoiceField,
  Configuration,
  RatingField,
  AttributeVisual,
  HighlightedCopy,
} from "./Fields";
import ExperimentStep from "./ExperimentStep";
import OverallStep from "./OverallStep";

export default function SurveyEntry() {
  return (
    <PageContainer size="wide">
      <h1 className="text-3xl font-semibold text-forest-900">
        参与智能养老 AI 监测研究
      </h1>
      <p className="mt-4 text-lg leading-8 text-sage-800">
        请按您的实际身份选择问卷。两份问卷独立作答，匿名保存，随时可以退出。
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {(["elder", "caregiver"] as const).map((type) => (
          <section
            key={type}
            className="rounded-surface bg-white p-7 shadow-card"
          >
            <h2 className="text-2xl font-semibold text-forest-900">
              {type === "elder" ? "老人本人版" : "家庭照护者版"}
            </h2>
            <p className="my-5 text-lg leading-8 text-sage-800">
              {type === "elder"
                ? "60 周岁及以上，意识清楚，可独立或在他人口头协助下作答。请由老人本人作答，协助者不得代答。预计 10–12 分钟。"
                : "实际参与照护 60 周岁及以上老人的家庭成员。预计 8–10 分钟。"}
            </p>
            <ButtonLink to={`/questionnaire/${type}`}>
              进入{type === "elder" ? "老人" : "照护者"}版
            </ButtonLink>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}

export function SurveyRoute() {
  const { respondent } = useParams(),
    [search] = useSearchParams();
  if (respondent !== "elder" && respondent !== "caregiver")
    return <Navigate to="/questionnaire" replace />;
  const raw = search.get("channel"),
    channel = raw === "test" || raw === "pilot" ? raw : "formal";
  return (
    <SurveyPage
      key={`${respondent}:${channel}`}
      type={respondent}
      channel={channel}
    />
  );
}

function SurveyPage({
  type,
  channel,
}: {
  type: RespondentType;
  channel: SurveyV23["sample_channel"];
}) {
  const [d, setDraft] = useState<SurveyV23>(
    () => restoreSurvey(type, channel) ?? createSurvey(type, channel),
  );
  const [error, setError] = useState(""),
    [storageError, setStorageError] = useState(false);
  const [simulation, setSimulation] = useState<{
    id: ProfileId;
    task: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [outcome, setOutcome] = useState<string | null>(null);
  const [ratingIndex, setRatingIndex] = useState(0);
  const [hasLegacyDraft] = useState(() => {
    try {
      return !!localStorage.getItem(`aiecq:V2.3:${type}:${channel}`);
    } catch {
      return false;
    }
  });
  const submitLock = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setStorageError(!saveSurvey(d));
  }, [d]);
  useEffect(() => {
    titleRef.current?.focus();
    window.scrollTo(0, 0);
  }, [d.step]);
  function update(next: SurveyV23) {
    setDraft({ ...next, updated_at: new Date().toISOString() });
    setError("");
  }
  const elder = type === "elder",
    prefix = elder ? "a" : "b";
  const ratingStep = elder ? 4 : 3,
    overallStep = elder ? 5 : 4,
    reviewStep = elder ? 6 : 5;
  const totalSteps = reviewStep;
  const titles = elder
    ? [
        "知情同意与基本情况",
        "情景说明与理解检查",
        "您的希望",
        "自主授权情景",
        "对两个方案的看法",
        "总体问题",
        "提交前检查",
      ]
    : [
        "知情同意与基本情况",
        "情景说明与理解检查",
        "系统配置选择",
        "对两个方案的看法",
        "总体问题",
        "提交前检查",
      ];
  const answer = (id: string, value: Answer) =>
    update({ ...d, answers: { ...d.answers, [id]: value } });
  function go(step: number) {
    update({ ...d, step });
  }
  function next() {
    if (
      d.step === 0 &&
      (!d.consent ||
        !d.eligible ||
        BACKGROUND[type].some((q) => d.answers[q.id] === undefined) ||
        (!elder && d.answers.b0 !== 0) ||
        (!elder && d.answers.b3 === 3 && d.care_years === null))
    ) {
      setError("请确认知情同意、作答资格，并完成所有基本情况。");
      return;
    }
    if (
      d.step === 1 &&
      CHECKS[type].some(
        (q) =>
          d.comprehension.find((c) => c.question_id === q.id)?.final_answer !==
          q.correct,
      )
    ) {
      setError("请先完成两道理解检查；您可以重读后重新选择。");
      return;
    }
    if (
      elder &&
      d.step === 2 &&
      Object.keys(d.elder_preferences).length !== 3
    ) {
      setError("请完成三道偏好选择。");
      return;
    }
    if (d.step >= overallStep) {
      const errors = submissionProblems(d);
      if (errors.length) {
        setError(errors.join(" "));
        return;
      }
    }
    go(Math.min(reviewStep, d.step + 1));
  }
  async function submit() {
    if (submitLock.current || d.submitted_at) return;
    const errors = submissionProblems(d);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    submitLock.current = true;
    setBusy(true);
    setError("");
    const payload = { ...d, submitted_at: new Date().toISOString() };
    try {
      if (detectDataMode() === "demo") {
        if (!config.allowDemoMode)
          throw new Error(
            "当前未配置提交后端，请联系研究团队。答卷仍保存在本机。",
          );
        setOutcome(
          "本地演示已完成校验。本次未上传数据，不能作为正式研究答卷。",
        );
        return;
      }
      const response = await fetch(config.submitEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        mode?: string;
        message?: string;
      };
      if (!response.ok || body.ok !== true || body.mode !== "supabase")
        throw new Error(body.message ?? "未能确认保存成功，请稍后重试。");
      update(payload);
      setOutcome(
        "提交成功，数据已保存到研究数据库。本次调研数据仅用于学术研究，感谢您的作答与支持！",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "网络连接失败，请稍后重试。您的草稿仍保存在本机。",
      );
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }
  if (outcome || d.submitted_at)
    return (
      <PageContainer size="narrow">
        <h1 className="text-2xl font-semibold text-forest-900">感谢您的参与</h1>
        <p role="status" className="my-6 text-lg leading-8">
          {outcome ?? "这份答卷已提交，请勿重复作答。"}
        </p>
        <ButtonLink to="/">返回首页</ButtonLink>
      </PageContainer>
    );
  return (
    <PageContainer size="wide">
      <div
        className={`survey-v23 mx-auto max-w-5xl text-forest-900 ${elder ? "survey-v23--elder" : ""}`}
      >
        <header className="mb-7">
          <Link
            to="/questionnaire"
            className="inline-flex min-h-11 items-center text-base underline"
          >
            返回问卷入口
          </Link>
          <p className="my-2 text-base text-sage-800">
            {SURVEY_VERSION} · {elder ? "老人本人版" : "家庭照护者版"}
            {channel !== "formal"
              ? ` · ${channel === "test" ? "功能测试样本" : "预测试样本"}`
              : ""}
          </p>
          <h1
            ref={titleRef}
            tabIndex={-1}
            className="text-2xl font-semibold leading-10 sm:text-3xl"
          >
            {titles[d.step]}
          </h1>
          {d.step < reviewStep ? (
            <>
              <progress
                aria-label={`问卷进度，第 ${d.step + 1} 步，共 ${totalSteps} 步`}
                max={totalSteps}
                value={d.step + 1}
                className="survey-v23-progress my-4 h-2 w-full"
              />
              <p>
                第 {d.step + 1} / {totalSteps} 步 · 进度自动保存
              </p>
            </>
          ) : (
            <p className="mt-4 text-lg">作答已完成，请确认后提交。</p>
          )}
        </header>
        {storageError && (
          <p role="alert" className="mb-4 text-lg text-alert-700">
            浏览器无法保存草稿，请勿刷新或关闭页面。
          </p>
        )}
        {hasLegacyDraft && d.step === 0 && (
          <p className="mb-5 text-lg leading-8">
            问卷已更新，旧草稿仍保存在本机；本次请按新题目重新作答。
          </p>
        )}
        {d.step === 0 && (
          <section className="rounded-surface bg-white p-5 sm:p-7">
            <p className="text-lg leading-9">{OPENING[type]}</p>
            <p className="mt-4 text-lg leading-8">
              {elder
                ? "听不清或不明白的题目，可以请身边的人念给您听，但请自己作答。"
                : "题目均为单选或按提示作答，请如实填写。"}
            </p>
            <label className="my-5 flex min-h-14 cursor-pointer items-start gap-3 rounded-panel bg-forest-50 p-4 text-lg">
              <input
                type="checkbox"
                checked={d.eligible}
                onChange={(e) => update({ ...d, eligible: e.target.checked })}
                className="mt-1 h-5 w-5 shrink-0 accent-forest-700"
              />
              {elder
                ? "我确认已满 60 周岁，意识清楚，能够独立或在口头协助下自己作答。"
                : "我确认是实际参与照护 60 周岁及以上老人的家庭成员。"}
            </label>
            <ChoiceField
              id="consent"
              text="您是否已阅读说明并自愿参与本研究？"
              options={["同意并继续", "不同意（结束）"]}
              value={d.consent ? 0 : undefined}
              onChange={(v) => {
                if (v === 0)
                  update({
                    ...d,
                    consent: true,
                    consent_at: d.consent_at ?? new Date().toISOString(),
                  });
                else {
                  update({ ...d, consent: false, consent_at: null });
                  setOutcome("您未同意参与研究，问卷已结束，未上传任何答案。");
                }
              }}
            />
            {BACKGROUND[type].map((q) =>
              !elder && d.answers.b0 === 1 && q.id !== "b0" ? null : (
                <div key={q.id}>
                  <ChoiceField
                    id={q.id}
                    text={q.text}
                    options={q.options}
                    value={d.answers[q.id]}
                    onChange={(v) => answer(q.id, v)}
                  />
                  {q.id === "b3" &&
                    d.answers.b3 === 3 &&
                    d.answers.b0 !== 1 && (
                      <label className="block text-lg">
                        偶尔帮忙（年）
                        <input
                          aria-label="照护年限"
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={d.care_years ?? ""}
                          onChange={(e) =>
                            update({
                              ...d,
                              care_years:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          className="ml-3 min-h-14 w-28 rounded-panel border border-sage-300 p-3"
                        />
                      </label>
                    )}
                </div>
              ),
            )}
            {!elder && d.answers.b0 === 1 && (
              <p role="status" className="mt-5 text-lg leading-8">
                感谢您的配合。本问卷仅面向有实际照护经历的家庭成员，您的作答到此结束，不会提交调查数据。
              </p>
            )}
          </section>
        )}
        {d.step === 1 && (
          <section className="rounded-surface bg-white p-5 sm:p-7">
            <p className="text-lg leading-9">{SCENARIO_INTRO[type]}</p>
            <section className="my-7" aria-label="所有方案的共同前提">
              <h2 className="text-xl font-semibold">
                {COMMON_PREMISES[type].title}
              </h2>
              <ol className="mt-4 list-decimal space-y-4 pl-7 text-lg leading-9">
                {COMMON_PREMISES[type].items.map((item) => (
                  <li key={item} className="survey-description pl-1">
                    {item}
                  </li>
                ))}
              </ol>
            </section>
            <div className="my-6 space-y-4">
              {(["X1", "X2", "X3"] as const).map((k, i) => {
                const Icon = [Eye, UsersRound, Activity][i]!;
                return (
                  <div key={k} className="py-5">
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                      <Icon className="h-6 w-6 shrink-0" />
                      {ATTRIBUTE_COPY[k].question}
                    </h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {ATTRIBUTE_COPY[k].clauses.map((c, level) => (
                        <div
                          key={c}
                          className={`survey-level rounded-panel border border-sage-300 p-5 ${level ? "survey-level--expanded" : "survey-level--basic"}`}
                        >
                          <h3 className="text-xl font-semibold">
                            {k === "X1"
                              ? ["简单提示", "详细记录 / 视频"][level]
                              : k === "X2"
                                ? ["仅指定子女", "子女 + 养老服务机构"][level]
                                : ["异常时详细记录", "全天详细记录"][level]}
                          </h3>
                          <AttributeVisual
                            attribute={k}
                            level={level as 0 | 1}
                          />
                          <p className="survey-description text-lg leading-8">
                            <HighlightedCopy text={c} />。
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <details className="survey-help text-lg leading-8">
              <summary>三个设置有什么区别？</summary>
              <p>
                {BOUNDARY}签约养老服务机构是指经审核、可上门服务的养老公司。
              </p>
            </details>
            {CHECKS[type].map((q) => {
              const c = d.comprehension.find((c) => c.question_id === q.id);
              return (
                <div key={q.id}>
                  <ChoiceField
                    id={q.id}
                    text={q.text}
                    options={q.options}
                    value={c?.final_answer}
                    onChange={(v) =>
                      update({
                        ...d,
                        comprehension: [
                          ...d.comprehension.filter(
                            (r) => r.question_id !== q.id,
                          ),
                          {
                            question_id: q.id,
                            first_answer: c?.first_answer ?? v,
                            first_correct: c?.first_correct ?? v === q.correct,
                            final_answer: v,
                            retry_count: c ? c.retry_count + 1 : 0,
                          },
                        ],
                      })
                    }
                  />
                  {c && c.final_answer !== q.correct && (
                    <p
                      role="status"
                      className="text-lg leading-8 text-champagne-800"
                    >
                      {q.explanation}请重读后重新选择。
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        )}
        {(d.step === 2 || (elder && d.step === 3)) && (
          <ExperimentStep
            key={d.step}
            draft={d}
            update={update}
            simulate={(id, task) => setSimulation({ id, task })}
            next={next}
            back={() => go(d.step - 1)}
          />
        )}
        {d.step === ratingStep && (
          <div className="space-y-7">
            <nav className="flex flex-wrap gap-3" aria-label="评价方案导航">
              {d.profile_ratings.map((r, i) => (
                <Button
                  key={r.configuration_id}
                  variant={i === ratingIndex ? "primary" : "secondary"}
                  aria-pressed={i === ratingIndex}
                  onClick={() => setRatingIndex(i)}
                >
                  第 {i + 1} 个方案 ·{" "}
                  {ITEM_IDS.filter((id) => r.scores[id] !== undefined).length} /
                  8 已答
                </Button>
              ))}
            </nav>
            {d.profile_ratings.map((r, ri) => (
              <section
                key={r.configuration_id}
                hidden={ri !== ratingIndex}
                className="rounded-surface bg-white p-5 sm:p-7"
              >
                <h2 className="mb-4 text-xl font-semibold">
                  第 {ri + 1} 个评价方案
                </h2>
                <Configuration
                  id={r.configuration_id}
                  onSimulation={() =>
                    setSimulation({ id: r.configuration_id, task: null })
                  }
                />
                <div
                  className="survey-rating-scale sticky top-20 z-10 mt-5 flex justify-between gap-4 border-b border-sage-300 bg-white py-4 text-lg font-semibold lg:top-0"
                  aria-label="评分说明"
                >
                  <span>1 · 完全不同意</span>
                  <span>5 · 完全同意</span>
                </div>
                {ITEM_IDS.map((id) => (
                  <RatingField
                    key={id}
                    id={`rating-${ri}-${id}`}
                    text={RATINGS[type][id]}
                    value={r.scores[id]}
                    onChange={(v) =>
                      update({
                        ...d,
                        profile_ratings: d.profile_ratings.map((old, i) =>
                          i === ri
                            ? { ...old, scores: { ...old.scores, [id]: v } }
                            : old,
                        ),
                      })
                    }
                  />
                ))}
                {ri === 0 && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        setRatingIndex(1);
                        titleRef.current?.focus();
                        window.scrollTo(0, 0);
                      }}
                      disabled={ITEM_IDS.some(
                        (id) => r.scores[id] === undefined,
                      )}
                    >
                      评价第二个方案
                    </Button>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
        {d.step === overallStep && <OverallStep draft={d} update={update} />}
        {d.step === reviewStep && (
          <section className="rounded-surface bg-white p-5 sm:p-7">
            <h2 className="text-xl font-semibold">请确认您的作答</h2>
            <ul className="my-5 space-y-3 text-lg leading-8">
              <li>
                {elder
                  ? "三道三档偏好与六道自主授权情景已完成。"
                  : "本分卷四道 DCE 选择已完成。"}
              </li>
              <li>两个随机配置的八项感知评价已分别保存。</li>
              <li>
                {prefix}11：
                {d.weight_allocation.mode === "ranking_only"
                  ? "仅排序，分数留空。"
                  : "安全、隐私、自主分数合计 100 分。"}
              </li>
              <li>提交前可返回修改；中途退出不会上传草稿。</li>
            </ul>
            <Button size="lg" disabled={busy} onClick={submit}>
              {busy ? "正在提交，请稍候…" : "确认并提交问卷"}
            </Button>
          </section>
        )}
        {error && (
          <p
            role="alert"
            className="my-5 rounded-panel bg-alert-50 p-4 text-lg leading-8 text-alert-700"
          >
            {error}
          </p>
        )}
        {!(d.step === 2 || (elder && d.step === 3)) && (
          <footer className="mt-7 flex flex-wrap justify-between gap-4">
            {d.step > 0 && (
              <Button variant="secondary" onClick={() => go(d.step - 1)}>
                返回上一步
              </Button>
            )}
            {d.step < reviewStep && (
              <Button
                size="lg"
                className="ml-auto"
                disabled={
                  (!elder && d.step === 0 && d.answers.b0 === 1) ||
                  (d.step === ratingStep &&
                    d.profile_ratings.some((r) =>
                      ITEM_IDS.some((id) => r.scores[id] === undefined),
                    ))
                }
                onClick={next}
              >
                继续下一步
              </Button>
            )}
          </footer>
        )}
        <p className="mt-8 text-base leading-7 text-sage-700">
          暂停后可从本机继续。
          <button
            type="button"
            className="ml-2 min-h-11 underline"
            onClick={() => {
              if (window.confirm("确定清除本机这份未提交草稿并重新开始吗？")) {
                localStorage.removeItem(draftKey(type, channel));
                update(createSurvey(type, channel));
              }
            }}
          >
            重新开始
          </button>
        </p>
        {simulation && (
          <SimulationModal
            presentationLabel="当前体验方案"
            profileId={simulation.id}
            taskId={simulation.task as TaskId | null}
            source="dce"
            onClose={() => setSimulation(null)}
            onEvent={(event) =>
              setDraft((current) => ({
                ...current,
                simulation_events: [
                  ...current.simulation_events,
                  {
                    configuration_id: event.profileId,
                    task_id: event.taskId,
                    event_type: event.eventType,
                    elapsed_ms: Math.max(
                      0,
                      Date.now() - Date.parse(current.started_at),
                    ),
                    duration_ms: event.durationMs ?? null,
                  },
                ].slice(-500),
              }))
            }
          />
        )}
      </div>
    </PageContainer>
  );
}
