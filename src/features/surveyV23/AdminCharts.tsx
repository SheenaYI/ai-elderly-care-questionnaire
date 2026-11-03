import type { ReactNode } from "react";
import { ATTRIBUTE_COPY, ITEM_IDS, RATINGS, TASKS } from "./content";
import { v23Stats, type V23Row } from "./analysis";

const names = {
  security: "安全保护",
  privacy: "隐私保护",
  autonomy: "自主决定权",
};
const pct = (n: number, total: number) =>
  total ? `${((100 * n) / total).toFixed(1)}%` : "—";
function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-surface border border-sage-200 bg-white p-5 sm:p-6">
      <h3 className="text-xl font-semibold text-forest-900">{title}</h3>
      {note && (
        <p className="mb-5 mt-2 text-sm leading-6 text-sage-700">{note}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Bar({
  label,
  value,
  max,
  detail,
}: {
  label: string;
  value: number;
  max: number;
  detail?: string;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-sage-700">
          {detail ?? `${value} 人 · ${pct(value, max)}`}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="h-2.5 overflow-hidden rounded-full bg-sage-100"
      >
        <div
          className="h-full rounded-full bg-forest-600"
          style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }}
        />
      </div>
    </div>
  );
}
function Distribution({
  labels,
  counts,
}: {
  labels: string[];
  counts: number[];
}) {
  const total = counts.reduce((a, b) => a + b, 0),
    colors = ["bg-forest-700", "bg-champagne-700", "bg-sage-400"];
  return (
    <div>
      <div
        className="mb-3 flex h-3 overflow-hidden rounded-full bg-sage-100"
        aria-hidden="true"
      >
        {counts.map((n, i) => (
          <div
            key={i}
            className={colors[i % 3]}
            style={{ width: `${total ? (n / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {labels.map((label, i) => (
          <span key={label} className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-sm ${colors[i % 3]}`}
            />
            {label}：{counts[i]}（{pct(counts[i] ?? 0, total)}）
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminCharts({ rows }: { rows: V23Row[] }) {
  const s = v23Stats(rows);
  return (
    <div className="space-y-6 text-forest-900">
      <dl className="grid grid-cols-2 divide-x divide-sage-200 rounded-surface border border-sage-200 bg-white py-5 lg:grid-cols-4">
        {[
          ["已提交答卷", s.total],
          ["老人版", s.elder],
          ["照护者版", s.caregiver],
          ["注意力未通过", s.attentionFailed],
        ].map(([label, value]) => (
          <div key={label} className="px-5 py-2">
            <dt className="text-sm text-sage-700">{label}</dt>
            <dd className="mt-2 text-3xl font-semibold tabular-nums">
              {value}
              <span className="ml-2 text-sm font-normal">份</span>
            </dd>
          </div>
        ))}
      </dl>
      {!s.total && (
        <p role="status" className="rounded-panel bg-forest-50 p-4">
          当前筛选下暂无已提交答卷。可切换“预测试”或“功能测试”渠道；空白评分不按零分计算。
        </p>
      )}
      <nav aria-label="统计板块导航" className="flex flex-wrap gap-2">
        {[
          ["dce", "DCE 选择"],
          ["ratings", "感知评价"],
          ["autonomy", "自主授权"],
          ["weights", "权重与偏好"],
          ["background", "基本情况"],
          ["quality", "数据质量"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#v23-${id}`}
            className="rounded-panel border border-sage-300 bg-white px-4 py-3 text-sm hover:bg-forest-50"
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="照护者随机分卷"
          note="仅计照护者已提交答卷，不包含尚未提交的浏览器草稿。"
        >
          <Distribution
            labels={["A 卷", "B 卷"]}
            counts={s.splits.map((r) => r.count)}
          />
        </Panel>
        <Panel
          title="理解检查"
          note="按理解检查题次统计首次答对情况，不是受访者通过率。"
        >
          <Bar
            label="首次答对"
            value={s.comprehension.firstCorrect}
            max={s.comprehension.total}
            detail={`${s.comprehension.firstCorrect} / ${s.comprehension.total} 题次 · ${pct(s.comprehension.firstCorrect, s.comprehension.total)}`}
          />
          <p className="text-sm text-sage-700">
            注意力未通过：{s.attentionFailed} 份，仅标记，未删除。
          </p>
        </Panel>
      </div>
      <div id="v23-dce" className="scroll-mt-6">
        <Panel
          title="DCE 任务选择分布"
          note="按固定任务中的配置统计，不按屏幕左右位置统计。每个任务单独计算比例；仅为描述统计，不代表属性效应。"
        >
          <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
            {s.tasks.map((t) => (
              <div key={t.task_id} className="border-b border-sage-200 pb-5">
                <div className="mb-3 flex justify-between gap-3">
                  <h4 className="font-semibold">
                    {t.task_id} ·{" "}
                    {["T01", "T02", "T07", "T08"].includes(t.task_id)
                      ? "A"
                      : "B"}{" "}
                    卷
                  </h4>
                  <span className="text-sm text-sage-700">{t.n} 次作答</span>
                </div>
                <Distribution
                  labels={[
                    `配置 ${TASKS[t.task_id as keyof typeof TASKS].A}`,
                    `配置 ${TASKS[t.task_id as keyof typeof TASKS].B}`,
                  ]}
                  counts={[t.canonical_a, t.canonical_b]}
                />
              </div>
            ))}
          </div>
          <details className="mt-6 border-t border-sage-200 pt-3">
            <summary className="min-h-12 cursor-pointer py-3 font-semibold">
              展示位置检查（非配置偏好）
            </summary>
            <p className="mb-4 text-sm leading-6 text-sage-700">
              用于观察左右位置选择是否偏斜。左右随机交换，不能把“左侧”理解为固定的方案
              A。
            </p>
            <div className="grid gap-5 md:grid-cols-2">
              {s.tasks.map((t) => (
                <div key={t.task_id}>
                  <p className="mb-2 font-medium">{t.task_id}</p>
                  <Distribution
                    labels={["选择左侧", "选择右侧"]}
                    counts={[t.left, t.right]}
                  />
                </div>
              ))}
            </div>
          </details>
        </Panel>
      </div>
      <div id="v23-ratings" className="scroll-mt-6">
        <Panel
          title="C1–C8 感知评价"
          note="每格为该配置、该题项的平均分（1–5 分）；n 为有效评分数。隐私担忧分数越高代表担忧越强，不与其他维度合并为总分。"
        >
          <p className="mb-3 text-sm text-sage-700 sm:hidden">
            左右滑动表格，查看全部评分。
          </p>
          <div
            className="overflow-x-auto"
            tabIndex={0}
            aria-label="配置评分表，可左右滚动"
          >
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">
                各配置的八项评分均值及有效样本量
              </caption>
              <thead>
                <tr>
                  <th className="p-3">配置 / 评价次数</th>
                  {ITEM_IDS.map((id) => (
                    <th key={id} className="p-3">
                      {
                        {
                          s1: "安全识别",
                          s2: "紧急保障",
                          p1: "收集担忧",
                          p2: "共享担忧",
                          a1: "生活自主",
                          a2: "不被干预",
                          i1: "采纳意愿",
                          i2: "长期使用",
                        }[id]
                      }
                      <span className="block font-normal text-sage-700">
                        {id}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.ratings.map((r) => (
                  <tr key={r.id} className="border-t border-sage-200">
                    <th className="p-3">
                      {r.id}
                      <span className="block font-normal text-sage-700">
                        {r.n} 次
                      </span>
                    </th>
                    {r.means.map((m) => (
                      <td key={m.item} className="p-2">
                        <div
                          className="rounded-panel p-3 tabular-nums"
                          style={{
                            backgroundColor:
                              m.mean === null
                                ? "#f5f6f3"
                                : `rgba(49,92,80,${0.07 + (m.mean - 1) * 0.065})`,
                          }}
                        >
                          <strong>{m.mean?.toFixed(2) ?? "—"}</strong>
                          <span className="block text-xs text-sage-700">
                            n={m.n}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer py-3 font-semibold">
              评分题项原文（照护者版；老人版为同维度通俗表述）
            </summary>
            <ul className="space-y-2 text-sm leading-6">
              {ITEM_IDS.map((id) => (
                <li key={id}>
                  {id}：{RATINGS.caregiver[id]}
                </li>
              ))}
            </ul>
          </details>
        </Panel>
      </div>
      <div id="v23-autonomy" className="scroll-mt-6">
        <Panel
          title="老人自主授权情景"
          note="依次为 C4（100）→ C7（110）→ C8（111）。同一配置比较自己决定与先征得子女同意。"
        >
          <div className="grid gap-6 lg:grid-cols-3">
            {["C4", "C7", "C8"].map((id, i) => (
              <div key={id}>
                <h4 className="mb-4 font-semibold">
                  {id} · {["100", "110", "111"][i]}
                </h4>
                {s.autonomy
                  .filter((a) => a.scenario_id.startsWith(id))
                  .map((a) => (
                    <div key={a.scenario_id} className="mb-6">
                      <p className="mb-2 text-sm">
                        {a.scenario_id.endsWith("self")
                          ? "自己决定"
                          : "先征得子女同意"}
                      </p>
                      <Distribution
                        labels={["愿意", "不愿意", "都可以"]}
                        counts={[a.willing, a.unwilling, a.indifferent]}
                      />
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div id="v23-weights" className="grid scroll-mt-6 gap-6 lg:grid-cols-2">
        <Panel
          title="100 分权重分配"
          note="仅统计分数模式；仅排序答卷不填零、不混入均值。均值为描述统计。"
        >
          {s.weights.map((w) => (
            <Bar
              key={w.key}
              label={names[w.key]}
              value={w.mean ?? 0}
              max={100}
              detail={`${w.mean?.toFixed(2) ?? "—"} 分 · n=${w.n}`}
            />
          ))}
          <p className="mb-3 text-sm text-sage-700">
            仅排序 {s.rankingOnly} 份：以下为排在首位的人数。
          </p>
          {s.rankings.map((r) => (
            <Bar
              key={r.key}
              label={names[r.key]}
              value={r.first}
              max={s.rankingOnly}
            />
          ))}
        </Panel>
        <Panel
          title="老人三档偏好"
          note="仅统计老人版，保留中间档“都行 / 看情况”，不转换为二元选择。"
        >
          {s.preferences.map((p) => (
            <div key={p.key} className="mb-6">
              <h4 className="mb-3 font-medium">
                {ATTRIBUTE_COPY[p.key].question}
              </h4>
              <Distribution
                labels={[
                  ATTRIBUTE_COPY[p.key].labels[0],
                  "都行 / 看情况",
                  ATTRIBUTE_COPY[p.key].labels[1],
                ]}
                counts={p.counts}
              />
            </div>
          ))}
        </Panel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {s.overall.map((g) => (
          <Panel
            key={g.type}
            title={`${g.type === "elder" ? "老人版" : "照护者版"} · 总体看法`}
            note={`当前筛选 ${g.n} 份；担忧为多选，比例合计可超过 100%。`}
          >
            <h4 className="mb-4 font-medium">采纳意愿</h4>
            {g.willingness.map((o) => (
              <Bar key={o.label} label={o.label} value={o.count} max={g.n} />
            ))}
            <h4 className="mb-4 mt-7 font-medium">主要担忧</h4>
            {g.concerns.map((o) => (
              <Bar key={o.label} label={o.label} value={o.count} max={g.n} />
            ))}
          </Panel>
        ))}
      </div>
      <div id="v23-background" className="scroll-mt-6">
        <Panel
          title="受访者基本情况"
          note="按老人版、照护者版分别展示。不同修订的选项可能不同，不建议合并分析。"
        >
          <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
            {s.backgrounds.map((q) => (
              <details key={q.id} className="border-b border-sage-200">
                <summary className="min-h-12 cursor-pointer py-4 font-medium">
                  {q.id} · {q.text}
                </summary>
                {q.options.map((o) => (
                  <Bar
                    key={o.label}
                    label={o.label}
                    value={o.count}
                    max={q.options.reduce((sum, r) => sum + r.count, 0)}
                  />
                ))}
              </details>
            ))}
          </div>
        </Panel>
      </div>
      <div id="v23-quality" className="scroll-mt-6">
        <Panel
          title="各题完成情况"
          note="仅检查已提交答卷的字段是否有值，不是访问到提交的转化率。开放题可留空，未提交草稿不在数据库中。"
        >
          <div className="grid gap-5 md:grid-cols-2">
            {["a", "b"].map((prefix) => (
              <div key={prefix}>
                <h4 className="mb-3 font-semibold">
                  {prefix === "a" ? "老人版" : "照护者版"}
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {s.completion
                    .filter((c) => c.question_id.startsWith(prefix))
                    .map((c) => (
                      <div
                        key={c.question_id}
                        className="flex justify-between gap-2 rounded-panel bg-sage-50 px-3 py-3 text-sm"
                      >
                        <span>{c.question_id}</span>
                        <span className="tabular-nums">
                          {c.n} / {prefix === "a" ? s.elder : s.caregiver}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
