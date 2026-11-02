import {
  CONCERNS,
  WEIGHT_KEYS,
  WEIGHT_LABELS,
  WILLINGNESS,
  type WeightKey,
} from "./content";
import type { SurveyV23 } from "./model";
import { ChoiceField } from "./Fields";

export default function OverallStep({
  draft: d,
  update,
}: {
  draft: SurveyV23;
  update: (d: SurveyV23) => void;
}) {
  const elder = d.respondent_type === "elder",
    prefix = elder ? "a" : "b";
  const w = d.weight_allocation,
    selected = d.answers[`${prefix}10`] as string[] | undefined;
  const answer = (id: string, value: string | number | string[]) =>
    update({ ...d, answers: { ...d.answers, [id]: value } });
  const sum = WEIGHT_KEYS.reduce((s, k) => s + (w.scores[k] ?? 0), 0),
    allEntered = WEIGHT_KEYS.every((k) => w.scores[k] !== null);
  return (
    <section className="rounded-surface bg-white p-5 sm:p-7">
      <ChoiceField
        id={`${prefix}9`}
        text={
          elder
            ? "总的来说，您愿意在养老中使用这种 AI 监测设备吗？"
            : "总体而言，我愿意在养老照护中使用 AI 监测系统。"
        }
        options={WILLINGNESS[d.respondent_type]}
        value={
          typeof d.answers[`${prefix}9`] === "number"
            ? Number(d.answers[`${prefix}9`]) - 1
            : null
        }
        onChange={(v) => answer(`${prefix}9`, v + 1)}
      />
      <fieldset className="my-7">
        <legend className="mb-3 text-lg font-semibold leading-8">
          {prefix}10{" "}
          {elder
            ? "选这种设备时，您最担心什么？"
            : "选择 AI 养老监测系统时，您最担心什么？"}
          （最多选 2 项）
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONCERNS[d.respondent_type].map((label, i) => (
            <label
              key={label}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-panel border border-sage-300 p-4 text-lg"
            >
              <input
                type="checkbox"
                className="h-5 w-5 accent-forest-700"
                checked={selected?.includes(String(i)) ?? false}
                disabled={
                  !selected?.includes(String(i)) && (selected?.length ?? 0) >= 2
                }
                onChange={(e) =>
                  answer(
                    `${prefix}10`,
                    e.target.checked
                      ? [...(selected ?? []), String(i)]
                      : (selected ?? []).filter((v) => v !== String(i)),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="my-8">
        <legend className="mb-3 text-lg font-semibold leading-8">
          {prefix}11{" "}
          {elder
            ? "假如一共 100 分，您会怎么分给下面三件事？（三样加起来必须正好 100 分）"
            : "假设有 100 分，您会怎样分配给以下三个方面？（三项加总须等于 100）"}
        </legend>
        {elder && (
          <>
            <p className="mb-4 text-lg leading-8 text-sage-800">
              可以请调研员或家属帮您记录。先想想“这三件事里哪件对您最重要？”，再分配分数。确实无法打分时，可只记录排序。
            </p>
            <ChoiceField
              id="allocation-mode"
              text="请选择作答方式"
              options={["分配 100 分", "确实无法打分，仅排序"]}
              value={w.mode === "scores" ? 0 : 1}
              onChange={(v) =>
                update({
                  ...d,
                  answers: { ...d.answers, a11: v ? "ranking_only" : "scores" },
                  weight_allocation: {
                    ...w,
                    mode: v ? "ranking_only" : "scores",
                    scores: { security: null, privacy: null, autonomy: null },
                    ranking: [],
                  },
                })
              }
            />
            {w.mode === "ranking_only" && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <label key={i} className="block text-lg">
                    第 {i + 1} 重要
                    <select
                      className="mt-2 min-h-14 w-full rounded-panel border border-sage-300 bg-white px-4 text-base"
                      value={w.ranking[i] ?? ""}
                      onChange={(e) => {
                        const ranking = [...w.ranking];
                        ranking[i] = e.target.value as WeightKey;
                        update({ ...d, weight_allocation: { ...w, ranking } });
                      }}
                    >
                      <option value="">请选择</option>
                      {WEIGHT_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {WEIGHT_LABELS.elder[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
        {w.mode === "scores" && (
          <div className="mt-5 space-y-4">
            {WEIGHT_KEYS.map((k) => (
              <label
                key={k}
                className="grid gap-2 text-lg sm:grid-cols-[1fr_8rem] sm:items-center"
              >
                {WEIGHT_LABELS[d.respondent_type][k]}
                <input
                  aria-label={`${WEIGHT_LABELS[d.respondent_type][k]}分数`}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  inputMode="numeric"
                  value={w.scores[k] ?? ""}
                  className="min-h-14 w-full rounded-panel border border-sage-300 px-4 text-lg"
                  onChange={(e) =>
                    update({
                      ...d,
                      answers: { ...d.answers, [`${prefix}11`]: "scores" },
                      weight_allocation: {
                        ...w,
                        scores: {
                          ...w.scores,
                          [k]:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
            ))}
            <p
              role="status"
              className={`text-lg font-semibold ${allEntered && sum === 100 ? "text-forest-800" : "text-alert-700"}`}
            >
              当前合计：{sum} / 100 分
              {!allEntered
                ? "（请填写全部三项）"
                : sum !== 100
                  ? "，请调整后再提交。"
                  : "，已满足要求。"}
            </p>
          </div>
        )}
      </fieldset>
      <ChoiceField
        id={`${prefix}-check`}
        text={
          elder
            ? "（作答核对）这道题不用多想，请直接选择“不太愿意”。"
            : "（作答核对）本题请直接选择“不同意”。"
        }
        options={WILLINGNESS[d.respondent_type]}
        value={
          typeof d.answers[`${prefix}-check`] === "number"
            ? Number(d.answers[`${prefix}-check`]) - 1
            : null
        }
        onChange={(v) => answer(`${prefix}-check`, v + 1)}
      />
      <label
        className="mt-8 block text-lg font-semibold leading-8"
        htmlFor="open-feedback"
      >
        {prefix}12{" "}
        {elder
          ? "您觉得理想的设备应该是什么样的？（随便说几句，可以不答）"
          : "您认为理想的 AI 养老监测系统应如何平衡安全、隐私和自主性？（开放题，可跳过）"}
      </label>
      <textarea
        id="open-feedback"
        maxLength={2000}
        rows={4}
        value={String(d.answers[`${prefix}12`] ?? "")}
        onChange={(e) => answer(`${prefix}12`, e.target.value)}
        className="mt-3 w-full rounded-panel border border-sage-300 p-4 text-lg leading-8"
      />
    </section>
  );
}
