"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then(r=>{
      if(!r.ok){router.push("/auth/login");return;}
      return r.json();
    }).then(d=>{
      if(!d) return;
      const firstAccount = d.user?.accounts?.[0]?.userAccount?.id;
      if(firstAccount){
        setAccountId(firstAccount);
        return fetch(`/api/invoices?accountId=${firstAccount}`).then(r=>r.json());
      }
    }).then(d=>{ if(d) setInvoices(d.invoices||[]); }).finally(()=>setLoading(false));
  },[router]);

  const TYPE_COLORS: Record<string,string> = { subscription:"text-blue-400", addon:"text-purple-400", topup:"text-green-400", refund:"text-red-400" };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="flex">
        <aside className="w-60 min-h-screen bg-slate-900 border-r border-white/10 p-5 flex flex-col fixed top-0 left-0">
          <div className="flex items-center gap-2 mb-8"><div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center text-xs font-bold">OM</div><span className="font-semibold">Onmeeting</span></div>
          <nav className="flex flex-col gap-1 flex-1">
            <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors"><span>📊</span> Dashboard</Link>
            <Link href="/billing" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors"><span>💳</span> Billing</Link>
            <Link href="/dashboard/addons" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors"><span>🔌</span> Add-ons</Link>
            <Link href="/dashboard/members" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors"><span>👥</span> Members</Link>
            <Link href="/dashboard/invoices" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/10 text-sm font-medium"><span>📄</span> Invoices</Link>
          </nav>
        </aside>
        <main className="ml-60 flex-1 p-8">
          <h1 className="text-2xl font-bold mb-6">Invoices</h1>
          {loading ? <div className="text-white/50">Loading...</div> : (
            <div className="space-y-3">
              {invoices.length === 0 && <div className="text-white/30 text-center py-16">No invoices yet</div>}
              {invoices.map(inv => (
                <div key={inv.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium capitalize ${TYPE_COLORS[inv.type]||""}`}>{inv.type}</span>
                      <span className="text-xs text-white/30">#{inv.id.slice(-8)}</span>
                    </div>
                    <div className="text-sm text-white/60">{new Date(inv.createdAt).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</div>
                    <div className="text-xs text-white/40 mt-0.5">{inv.items?.map((i:any)=>i.name).join(", ")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">${parseFloat(inv.totalPrice).toFixed(2)}</div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.paymentStatus==="paid"?"text-green-400 bg-green-400/10":"text-red-400 bg-red-400/10"}`}>{inv.paymentStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
