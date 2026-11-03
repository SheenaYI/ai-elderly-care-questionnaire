import { LogOut } from "lucide-react";
import { useAdminAuth } from "./useAdminAuth";
import { AdminLogin, AccessDenied } from "./AdminAuthViews";
import V23AdminPanel from "../surveyV23/AdminPanel";

export default function AdminPage() {
  const { state, signIn, signOut } = useAdminAuth();
  if (state.status === "loading")
    return (
      <p role="status" className="p-8">
        正在验证访问权限…
      </p>
    );
  if (state.status === "unconfigured")
    return <AccessDenied state="unconfigured" />;
  if (state.status === "signed-out") return <AdminLogin onSignIn={signIn} />;
  if (state.status === "unauthorized")
    return <AccessDenied state="unauthorized" email={state.email} />;
  return (
    <div className="min-h-screen bg-cream-100 text-forest-900">
      <header className="border-b border-sage-200 bg-white">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold">研究数据管理后台</h1>
          <div className="flex flex-wrap items-center gap-4">
            <span className="break-all text-sm text-sage-700">
              {state.email}
            </span>
            <button
              onClick={signOut}
              className="flex min-h-12 items-center gap-2 rounded-panel border border-sage-300 px-4 hover:bg-sage-50"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-content px-4 py-7 sm:px-6 lg:px-8">
        <V23AdminPanel />
      </main>
    </div>
  );
}
