import { Link } from 'react-router-dom'
import { ALL_CONFIGURABLE_FIELDS, RESEARCH_INSTITUTION } from '@/data/placeholders'
import { STUDY_CODE, STUDY_TITLE, QUESTIONNAIRE_VERSION } from '@/data/questionnaire'

/** 页脚：声明研究用途、版本号，并展示未配置字段（不编造）。 */
export default function SiteFooter() {
  const institution = RESEARCH_INSTITUTION.pending
    ? RESEARCH_INSTITUTION.placeholder
    : RESEARCH_INSTITUTION.value!

  return (
    <footer className="border-t border-sage-200 bg-cream-100/70">
      <div className="mx-auto w-full max-w-content px-4 py-8 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[0.95rem] font-semibold text-forest-800">{STUDY_TITLE}</p>
            <p className="mt-1.5 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-sage-600">
              {STUDY_CODE} · {QUESTIONNAIRE_VERSION}
            </p>
            <p className="mt-3 text-[0.88rem] leading-relaxed text-sage-700">
              本研究仅用于学术研究。参与完全自愿，可随时退出。本站的AI监测为研究情景模拟，
              不会开启摄像头，不进行真实养老监控。
            </p>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-sage-700">{institution}</p>
          </div>

          <nav className="flex shrink-0 flex-col gap-1.5" aria-label="页脚导航">
            <Link to="/privacy" className="text-[0.92rem] text-forest-700 underline decoration-sage-300 underline-offset-4 hover:decoration-forest-700">
              隐私与知情同意
            </Link>
            <Link to="/about" className="text-[0.92rem] text-forest-700 underline decoration-sage-300 underline-offset-4 hover:decoration-forest-700">
              研究介绍
            </Link>
            <Link to="/experience" className="text-[0.92rem] text-forest-700 underline decoration-sage-300 underline-offset-4 hover:decoration-forest-700">
              情景体验
            </Link>
          </nav>
        </div>

        {ALL_CONFIGURABLE_FIELDS.some((f) => f.pending) && (
          <p className="mt-6 rounded-panel border border-champagne-200 bg-champagne-50 px-3.5 py-2.5 text-[0.82rem] leading-relaxed text-champagne-800">
            本页部分信息（如研究联系人、数据保存期限、伦理审批编号）仍待研究团队补充确认，
            已在相应位置以
            <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-[0.78rem] text-champagne-800">
              [待填写：…]
            </code>
            标注，未作编造。
          </p>
        )}
      </div>
    </footer>
  )
}
