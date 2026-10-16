import handler from '../../api/admin/export'
import { adaptLegacyHandler } from './_lib/adapter'

/**
 * Netlify Function：研究数据 CSV 导出。
 *
 * 路由：GET /api/admin/export?dataset=...（由 netlify.toml 的 redirects 转发）
 *
 * 与提交接口同理：鉴权（Bearer token → research_admins 白名单）与 CSV 生成
 * 全部复用 `api/admin/export.ts`，本文件只做协议适配。
 */
export default adaptLegacyHandler(handler, 'admin-export')
