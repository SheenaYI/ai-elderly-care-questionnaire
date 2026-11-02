import { useRef, useState } from "react";
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
  function move(i: number) {
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
    if (index < plan.length - 1) move(index + 1);
  }
  return (
    <div className="space-y-6">
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
          <h2 className="text-xl font-semibold text-forest-900">
            {elder
              ? "自己决定或先征得子女同意，您的选择会不同吗？"
              : "系统配置选择"}
          </h2>
          <p className="mt-3 text-lg leading-8 text-sage-800">
            {elder
              ? "同组两题的设备设置相同，只改变是否需要子女同意。请按自己的想法作答。"
              : "请设想为家中老人长期采用一套 AI 养老监测系统。以下两个方案的基础异常识别与紧急报警能力完全相同，只在上述三个设置上不同，请选择您更愿意采用的一个。"}
          </p>
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
          <p className="mb-4 text-base text-sage-800">
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
          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <Button
              variant="secondary"
              disabled={index === 0}
              onClick={() => move(index - 1)}
            >
              上一题
            </Button>
            <Button
              disabled={elder ? choice === null : !side}
              onClick={confirm}
            >
              {index === plan.length - 1 ? "确认本题" : "确认并进入下一题"}
            </Button>
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
