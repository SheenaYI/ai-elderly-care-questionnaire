#!/usr/bin/env node
/**
 * Supabase 连接与认证诊断脚本（本地运行，不依赖 Netlify）。
 *
 * 用途：当 /admin 登录失败时，绕过网页直接向 Supabase 验证，
 *       并明确告诉你失败属于哪一类。
 *
 * 用法：
 *   1. 在项目根目录创建 .env，填入：
 *        VITE_SUPABASE_URL=https://xxxx.supabase.co
 *        VITE_SUPABASE_ANON_KEY=eyJ...
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...     （可选，用于校验白名单）
 *   2. 运行：
 *        node scripts/check-supabase.mjs 你的邮箱
 *   3. 按提示输入密码（不会回显、不会被打印、不会被保存）。
 *
 * 安全说明：
 *   - 密码通过终端隐藏输入，脚本**不打印**密码、token 或密钥。
 *   - 只输出错误码与结论，便于对照排查。
 *   - 不会写入任何文件。
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'

// ── 1. 读取 .env（不依赖 dotenv，避免多装一个包）─────────────────────────
function loadEnv() {
  const file = '.env'
  if (!existsSync(file)) {
    console.error('✗ 找不到 .env 文件。请先复制 .env.example 为 .env 并填入值。')
    process.exit(1)
  }
  const env = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    // 去掉可能的引号
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

// ── 2. 隐藏输入 ────────────────────────────────────────────────────────
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    const onData = (char) => {
      if (['\n', '\r', '\u0004'].includes(char.toString())) {
        process.stdin.removeListener('data', onData)
      } else {
        // 阻止密码回显
        process.stdout.clearLine?.(0)
        process.stdout.cursorTo?.(0)
        process.stdout.write(question)
      }
    }
    process.stdin.on('data', onData)
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

let failed = false
const ok = (msg) => console.log(`  ✓ ${msg}`)
const bad = (msg) => { failed = true; console.log(`  ✗ ${msg}`) }
const warn = (msg) => console.log(`  ! ${msg}`)

// ── 3. 检查配置 ────────────────────────────────────────────────────────
console.log('\n【1】检查 .env 配置')
if (!url) bad('缺少 VITE_SUPABASE_URL（或 SUPABASE_URL）')
else if (/your-project-ref|example\.com/i.test(url)) {
  bad('URL 仍是 .env.example 里的占位符，请换成真实的 Project URL')
} else if (/\/(rest|auth|storage|realtime|functions)\/v1/i.test(url)) {
  // 这是实测中真实发生过的错误：从 API 页面复制了 "RESTful endpoint"，
  // 它带 /rest/v1 后缀。supabase-js 会在 base URL 后面直接拼 /auth/v1，
  // 于是请求变成 https://x.supabase.co/rest/v1/auth/v1 → 404/401，
  // 登录失败而界面会显示成"密码错误"。
  bad(`URL 带了服务路径后缀，必须去掉：${url}`)
  console.log('  → 只保留到域名：https://<ref>.supabase.co')
  console.log('  → 因为 supabase-js 会自己拼 /auth/v1、/rest/v1，带了后缀会变成 /rest/v1/auth/v1')
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
  warn(`VITE_SUPABASE_URL 格式可疑：${url}`)
  warn('  正常形如 https://abcdefgh.supabase.co（不要带 /rest/v1/ 等后缀）')
} else ok(`URL 格式正确：${url}`)

if (!anonKey) bad('缺少 VITE_SUPABASE_ANON_KEY（登录必须用它，不能用 service_role）')
else if (/your-anon|your-service|keep-it-server/i.test(anonKey)) bad('anon key 仍是占位符，请填入真实值')
else if (!anonKey.startsWith('eyJ')) bad('VITE_SUPABASE_ANON_KEY 看起来不像 JWT（应以 eyJ 开头）')
else ok('anon key 已填写')

if (!serviceKey) warn('未填写 SUPABASE_SERVICE_ROLE_KEY —— 将跳过白名单检查')
else if (/your-anon|your-service|keep-it-server/i.test(serviceKey)) bad('service key 仍是占位符，请填入真实值')
else ok('service key 已填写（仅用于读取白名单）')

const serviceLooksLikeAnon = serviceKey && anonKey && serviceKey === anonKey
if (serviceLooksLikeAnon) bad('service_role 与 anon key 完全相同——很可能复制错了行')

if (failed) { console.log('\n请先修好配置再继续。\n'); process.exit(1) }

// ── 4. 连通性 + anon key 是否被项目接受 ────────────────────────────────
console.log('\n【2】检查能否连到 Supabase，以及 anon key 是否被该项目接受')

// 4a. 项目是否存活（不校验 key）
try {
  const health = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, {
    headers: { apikey: anonKey },
    signal: AbortSignal.timeout(10000),
  })
  if (health.status >= 500) {
    bad(`认证服务返回 HTTP ${health.status} —— 项目可能已被暂停`)
    console.log('  → 免费项目长期无访问会被暂停。到 Supabase 控制台执行 Restore 后重试。\n')
    process.exit(1)
  }
  ok(`认证服务可达（HTTP ${health.status}）`)
} catch (e) {
  bad(`无法连接：${e instanceof Error ? e.message : String(e)}`)
  console.log('  → 检查网络、代理，或 VITE_SUPABASE_URL 是否填写正确。\n')
  process.exit(1)
}

// 4b. 用一个需要鉴权的端点验证 anon key。
//     这是最容易被忽略的一环：url 和 key 来自不同项目时，
//     登录会返回 401，而页面会误报"密码错误"。
try {
  const probe = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    signal: AbortSignal.timeout(10000),
  })
  if (probe.status === 401 || probe.status === 403) {
    bad(`anon key 被该项目拒绝（HTTP ${probe.status}）`)
    console.log('  → 说明 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY 不是同一个项目的，')
    console.log('     或 key 复制不完整（漏了尾部字符）。')
    console.log('  → 对照 Supabase → Project Settings → API：URL 与 anon public 必须同属一个项目。')
    console.log('  → 另外确认用的是 anon public，而不是 service_role。\n')
    process.exit(1)
  }
  if (probe.ok) {
    const settings = await probe.json().catch(() => null)
    ok('anon key 被项目接受')
    if (settings && settings.external) {
      const emailOn = settings.external.email === true
      if (emailOn) ok('项目已启用邮箱密码登录')
      else {
        bad('项目未启用邮箱密码登录（external.email = false）')
        console.log('  → Authentication → Sign In / Providers → 启用 Email。\n')
        process.exit(1)
      }
    }
  } else {
    warn(`anon key 探测返回 HTTP ${probe.status}（继续，但请留意）`)
  }
} catch (e) {
  warn(`无法完成 anon key 探测：${e instanceof Error ? e.message : String(e)}`)
}

// ── 5. 尝试登录 ────────────────────────────────────────────────────────
const email = process.argv[2]
if (!email) {
  console.log('\n【3】登录测试')
  warn('未提供邮箱，跳过登录测试。')
  console.log('  用法：node scripts/check-supabase.mjs 你的邮箱\n')
  process.exit(0)
}

console.log(`\n【3】用 ${email} 尝试登录`)
const password = await askHidden('  请输入密码（不会显示）：')
if (!password) {
  bad('未输入密码')
  process.exit(1)
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } })
const { data, error } = await supabase.auth.signInWithPassword({ email, password })

if (error) {
  bad(`登录失败：code=${error.code ?? 'unknown'} status=${error.status ?? 'n/a'}`)
  console.log('\n  可能原因与处理：')
  const code = error.code ?? ''
  if (code === 'email_not_confirmed') {
    console.log('   → 邮箱未确认。Supabase → Authentication → Users → 确认该用户，')
    console.log('     或删除后重建并勾选 Auto Confirm User。')
  } else if (code === 'over_request_rate_limit') {
    console.log('   → 尝试过于频繁，等约 1 分钟再试。')
  } else if (code === 'email_provider_disabled' || code === 'signup_disabled') {
    console.log('   → 未启用邮箱密码登录。Authentication → Sign In / Providers → 启用 Email。')
  } else if (code === 'user_banned') {
    console.log('   → 账号被禁用。')
  } else if (code === 'user_not_found' || error.status === 400) {
    console.log('   → 邮箱不存在于 Authentication → Users，或密码错误。')
    console.log('     先确认该用户存在；忘记密码可在该用户菜单里 Reset password。')
  } else {
    console.log('   → 把上面这行 code 发出来以便进一步判断。')
  }
  process.exit(1)
}

ok('登录成功')
console.log(`    用户 ID：${data.user?.id}`)
console.log(`    邮箱已确认：${data.user?.email_confirmed_at ? '是' : '否（异常，应已确认才能登录）'}`)

// ── 6. 白名单检查 ──────────────────────────────────────────────────────
console.log('\n【4】检查是否在研究管理员白名单中')
const { data: isAdmin, error: rpcError } = await supabase.rpc('is_research_admin')
if (rpcError) {
  bad(`无法调用 is_research_admin()：code=${rpcError.code ?? 'unknown'}`)
  console.log('   → 可能数据库还没执行 schema.sql，或该函数被误删。')
} else if (isAdmin === true) {
  ok('在白名单中 —— 可以访问 /admin 后台')
} else {
  bad('登录成功但**不在白名单** → 后台会显示"无访问权限"')
  console.log('   → 在 Supabase SQL Editor 执行：')
  console.log(`     insert into public.research_admins (email) values ('${email}') on conflict do nothing;`)
}

await supabase.auth.signOut()

// ── 7. 总结 ────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(56))
console.log(failed ? '结论：仍有问题，见上面的 ✗ 项。' : '结论：配置与权限都正常，可以正常使用后台。')
console.log('─'.repeat(56) + '\n')
process.exit(failed ? 1 : 0)
