import {
  Eye,
  UsersRound,
  Activity,
  Play,
  Bell,
  Film,
  UserRound,
  Building2,
  ArrowRight,
  Check,
  Clock,
} from "lucide-react";
import { ATTRIBUTE_COPY } from "./content";
import { PROFILES } from "../../data/profiles";
import type { ProfileId } from "../../types";

export function HighlightedCopy({ text }: { text: string }) {
  return (
    <>
      {text
        .split(
          /(简单提示|详细记录|活动记录或视频|指定的子女|签约的养老服务机构|基础判断|出现异常时|全天持续)/g,
        )
        .map((part, i) =>
          i % 2 ? (
            <strong key={i} className="font-semibold text-forest-900">
              {part}
            </strong>
          ) : (
            part
          ),
        )}
    </>
  );
}

/** A neutral schematic of a single attribute, never a prediction of safety. */
export function AttributeVisual({
  attribute,
  level,
}: {
  attribute: "X1" | "X2" | "X3";
  level: 0 | 1;
}) {
  const Icon =
    attribute === "X1"
      ? level
        ? Film
        : Bell
      : attribute === "X2"
        ? UserRound
        : Clock;
  return (
    <div
      className="survey-attribute-visual my-3 flex flex-wrap items-center gap-3"
      aria-label="设置示意"
    >
      <Icon className="h-7 w-7 shrink-0" aria-hidden="true" />
      {attribute === "X1" ? (
        <span className="font-semibold">
          {level ? "提示 + 事件记录 / 视频" : "活动正常 / 疑似跌倒"}
        </span>
      ) : attribute === "X2" ? (
        <>
          <span className="font-semibold">指定子女</span>
          {level === 1 && (
            <>
              <span aria-hidden="true">＋</span>
              <Building2 className="h-7 w-7" aria-hidden="true" />
              <span className="font-semibold">养老服务机构</span>
            </>
          )}
        </>
      ) : (
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex gap-1" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className={`h-3 flex-1 rounded-sm ${level || i >= 6 ? "bg-forest-700" : "bg-sage-200"}`}
              />
            ))}
          </div>
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            {level ? (
              "全天详细记录"
            ) : (
              <>
                基础识别 <ArrowRight className="h-4 w-4" aria-hidden="true" />{" "}
                异常时详细记录
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

export function ChoiceField({
  id,
  text,
  options,
  value,
  onChange,
}: {
  id: string;
  text: string;
  options: readonly string[];
  value: unknown;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="my-6 min-w-0">
      <legend className="survey-question mb-3 text-lg font-semibold leading-8 text-forest-900">
        {/^[ab](\d+|-check)$/.test(id) && (
          <span className="mr-2 text-sage-700">{id}</span>
        )}
        {text}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((label, i) => (
          <label
            key={label}
            className={`survey-option flex min-h-14 cursor-pointer items-center gap-3 rounded-panel border px-4 py-3 text-lg leading-7 ${value === i ? "border-forest-700 bg-forest-50 text-forest-900" : "border-sage-300 bg-white text-sage-800 hover:bg-sage-50"}`}
          >
            <input
              type="radio"
              name={id || text}
              checked={value === i}
              onChange={() => onChange(i)}
              className="h-5 w-5 shrink-0 accent-forest-700"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Configuration({
  id,
  title,
  other,
  selected,
  onSelect,
  onSimulation,
}: {
  id: ProfileId;
  title?: string;
  other?: ProfileId;
  selected?: boolean;
  onSelect?: () => void;
  onSimulation?: () => void;
}) {
  const p = PROFILES[id];
  return (
    <section
      className={`survey-configuration relative flex min-w-0 flex-col rounded-surface border bg-white p-5 ${selected ? "border-forest-700 ring-2 ring-forest-100" : "border-sage-200"}`}
    >
      {onSelect && (
        <input
          type="radio"
          name="dce-choice"
          aria-label={title}
          checked={!!selected}
          onChange={onSelect}
          className="survey-card-selector absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
      )}
      {title && (
        <h3 className="mb-4 text-xl font-semibold text-forest-900">{title}</h3>
      )}
      <dl className="space-y-3">
        {(["X1", "X2", "X3"] as const).map((k, i) => {
          const different = other && p[k] !== PROFILES[other][k],
            Icon = [Eye, UsersRound, Activity][i]!;
          return (
            <div
              key={k}
              data-attribute={k}
              data-level={p[k]}
              className={`survey-level rounded-panel p-4 ${p[k] === 1 ? "survey-level--expanded" : "survey-level--basic"} ${different ? "survey-level--different" : ""}`}
            >
              <dt
                className={`flex flex-wrap items-center gap-2 font-semibold text-forest-800 ${different ? "survey-difference-heading" : ""}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {ATTRIBUTE_COPY[k].question}
                {different && (
                  <span className="survey-difference-label ml-auto rounded-control px-2 py-1 text-base font-bold">
                    差异项
                  </span>
                )}
              </dt>
              <dd className="survey-description mt-2 text-lg leading-8 text-sage-800">
                <AttributeVisual attribute={k} level={p[k]} />
                <HighlightedCopy text={ATTRIBUTE_COPY[k].clauses[p[k]]} />
                {k === "X2" && p.X2 === 1 && (
                  <span className="block text-base">
                    （经审核、可上门服务的养老公司）
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {(onSelect || onSimulation) && (
        <div className="mt-auto space-y-3 pt-5">
          {onSelect && (
            <span
              aria-hidden="true"
              className="flex min-h-12 items-center justify-center gap-2 font-semibold text-forest-800"
            >
              {selected && <Check className="h-5 w-5" />}
              {selected ? "已选择" : "点击此方案任意位置选择"}
            </span>
          )}
          {onSimulation && (
            <button
              type="button"
              onClick={onSimulation}
              className="relative z-20 flex min-h-12 w-full items-center justify-center gap-2 rounded-panel text-forest-800 hover:bg-forest-50"
            >
              <Play className="h-4 w-4" />
              <span>
                展开动态模拟帮助理解
                <span className="whitespace-nowrap">（可选）</span>
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function RatingField({
  id,
  text,
  value,
  onChange,
}: {
  id: string;
  text: string;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="my-7 min-w-0">
      <legend className="survey-question mb-3 text-lg font-semibold leading-8">
        {text}
      </legend>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className={`flex min-h-14 cursor-pointer items-center justify-center gap-1 rounded-panel border text-lg font-semibold ${value === n ? "border-forest-700 bg-forest-50 text-forest-900" : "border-sage-300 text-sage-800 hover:bg-sage-50"}`}
          >
            <input
              type="radio"
              className="h-4 w-4 accent-forest-700"
              name={id}
              checked={value === n}
              aria-label={`${n} 分${n === 1 ? "，完全不同意" : n === 5 ? "，完全同意" : ""}`}
              onChange={() => onChange(n)}
            />
            {n}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
