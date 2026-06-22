"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AddonsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [planAddons, setPlanAddons] = useState<any[]>([]);
  const [activeAddons, setActiveAddons] = useState<any[]>([]);
  const [selectedAddon, setSelectedAddon] = useState<any>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<Record<string,any>>({});
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r=>{ if(!r.ok){router.push("/auth/login");return;} return r.json(); }).then(d=>{
      if(!d) return;
      setUser(d.user);
      const acct = d.user?.accounts?.[0];
      if(!acct) return;
      const planId = acct.userAccount?.subscription?.planId;
      const sub = acct.userAccount?.subscription;
      if(sub) setActiveAddons(sub.addonItems||[]);
      if(planId) fetch(`/api/addons?planId=${planId}`).then(r=>r.json()).then(d=>setPlanAddons(d.addons||[]));
    }).finally(()=>setLoading(false));
  },[router]);

  async function purchase() {
    if(!selectedAddon||!user) return;
    setPurchasing(true); setMsg("");
    const acct = user.accounts?.[0];
    if(!acct) return;
    const res = await fetch("/api/addons/purchase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      accountId: acct.userAccount.id, planAddonId: selectedAddon.id, runtimeConfig, couponCode: couponCode||undefined,
    })});
    const data = await res.json();
    if(!res.ok) setMsg(data.error||"Failed");
    else { setMsg("Addon purchased!"); setSelectedAddon(null); }
    setPurchasing(false);
  }

  const renderConfigField = (key: string, schema: any) => {
    if(schema.type==="enum") return (
      <div key={key}>
        <label className="block text-xs text-white/60 mb-1">{schema.label}</label>
        <select className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm" onChange={e=>setRuntimeConfig(c=>({...c,[key]:parseInt(e.target.value)||e.target.value}))}>
          <option value="">Select</option>
          {schema.options.map((o:any)=><option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
    if(schema.type==="text") return (
      <div key={key}>
        <label className="block text-xs text-white/60 mb-1">{schema.label}</label>
        <input className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm" onChange={e=>setRuntimeConfig(c=>({...c,[key]:e.target.value}))}/>
      </div>
    );
    if(schema.type==="number") return (
      <div key={key}>
        <label className="block text-xs text-white/60 mb-1">{schema.label}</label>
        <input type="number" min={schema.min||1} className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm" onChange={e=>setRuntimeConfig(c=>({...c,[key]:parseInt(e.target.value)}))}/>
      </div>
    );
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="flex">
        <aside className="w-60 min-h-screen bg-slate-900 border-r border-white/10 p-5 flex flex-col fixed top-0 left-0">
          <div className="flex items-center gap-2 mb-8"><div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center text-xs font-bold">OM</div><span className="font-semibold">Onmeeting</span></div>
          <nav className="flex flex-col gap-1">
            <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors"><span>📊</span> Dashboard</Link>
            <Link href="/billing" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors"><span>💳</span> Billing</Link>
            <Link href="/dashboard/addons" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/10 text-sm font-medium"><span>🔌</span> Add-ons</Link>
            <Link href="/dashboard/members" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors"><span>👥</span> Members</Link>
            <Link href="/dashboard/invoices" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 hover:text-white transition-colors"><span>📄</span> Invoices</Link>
          </nav>
        </aside>
        <main className="ml-60 flex-1 p-8">
          <h1 className="text-2xl font-bold mb-6">Add-ons</h1>
          {loading ? <div className="text-white/50">Loading...</div> : (
            <>
              {activeAddons.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">Active Add-ons</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeAddons.map((a:any) => (
                      <div key={a.id} className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{a.planAddon?.addon?.name}</div>
                          <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Active</span>
                        </div>
                        <div className="text-xs text-white/40 mt-1">Expires {new Date(a.endTime).toLocaleDateString()}</div>
                        <div className="text-xs text-white/30 mt-0.5">{JSON.stringify(a.runtimeConfig)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">Available Add-ons</h2>
              {planAddons.length === 0 && <div className="text-white/30 py-8 text-center text-sm">No addons available for your current plan. <Link href="/billing" className="text-blue-400">Upgrade your plan</Link></div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {planAddons.map((pa:any) => {
                  const manifest = pa.addon?.manifest as any;
                  return (
                    <div key={pa.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium">{pa.addon?.name}</div>
                          <div className="text-xs text-white/40 capitalize">{manifest?.type} addon</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">${parseFloat(pa.price).toFixed(0)}<span className="text-xs text-white/40">/mo</span></div>
                        </div>
                      </div>
                      <button onClick={()=>{setSelectedAddon(pa);setRuntimeConfig({});setMsg("");}} className="w-full mt-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm py-2 rounded-lg transition-colors">
                        Configure & Purchase
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Purchase Modal */}
              {selectedAddon && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
                  <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-md">
                    <h3 className="font-bold text-lg mb-4">Purchase: {selectedAddon.addon?.name}</h3>
                    {msg && <div className={`text-sm px-3 py-2 rounded-lg mb-4 ${msg.includes("!")?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400"}`}>{msg}</div>}
                    <div className="space-y-3 mb-4">
                      {Object.entries((selectedAddon.addon?.manifest as any)?.config_schema || {}).map(([key, schema]) => renderConfigField(key, schema))}
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Coupon code (optional)</label>
                        <input className="w-full bg-slate-700 border border-white/10 text-white rounded-lg px-3 py-2 text-sm" value={couponCode} onChange={e=>setCouponCode(e.target.value)} placeholder="SAVE20"/>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>setSelectedAddon(null)} className="flex-1 border border-white/10 text-white/60 py-2 rounded-lg text-sm hover:bg-white/5">Cancel</button>
                      <button onClick={purchase} disabled={purchasing} className="flex-1 bg-blue-500 hover:bg-blue-400 text-white py-2 rounded-lg text-sm disabled:opacity-50">
                        {purchasing?"Purchasing...":"Confirm Purchase"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
