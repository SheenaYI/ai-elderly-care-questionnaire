import handler from '../../api/submit-survey'
import { adaptLegacyHandler } from './_lib/adapter'

/**
 * Netlify Function：问卷提交。
 *
 * 路由：POST /api/submit-survey（由 netlify.toml 的 redirects 转发到本函数）
 *
 * 本文件刻意保持"薄"：所有校验、版本检查、重复提交检查与写库逻辑都在
 * `api/submit-survey.ts` 中，Netlify 与 Vercel 共用同一份实现，
 * 不存在两套逻辑漂移的风险。
 */
export default adaptLegacyHandler(handler, 'submit-survey')

/**
 * 把 handler 的具名导出再导出，便于自动化测试直接从 Netlify 入口导入
 * （例如重置限流桶）。生产代码不依赖这些导出。
 */
export { __resetRateLimiterForTests } from '../../api/submit-survey'
