import { useState } from "react";
import { LockKeyhole, LoaderCircle, ShieldAlert } from "lucide-react";
import Card from "@/components/ui/Card";

export function AdminLogin({
  onSignIn,
}: {
  onSignIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await onSignIn(email.trim(), password);
    if (result.error) setError(result.error);
    setBusy(false);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-panel bg-forest-700 text-white"
          aria-hidden="true"
        >
          <LockKeyhole className="h-5 w-5" />
        </span>
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-sage-600">
            AIECQ · Research Admin
          </p>
          <h1 className="text-[1.1rem] font-semibold text-forest-800">
            研究管理后台
          </h1>
        </div>
      </div>

      <Card className="mt-7">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="admin-email"
              className="block text-[0.95rem] font-medium text-forest-800"
            >
              研究人员邮箱
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 min-h-13 w-full rounded-panel border border-sage-300 bg-white px-4 text-[1rem] outline-none transition focus:border-forest-700"
            />
          </div>
          <div>
            <label
              htmlFor="admin-password"
              className="block text-[0.95rem] font-medium text-forest-800"
            >
              密码
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 min-h-13 w-full rounded-panel border border-sage-300 bg-white px-4 text-[1rem] outline-none transition focus:border-forest-700"
            />
          </div>

          {error && (
            <p
              className="rounded-panel border border-alert-100 bg-alert-50 px-3.5 py-2.5 text-[0.9rem] text-alert-700"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-panel bg-forest-700 px-5 text-[1rem] font-semibold text-white transition hover:bg-forest-600 disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle
                className="h-5 w-5 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {busy ? "正在登录…" : "登录"}
          </button>
        </form>

        <div className="mt-5 rounded-panel border border-sage-200 bg-sage-50 px-3.5 py-3">
          <p className="text-[0.85rem] font-semibold text-forest-800">
            登录失败时依次排查
          </p>
          <ol className="mt-1.5 space-y-1 text-[0.82rem] leading-relaxed text-sage-700">
            <li>
              1. 账号是否已在 Supabase 的 Authentication → Users 中
              <strong className="font-semibold">确认邮箱</strong>
              （未确认的账号无法登录）
            </li>
            <li>2. 邮箱与密码是否与 Supabase 中创建的完全一致</li>
            <li>
              3. 若能登录但提示"无访问权限"，才是白名单问题 （需在数据表
              research_admins 中登记该邮箱）
            </li>
          </ol>
        </div>

        <p className="mt-5 border-t border-sage-200 pt-4 text-[0.85rem] leading-relaxed text-sage-700">
          <ShieldAlert
            className="mr-1.5 inline h-4 w-4 align-[-2px]"
            aria-hidden="true"
          />
          本后台仅限经研究团队明确授权的研究人员访问。账号由研究团队在 Supabase
          Auth 中创建， 并在数据库{" "}
          <code className="rounded bg-sage-100 px-1 py-0.5 font-mono text-[0.8rem]">
            research_admins
          </code>{" "}
          白名单中登记。系统不使用任何前端写死的密码。
        </p>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 拒绝访问
// ─────────────────────────────────────────────────────────────

export function AccessDenied({
  state,
  email = null,
}: {
  state: "unconfigured" | "signed-out" | "unauthorized";
  email?: string | null;
}) {
  const content: { title: string; detail: string } = {
    unconfigured: {
      title: "后台尚未配置",
      detail:
        "当前未配置 Supabase 连接，因此管理后台不开放。请在环境变量中配置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY，并在 Supabase 中执行数据库迁移与 RLS 策略后再使用。",
    },
    "signed-out": {
      title: "需要登录",
      detail: "请使用研究团队分配的账号登录。未经认证的访问一律被拒绝。",
    },
    unauthorized: {
      title: "无访问权限",
      detail:
        "您已登录，但该账号不在研究管理员白名单（research_admins）中，因此无法查看任何研究数据。如需权限，请联系研究团队负责人。",
    },
  }[state];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-12">
      <Card>
        <span
          className="flex h-12 w-12 items-center justify-center rounded-panel bg-champagne-100 text-champagne-800"
          aria-hidden="true"
        >
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-[1.3rem] font-semibold text-forest-800">
          {content.title}
        </h1>
        <p className="mt-2.5 text-[0.95rem] leading-8 text-sage-700">
          {content.detail}
        </p>
        {email && (
          <p className="mt-3 rounded-panel bg-sage-50 px-3.5 py-2.5 font-mono text-[0.85rem] text-sage-800">
            当前账号：{email}
          </p>
        )}
        <a
          href="/"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-panel border border-forest-700 px-5 text-[0.95rem] font-semibold text-forest-800 transition hover:bg-forest-50"
        >
          返回参与者首页
        </a>
      </Card>
    </div>
  );
}
