"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Account { managementId: string; role: string; account: { id: string; type: string; name: string; subscription: { status: string; plan: string; renewDate: string } | null; walletBalance: string } }
interface User { id: string; email: string; firstName: string; lastName: string; isAdmin: boolean; accounts: Account[] }

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400 bg-green-400/10",
  past_due: "text-yellow-400 bg-yellow-400/10",
  suspended: "text-red-400 bg-red-400/10",
  cancel_pending: "text-orange-400 bg-orange-400/10",
  cancelled: "text-gray-400 bg-gray-400/10",
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then(r => {
      if (!r.ok) { router.push("/auth/login"); return; }
      return r.json();
    }).then(d => { if (d) setUser(d.user); }).finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/auth/login");
  }

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-white/50">Loading...</div></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Sidebar */}
      <div className="flex">
        <aside className="w-60 min-h-screen bg-slate-900 border-r border-white/10 p-5 flex flex-col fixed top-0 left-0">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center text-xs font-bold">OM</div>
            <span className="font-semibold">Onmeeting</span>
          </div>
          <nav className="flex flex-col gap-1 flex-1">
            <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/10 text-sm font-medium">
              <span>📊</span> Dashboard
            </Link>
            <Link href="/billing" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors">
              <span>💳</span> Billing
            </Link>
            <Link href="/dashboard/addons" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors">
              <span>🔌</span> Add-ons
            </Link>
            <Link href="/dashboard/rooms" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors">
              <span>🎥</span> Rooms
            </Link>
            <Link href="/dashboard/members" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors">
              <span>👥</span> Members
            </Link>
            <Link href="/dashboard/invoices" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors">
              <span>📄</span> Invoices
            </Link>
            {user.isAdmin && (
              <Link href="/admin" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-yellow-400 hover:text-yellow-300 transition-colors mt-4">
                <span>⚙️</span> Admin Panel
              </Link>
            )}
          </nav>
          <button onClick={handleLogout} className="text-left text-sm text-white/50 hover:text-white px-3 py-2 transition-colors">← Sign out</button>
        </aside>

        {/* Main content */}
        <main className="ml-60 flex-1 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Hey, {user.firstName} 👋</h1>
              <p className="text-white/50 text-sm mt-0.5">{user.email}</p>
            </div>
          </div>

          {/* Accounts */}
          <div className="space-y-4">
            {(user as any).accounts?.map((m: Account) => (
              <div key={m.managementId} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-semibold">{m.account.name}</span>
                      <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full capitalize">{m.role}</span>
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full capitalize">{m.account.type}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/50 mb-1">Wallet balance</div>
                    <div className="text-2xl font-bold">${parseFloat(m.account.walletBalance || "0").toFixed(2)}</div>
                  </div>
                </div>

                {m.account.subscription ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="text-xs text-white/50 mb-1">Plan</div>
                      <div className="font-semibold">{m.account.subscription.plan}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="text-xs text-white/50 mb-1">Status</div>
                      <span className={`text-sm font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[m.account.subscription.status] || ""}`}>
                        {m.account.subscription.status}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="text-xs text-white/50 mb-1">Renews</div>
                      <div className="font-semibold text-sm">{new Date(m.account.subscription.renewDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm mb-0.5">No active subscription</div>
                      <div className="text-xs text-white/50">Choose a plan to get started</div>
                    </div>
                    <Link href="/billing" className="bg-blue-500 hover:bg-blue-400 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                      Choose plan
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
