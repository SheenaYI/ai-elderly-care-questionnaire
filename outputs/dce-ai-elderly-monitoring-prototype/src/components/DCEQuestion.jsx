import { Info, LockKeyhole, ShieldCheck } from 'lucide-react'
import SchemeCard from './SchemeCard'
import { SCHEME_LIST } from '../data/schemes'

function DCEQuestion({
  selectedSchemeId,
  onSelectScheme,
  onOpenSimulation,
  onConfirm,
}) {
  return (
    <section aria-labelledby="page-title">
      <header className="rounded-2xl bg-forest-800 px-5 py-6 text-white shadow-card sm:px-8 sm:py-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="max-w-2xl">
            <h1 id="page-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              AI养老监测系统配置选择
            </h1>
            <p className="mt-3 text-base leading-7 text-forest-50 sm:text-lg">
              请比较两种假设性系统配置，并选择您更愿意长期采用的一种。
            </p>
          </div>
          <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-medium text-forest-50 ring-1 ring-inset ring-white/15">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-200" aria-hidden="true" />
            第1题 / 共12题
          </div>
        </div>
      </header>

      <section
        className="mt-5 rounded-2xl bg-white px-5 py-6 shadow-card sm:px-8 sm:py-7"
        aria-labelledby="scenario-title"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-sage-100 p-2 text-forest-700" aria-hidden="true">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="max-w-4xl">
            <h2 id="scenario-title" className="text-lg font-semibold text-sage-700 sm:text-xl">
              研究情景说明
            </h2>
            <p className="mt-2.5 text-[15px] leading-7 text-slate-700 sm:text-base">
              假设您正在为自己或家中的老人选择一套AI居家养老监测系统。所有系统都能够持续进行基础异常识别，例如识别疑似跌倒、长时间异常静止等情况。
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="本题比较的属性">
          {[
            ['①', '能查看什么信息'],
            ['②', '谁可以查看信息'],
            ['③', '平时如何进行详细监测和记录'],
          ].map(([number, label]) => (
            <div key={number} className="flex items-center gap-2.5 rounded-xl bg-sage-50 px-3.5 py-3 text-sm text-sage-700">
              <span className="font-semibold text-forest-700">{number}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[15px] leading-7 text-slate-700 sm:text-base">
          您可以点击“查看模拟情景”，了解系统在正常状态和异常事件发生时的表现。请根据您更愿意长期采用哪一种配置作出选择。
        </p>

        <div className="mt-5 flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-700" role="note">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>以下均为研究中的假设性系统配置，模拟情景不代表真实AI识别结果。</p>
        </div>
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-2" role="radiogroup" aria-label="请选择更愿意长期采用的系统配置">
        {SCHEME_LIST.map((scheme) => (
          <SchemeCard
            key={scheme.id}
            scheme={scheme}
            isSelected={scheme.id === selectedSchemeId}
            onSelect={() => onSelectScheme(scheme.id)}
            onOpenSimulation={() => onOpenSimulation(scheme.id)}
          />
        ))}
      </div>

      <section
        className="mt-7 rounded-2xl bg-white px-5 py-6 shadow-card sm:px-8 sm:py-7"
        aria-labelledby="choice-title"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-sage-100 p-2 text-forest-700" aria-hidden="true">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <h2 id="choice-title" className="text-lg font-semibold text-sage-700 sm:text-xl">
              您更愿意长期采用哪一种AI养老监测系统？
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              请选择一项后确认。本原型不会提交或上传真实问卷数据。
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite">
          {SCHEME_LIST.map((scheme) => {
            const isSelected = selectedSchemeId === scheme.id
            return (
              <button
                type="button"
                key={scheme.id}
                onClick={() => onSelectScheme(scheme.id)}
                className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-left text-base transition-colors ${
                  isSelected
                    ? 'border-forest-700 bg-forest-50 font-semibold text-forest-800'
                    : 'border-sage-200 bg-sage-50/60 text-slate-700 hover:border-sage-500 hover:bg-sage-50'
                }`}
                aria-pressed={isSelected}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isSelected ? 'border-forest-700' : 'border-sage-500'
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-forest-700" />}
                </span>
                {scheme.label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedSchemeId}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-forest-800 px-5 py-3.5 text-base font-semibold text-white shadow-card transition hover:bg-forest-700 disabled:cursor-not-allowed disabled:bg-sage-200 disabled:text-sage-500 disabled:shadow-none sm:w-auto sm:min-w-44"
        >
          确认选择
        </button>
      </section>
    </section>
  )
}

export default DCEQuestion
