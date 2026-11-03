import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ATTRIBUTE_COPY } from "./content";
import { autonomyText, type SurveyV23 } from "./model";
import { Configuration, ChoiceField } from "./Fields";
import type { ProfileId } from "../../types";

export default function ExperimentStep({
  draft: d,
  update,
  simulate,
  next,
  back,
}: {
  draft: SurveyV23;
  update: (d: SurveyV23) => void;
  simulate: (id: ProfileId, task: string | null) => void;
  next: () => void;
  back: () => void;
}) {
  const [index, setIndex] = useState(0),
    started = useRef(Date.now());
  const elder = d.respondent_type === "elder";
  const preferencesDone = Object.keys(d.elder_preferences).length === 3;
  const showScenarios = !elder || d.step === 3;
  const plan = elder ? d.autonomy_plan : d.dce_plan;
  const isDone = elder
    ? d.autonomy_choices.length === 6 &&
      Object.keys(d.elder_preferences).length === 3
    : d.dce_choices.length === 4;
  const task = d.dce_plan[index],
    scenario = d.autonomy_plan[index];
  const [selected, setSelected] = useState<"left" | "right" | null>(null);
  const [autonomyChoice, setAutonomyChoice] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ message: string } | null>(null);
  const questionHeading = useRef<HTMLParagraphElement>(null);
  const focusNextQuestion = useRef(false);
  const completedCount = d.dce_plan.filter((p) =>
    d.dce_choices.some((c) => c.task_id === p.task_id),
  ).length;
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!focusNextQuestion.current) return;
    focusNextQuestion.current = false;
    questionHeading.current?.focus({ preventScroll: true });
    questionHeading.current?.scrollIntoView?.({
      block: "start",
      behavior: "instant",
    });
  }, [index]);
  function move(i: number, confirmed = false) {
    if (!confirmed) setNotice(null);
    if (!elder) focusNextQuestion.current = true;
    setIndex(i);
    setSelected(null);
    setAutonomyChoice(null);
    started.current = Date.now();
  }
  const saved = task && d.dce_choices.find((c) => c.task_id === task.task_id);
  const savedAutonomy =
    scenario &&
    d.autonomy_choices.find((c) => c.scenario_id === scenario.scenario_id);
  const side = selected ?? saved?.selected_side;
  const choices = ["willing", "unwilling", "indifferent"] as const;
  const choice =
    autonomyChoice ??
    (savedAutonomy ? choices.indexOf(savedAutonomy.choice) : null);
  function confirm() {
    if (elder ? !scenario || choice === null : !task || !side) return;
    if (elder && scenario && choice !== null)
      update({
        ...d,
        autonomy_choices: [
          ...d.autonomy_choices.filter(
            (c) => c.scenario_id !== scenario.scenario_id,
          ),
          { ...scenario, choice: choices[choice]! },
        ].sort((a, b) => a.display_order - b.display_order),
      });
    else if (!elder && task && side)
      update({
        ...d,
        dce_choices: [
          ...d.dce_choices.filter((c) => c.task_id !== task.task_id),
          {
            ...task,
            selected_side: side,
            selected_configuration_id:
              side === "left"
                ? task.left_configuration_id
                : task.right_configuration_id,
            response_duration_ms: Math.max(
              0,
              Math.min(86400000, Date.now() - started.current),
            ),
          },
        ].sort((a, b) => a.display_order - b.display_order),
      });
    if (!elder) {
      const count = completedCount + (saved ? 0 : 1);
      setNotice({
        message:
          index < plan.length - 1
            ? `${saved ? "已更新本题选择" : "您已完成一道方案选择"}，已进入第 ${index + 2} 题。`
            : count === plan.length
              ? "4 道方案选择已全部完成，请点击“继续下一步”。"
              : `本题已确认，仍有 ${plan.length - count} 道方案选择未完成。`,
      });
    }
    if (index < plan.length - 1) move(index + 1, true);
  }
  return (
    <div className="space-y-6">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-4 bottom-6 z-[60] flex justify-center"
      >
        {notice && (
          <div className="survey-dce-notice flex max-w-xl items-center gap-2 rounded-full border px-5 py-3 text-base font-medium leading-6 text-forest-900">
            <Check aria-hidden="true" className="h-5 w-5 shrink-0" />
            {notice.message}
          </div>
        )}
      </div>
      {elder && !showScenarios && (
        <section className="rounded-surface bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-forest-900">您的希望</h2>
          <details className="survey-help mt-3 text-lg leading-8 text-sage-800">
            <summary>怎么选？</summary>
            <p>
              这不是让您设计产品，只是想知道您个人希望设备做到什么程度。每道题选一个最符合您想法的答案；“都行/看情况”表示您觉得两种都可以。
            </p>
          </details>
          {(["X1", "X2", "X3"] as const).map((k) => (
            <ChoiceField
              key={k}
              id=""
              text={ATTRIBUTE_COPY[k].question}
              options={[
                ATTRIBUTE_COPY[k].labels[0],
                "都行/看情况",
                ATTRIBUTE_COPY[k].labels[1],
              ]}
              value={
                d.elder_preferences[k] === undefined
                  ? null
                  : d.elder_preferences[k]! / 50
              }
              onChange={(v) =>
                update({
                  ...d,
                  elder_preferences: { ...d.elder_preferences, [k]: v * 50 },
                })
              }
            />
          ))}
        </section>
      )}
      {showScenarios && (
        <section className="rounded-surface bg-white p-5 sm:p-7">
          {elder && (
            <h2 className="text-xl font-semibold text-forest-900">
              自己决定或先征得子女同意，您的选择会不同吗？
            </h2>
          )}
          {elder ? (
            <p className="mt-3 text-lg leading-8 text-sage-800">
              同组两题的设备设置相同，只改变是否需要子女同意。请按自己的想法作答。
            </p>
          ) : (
            <div className="space-y-3 text-lg leading-8 text-sage-800">
              <p>
                请设想为家中老人长期采用一套 AI 养老监测系统。两套方案的
                <strong className="font-semibold">
                  基础异常识别与紧急报警能力相同
                </strong>
                ，仅“能看到的信息”“信息发给谁”“监测方式”三个设置有所不同。
              </p>
              <p>
                <strong className="font-semibold">
                  每题选择您更愿意长期采用的一套方案
                </strong>
                ，选好后点击确认。
              </p>
              <p className="text-base leading-6">
                颜色区分设置类别，不表示高低或优劣。
              </p>
            </div>
          )}
          <nav className="my-5 flex flex-wrap gap-2" aria-label="实验题目导航">
            {plan.map((p, i) => (
              <button
                type="button"
                key={i}
                onClick={() => move(i)}
                disabled={
                  elder &&
                  i > Math.min(d.autonomy_choices.length, plan.length - 1)
                }
                aria-current={i === index ? "step" : undefined}
                className={`h-12 min-w-12 rounded-panel border px-3 ${index === i ? "bg-forest-700 text-white" : "border-sage-300 text-forest-800"}`}
              >
                {i + 1}
                {(
                  "task_id" in p
                    ? d.dce_choices.some((c) => c.task_id === p.task_id)
                    : d.autonomy_choices.some(
                        (c) => c.scenario_id === p.scenario_id,
                      )
                )
                  ? " ✓"
                  : ""}
              </button>
            ))}
          </nav>
          <p
            ref={questionHeading}
            tabIndex={-1}
            className="mb-4 scroll-mt-28 text-base text-sage-800 focus:outline-none"
          >
            第 {index + 1} 题 / 共 {plan.length} 题
          </p>
          {elder && scenario ? (
            <>
              <div
                className="my-5 flex flex-wrap gap-3 text-lg"
                aria-label="情景设置进度"
              >
                {(["C4", "C7", "C8"] as const).map((id, i) => (
                  <span
                    key={id}
                    aria-current={
                      id === scenario.configuration_id ? "step" : undefined
                    }
                    className={`rounded-panel border px-4 py-3 ${id === scenario.configuration_id ? "border-forest-700 bg-forest-50 font-semibold" : "border-sage-300"}`}
                  >
                    {i + 1} · {["详细信息", "增加机构", "全天记录"][i]}
                  </span>
                ))}
              </div>
              <p className="mb-4 text-lg font-semibold">
                {scenario.authorization_condition === "self"
                  ? "本题：您自己就能改，不用问子女"
                  : "本题：改之前，要先征得子女同意"}
              </p>
              <Configuration
                id={scenario.configuration_id}
                title="本组设置（同组两题保持相同）"
              />
              <ChoiceField
                id={`autonomy-${index}`}
                text={autonomyText(scenario)}
                options={["愿意", "不愿意", "都可以（没有影响）"]}
                value={choice}
                onChange={setAutonomyChoice}
              />
            </>
          ) : task ? (
            <div className="survey-dce-comparison grid gap-5 lg:grid-cols-2">
              <Configuration
                id={task.left_configuration_id}
                title="左侧方案"
                other={task.right_configuration_id}
                selected={side === "left"}
                onSelect={() => setSelected("left")}
                onSimulation={() =>
                  simulate(task.left_configuration_id, task.task_id)
                }
              />
              <Configuration
                id={task.right_configuration_id}
                title="右侧方案"
                other={task.left_configuration_id}
                selected={side === "right"}
                onSelect={() => setSelected("right")}
                onSimulation={() =>
                  simulate(task.right_configuration_id, task.task_id)
                }
              />
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
            <Button
              variant="secondary"
              disabled={index === 0}
              onClick={() => move(index - 1)}
            >
              上一题
            </Button>
            <div
              className={
                elder ? "contents" : "ml-auto w-full sm:w-auto sm:min-w-64"
              }
            >
              <Button
                className={elder ? undefined : "w-full"}
                disabled={
                  elder
                    ? choice === null
                    : !side ||
                      (index === plan.length - 1 &&
                        !!saved &&
                        side === saved.selected_side)
                }
                onClick={confirm}
              >
                {index === plan.length - 1 ? "确认本题" : "确认并进入下一题"}
              </Button>
              {!elder && (
                <div className="mt-3" aria-label="方案选择完成进度">
                  <div className="mb-2 flex justify-between gap-3 text-sm text-sage-800">
                    <span>
                      已确认 {completedCount} / {plan.length} 题
                    </span>
                    <span>
                      {completedCount === plan.length
                        ? "全部完成"
                        : "选好后请确认"}
                    </span>
                  </div>
                  <progress
                    aria-label="已确认的方案选择题数"
                    max={plan.length}
                    value={completedCount}
                    className="survey-dce-progress block h-2 w-full overflow-hidden rounded-full"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="secondary" onClick={back}>
          返回上一步
        </Button>
        <Button
          size="lg"
          className="ml-auto"
          disabled={
            showScenarios
              ? !isDone ||
                (elder
                  ? !savedAutonomy ||
                    choices[choice ?? -1] !== savedAutonomy.choice
                  : !saved || side !== saved.selected_side)
              : !preferencesDone
          }
          onClick={next}
        >
          继续下一步
        </Button>
      </div>
    </div>
  );
}
