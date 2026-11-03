import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "../../lib/supabase/client";
import { getAccessToken } from "../admin/useAdminAuth";
import { INSTRUMENT_REVISION } from "./content";
import { V23_DATASETS, type V23Dataset, type V23Row } from "./analysis";
import AdminCharts from "./AdminCharts";

const exportLabels: Record<V23Dataset, string> = {
  v23_raw: "完整原始答卷 JSON",
  v23_answers: "各题答案与理解检查",
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
  const [readFailed, setReadFailed] = useState(false);
  const [type, setType] = useState("all"),
    [channel, setChannel] = useState("formal"),
    [revision, setRevision] = useState<string>(INSTRUMENT_REVISION),
    [exporting, setExporting] = useState(false);
  async function refresh() {
    setReadFailed(false);
    setLoading(true);
    setError("");
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error("Supabase 未配置，无法读取数据。");
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
            "V2.3 数据读取失败，请核对 0005 迁移、RLS 与管理员权限。",
          );
        if (!data?.length) break;
        all.push(...(data as V23Row[]));
        offset += data.length;
        if (offset > 100000)
          throw new Error("数据超过读取上限，请通过数据库导出。");
      }
      setRows(all);
    } catch (e) {
      setReadFailed(true);
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
  const selectClass =
    "mt-2 min-h-12 w-full rounded-panel border border-sage-300 bg-white px-3 text-base";
  return (
    <section aria-label="V2.3 独立统计" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">V2.3 问卷统计</h2>
          <p className="mt-2 text-sm leading-6 text-sage-700">
            所有图表与导出跟随下方筛选。仅统计已提交答卷，保留全部原始记录。
          </p>
        </div>
        <button
          disabled={loading}
          onClick={refresh}
          className="flex min-h-12 items-center gap-2 rounded-panel border border-forest-700 bg-white px-4 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "正在读取…" : "刷新数据"}
        </button>
      </div>
      <div className="grid gap-4 rounded-surface border border-sage-200 bg-white p-5 md:grid-cols-3">
        <label className="text-sm font-medium">
          问卷修订
          <select
            aria-label="问卷修订筛选"
            className={selectClass}
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
          >
            <option value={INSTRUMENT_REVISION}>2026-11-02 修订</option>
            <option value="legacy">修订前（旧 b4 / 随机授权）</option>
            <option value="all">全部修订（不宜混析）</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          受访者类型
          <select
            aria-label="受访者类型筛选"
            className={selectClass}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="all">全部</option>
            <option value="elder">老人版</option>
            <option value="caregiver">照护者版</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          样本渠道
          <select
            aria-label="样本渠道筛选"
            className={selectClass}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="formal">正式</option>
            <option value="pilot">预测试</option>
            <option value="test">功能测试</option>
            <option value="all">全部（混合渠道）</option>
          </select>
        </label>
      </div>
      {(revision === "all" || channel === "all") && (
        <p className="rounded-panel bg-champagne-100 p-4 text-sm text-champagne-800">
          当前合并了不同修订或渠道，仅供核查，不建议作为正式分析口径。
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-panel bg-alert-50 p-4 text-alert-700"
        >
          {error}{" "}
          {readFailed
            ? "未展示旧缓存统计；请刷新重试。"
            : "可重试导出，当前统计不受影响。"}
        </p>
      )}
      {loading ? (
        <p role="status" className="py-8">
          正在读取 V2.3 数据…
        </p>
      ) : (
        !readFailed && (
          <>
            <AdminCharts rows={filtered} />
            <section className="rounded-surface border border-sage-200 bg-white p-5 sm:p-6">
              <h3 className="text-xl font-semibold">结构化数据导出</h3>
              <p className="mt-2 text-sm leading-6 text-sage-700">
                CSV 支持
                Excel、R、Python；导出接口会再次核对登录与管理员权限。原始记录包含任务、配置及实际展示位置。
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {V23_DATASETS.map((dataset) => (
                  <button
                    key={dataset}
                    disabled={exporting}
                    onClick={() => download(dataset)}
                    className="flex min-h-20 items-center gap-3 rounded-panel border border-sage-200 p-4 text-left text-sm hover:bg-forest-50 disabled:opacity-60"
                  >
                    <Download className="h-5 w-5 shrink-0" />
                    {exportLabels[dataset]}
                  </button>
                ))}
              </div>
            </section>
          </>
        )
      )}
    </section>
  );
}
