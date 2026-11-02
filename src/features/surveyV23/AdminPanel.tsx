import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../lib/supabase/client";
import { Button } from "../../components/ui/Button";
import { getAccessToken } from "../admin/useAdminAuth";
import { ITEM_IDS, INSTRUMENT_REVISION } from "./content";
import {
  V23_DATASETS,
  v23Stats,
  type V23Dataset,
  type V23Row,
} from "./analysis";

const exportLabels: Record<V23Dataset, string> = {
  v23_raw: "完整原始答卷 JSON",
  v23_answers: "各题原始答案与理解检查",
  v23_dce: "DCE任务与展示位置",
  v23_long: "DCE 条件Logit长表",
  v23_ratings: "配置感知评价长表",
  v23_autonomy: "自主授权配对情景",
  v23_weights: "100分分配与注意力检验",
  v23_preferences: "老人三档偏好",
};

export default function V23AdminPanel() {
  const [rows, setRows] = useState<V23Row[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [type, setType] = useState("all"),
    [channel, setChannel] = useState("formal");
  const [exporting, setExporting] = useState(false);
  const [revision, setRevision] = useState<string>(INSTRUMENT_REVISION);
  async function refresh() {
    const client = getSupabaseClient();
    if (!client) return;
    setLoading(true);
    setError("");
    try {
      const all: V23Row[] = [];
      let offset = 0;
      for (;;) {
        const { data, error } = await client
          .from("survey_v23_submissions")
          .select(
            "participant_id,survey_version,respondent_type,sample_channel,split_version,submitted_at,payload",
          )
          .order("participant_id")
          .range(offset, offset + 499);
        if (error)
          throw new Error(
            "V2.3 数据读取失败。请核对 0005 迁移、RLS 与管理员权限；历史数据区仍可使用。",
          );
        if (!data?.length) break;
        all.push(...(data as V23Row[]));
        offset += data.length;
        if (offset > 100000)
          throw new Error(
            "V2.3 数据超过当前读取上限，请按渠道通过数据库导出。",
          );
      }
      setRows(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取失败。");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.survey_version === "V2.3" &&
          (revision === "all" ||
            (r.payload.instrument_revision ?? "legacy") === revision) &&
          (type === "all" || r.respondent_type === type) &&
          (channel === "all" || r.sample_channel === channel),
      ),
    [rows, type, channel, revision],
  );
  const stats = useMemo(() => v23Stats(filtered), [filtered]);
  async function download(dataset: V23Dataset) {
    setExporting(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("登录已过期，请重新登录。");
      const response = await fetch(
        `/api/admin/export?dataset=${dataset}&respondent_type=${type}&sample_channel=${channel}&instrument_revision=${revision}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok)
        throw new Error(
          `导出失败（HTTP ${response.status}），请核对服务端权限与迁移。`,
        );
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `${dataset}_${type}_${channel}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败。");
    } finally {
      setExporting(false);
    }
  }
  const tableClass =
    "min-w-[32rem] w-full text-left text-base [&_th]:p-3 [&_td]:p-3 [&_tr]:border-b [&_tr]:border-sage-200";
  return (
    <section
      className="mb-10 rounded-surface border border-forest-200 bg-white p-5 sm:p-7"
      aria-label="V2.3 独立统计"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-forest-900">
          V2.3 正式问卷统计
        </h2>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          刷新新版数据
        </Button>
      </div>
      <p className="my-4 text-base leading-7 text-sage-800">
        新版数据单独统计。默认仅显示正式渠道的已提交答卷；未提交草稿保存在参与者浏览器，不计入后台完成率。注意力检验失败只标记，不自动删除原始答案。
      </p>
      <div className="my-5 flex flex-wrap gap-4">
        <label>
          问卷修订
          <select
            aria-label="问卷修订筛选"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            className="ml-2 min-h-12 rounded-panel border border-sage-300 p-2"
          >
            <option value={INSTRUMENT_REVISION}>2026-11-02 修订</option>
            <option value="legacy">修订前（旧 b4 / 随机授权）</option>
            <option value="all">全部修订（不宜混析）</option>
          </select>
        </label>
        <label>
          受访者类型
          <select
            aria-label="受访者类型筛选"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="ml-2 min-h-12 rounded-panel border border-sage-300 p-2"
          >
            <option value="all">全部</option>
            <option value="elder">老人版</option>
            <option value="caregiver">照护者版</option>
          </select>
        </label>
        <label>
          样本渠道
          <select
            aria-label="样本渠道筛选"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="ml-2 min-h-12 rounded-panel border border-sage-300 p-2"
          >
            <option value="formal">正式</option>
            <option value="pilot">预测试</option>
            <option value="test">功能测试</option>
            <option value="all">全部（混合渠道）</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="my-4 text-alert-700">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">正在读取 V2.3 数据…</p>
      ) : (
        <>
          <p className="text-lg leading-9">
            答卷 {stats.total} 份 · 老人 {stats.elder} · 照护者{" "}
            {stats.caregiver} · 照护者 A卷 {stats.splits[0]!.count} / B卷{" "}
            {stats.splits[1]!.count}
          </p>
          <p className="mt-2">
            注意力核对未通过 {stats.attentionFailed} 份；老人仅排序{" "}
            {stats.rankingOnly} 份（不填充为 0 分）。
          </p>
          <h3 className="mt-7 text-xl font-semibold">DCE 任务选择分布</h3>
          <div className="mt-3 overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>任务</th>
                  <th>作答数</th>
                  <th>原始方案A</th>
                  <th>原始方案B</th>
                  <th>选择左侧</th>
                </tr>
              </thead>
              <tbody>
                {stats.tasks.map((t) => (
                  <tr key={t.task_id}>
                    <td>{t.task_id}</td>
                    <td>{t.n}</td>
                    <td>{t.canonical_a}</td>
                    <td>{t.canonical_b}</td>
                    <td>{t.left}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mt-7 text-xl font-semibold">C1–C8 感知评价</h3>
          <p className="mt-2">
            隐私项 p1/p2 越高表示担忧越强；未评分留空，不按 0 分计算。
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>配置</th>
                  <th>次数</th>
                  {ITEM_IDS.map((i) => (
                    <th key={i}>{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.ratings.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.n}</td>
                    {r.means.map((m) => (
                      <td key={m.item}>{m.mean?.toFixed(2) ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="mt-6">
            <summary className="cursor-pointer py-3 text-lg font-semibold">
              自主授权、各题完成情况与权重分配
            </summary>
            <h4 className="my-3 font-semibold">
              自主授权：愿意 / 不愿意 / 都可以
            </h4>
            <ul className="space-y-2">
              {stats.autonomy.map((a) => (
                <li key={a.scenario_id}>
                  {a.scenario_id}：{a.willing} / {a.unwilling} / {a.indifferent}
                </li>
              ))}
            </ul>
            <h4 className="mb-2 mt-6 font-semibold">
              已提交答卷各题完成数（开放题可留空）
            </h4>
            <div className="flex flex-wrap gap-4">
              {stats.completion.map((c) => (
                <span key={c.question_id}>
                  {c.question_id}：{c.n}
                </span>
              ))}
            </div>
            <h4 className="mb-2 mt-6 font-semibold">
              100 分分配均值（仅分数模式）
            </h4>
            <p>
              {stats.weights
                .map((w) => `${w.key}：${w.mean?.toFixed(2) ?? "—"}`)
                .join("；")}
            </p>
          </details>
          <h3 className="mt-7 text-xl font-semibold">
            导出当前筛选的结构化原始数据
          </h3>
          <div className="mt-4 flex flex-wrap gap-3">
            {V23_DATASETS.map((dataset) => (
              <Button
                key={dataset}
                variant="secondary"
                disabled={exporting}
                onClick={() => download(dataset)}
              >
                {exportLabels[dataset]}
              </Button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
