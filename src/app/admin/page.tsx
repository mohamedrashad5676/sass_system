"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"plans"|"addons"|"coupons">("plans");
  const [plans, setPlans] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Plan form
  const [planForm, setPlanForm] = useState({ name:"", accountType:"individual", seatModel:"dedicated", priceMonthly:"", priceAnnual:"", maxParticipants:"100", storageGb:"50", meetingQuotaDays:"", maxMeetingDurationMin:"", baseSeatCount:"", baseRoomPoolSize:"" });
  
  // Addon form
  const [addonForm, setAddonForm] = useState({ name:"", type:"resource" });
  
  // Coupon form
  const [couponForm, setCouponForm] = useState({ code:"", discountType:"percentage", discountValue:"", maxGlobalUses:"", maxPerUserUses:"", expiresAt:"" });

  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r=>{
      if(!r.ok){ router.push("/auth/login"); return; }
      return r.json();
    }).then(d=>{
      if(!d?.user?.isAdmin){ router.push("/dashboard"); return; }
      setUser(d.user);
      fetch("/api/admin/plans").then(r=>r.json()).then(d=>setPlans(d.plans||[]));
      fetch("/api/admin/addons").then(r=>r.json()).then(d=>setAddons(d.addons||[]));
    }).finally(()=>setLoading(false));
  },[router]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const res = await fetch("/api/admin/plans",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      name:planForm.name, accountType:planForm.accountType, seatModel:planForm.seatModel,
      priceMonthly:parseFloat(planForm.priceMonthly), priceAnnual:parseFloat(planForm.priceAnnual),
      details:{ maxParticipants:parseInt(planForm.maxParticipants), storageGb:parseInt(planForm.storageGb),
        meetingQuotaDays:planForm.meetingQuotaDays?parseInt(planForm.meetingQuotaDays):undefined,
        maxMeetingDurationMin:planForm.maxMeetingDurationMin?parseInt(planForm.maxMeetingDurationMin):undefined,
        baseSeatCount:planForm.baseSeatCount?parseInt(planForm.baseSeatCount):undefined,
        baseRoomPoolSize:planForm.baseRoomPoolSize?parseInt(planForm.baseRoomPoolSize):undefined,
      }
    })});
    const data = await res.json();
    if(!res.ok) setMsg(data.error||"Failed");
    else { setMsg("Plan created!"); fetch("/api/admin/plans").then(r=>r.json()).then(d=>setPlans(d.plans||[])); }
  }

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const res = await fetch("/api/admin/coupons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      code:couponForm.code, discountType:couponForm.discountType, discountValue:parseFloat(couponForm.discountValue),
      maxGlobalUses:couponForm.maxGlobalUses?parseInt(couponForm.maxGlobalUses):undefined,
      maxPerUserUses:couponForm.maxPerUserUses?parseInt(couponForm.maxPerUserUses):undefined,
      expiresAt:couponForm.expiresAt||undefined,
    })});
    const data = await res.json();
    if(!res.ok) setMsg(data.error||"Failed");
    else setMsg("Coupon created!");
  }

  if(loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center"><div className="text-white/50">Loading...</div></div>;

  const input = "w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500";
  const label = "block text-xs font-medium text-white/60 mb-1";

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="flex">
        <aside className="w-60 min-h-screen bg-slate-900 border-r border-white/10 p-5 fixed top-0 left-0">
          <div className="flex items-center gap-2 mb-8"><div className="w-7 h-7 rounded-md bg-yellow-500 flex items-center justify-center text-xs font-bold">⚙</div><span className="font-semibold">Admin Panel</span></div>
          <nav className="flex flex-col gap-1">
            <Link href="/dashboard" className="text-sm text-white/50 hover:text-white px-3 py-2">← Back to dashboard</Link>
            {(["plans","addons","coupons"] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} className={`text-left px-3 py-2 rounded-lg text-sm capitalize transition-colors ${tab===t?"bg-white/10 text-white font-medium":"text-white/60 hover:text-white"}`}>{t}</button>
            ))}
          </nav>
        </aside>
        <main className="ml-60 flex-1 p-8">
          {msg && <div className={`text-sm px-4 py-3 rounded-lg mb-6 ${msg.includes("!")?"bg-green-500/10 text-green-400 border border-green-500/20":"bg-red-500/10 text-red-400 border border-red-500/20"}`}>{msg}</div>}

          {tab === "plans" && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Plans</h1>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h2 className="font-semibold mb-4">Create Plan</h2>
                  <form onSubmit={createPlan} className="space-y-3">
                    <div><label className={label}>Name</label><input className={input} required value={planForm.name} onChange={e=>setPlanForm(f=>({...f,name:e.target.value}))}/></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={label}>Account type</label>
                        <select className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm" value={planForm.accountType} onChange={e=>setPlanForm(f=>({...f,accountType:e.target.value}))}>
                          <option value="individual">Individual</option><option value="organization">Organization</option>
                        </select>
                      </div>
                      <div><label className={label}>Seat model</label>
                        <select className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm" value={planForm.seatModel} onChange={e=>setPlanForm(f=>({...f,seatModel:e.target.value}))}>
                          <option value="dedicated">Dedicated</option><option value="shared_pool">Shared Pool</option><option value="hybrid">Hybrid</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={label}>Monthly price ($)</label><input type="number" className={input} required value={planForm.priceMonthly} onChange={e=>setPlanForm(f=>({...f,priceMonthly:e.target.value}))}/></div>
                      <div><label className={label}>Annual price ($)</label><input type="number" className={input} required value={planForm.priceAnnual} onChange={e=>setPlanForm(f=>({...f,priceAnnual:e.target.value}))}/></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={label}>Max participants</label><input type="number" className={input} value={planForm.maxParticipants} onChange={e=>setPlanForm(f=>({...f,maxParticipants:e.target.value}))}/></div>
                      <div><label className={label}>Storage (GB)</label><input type="number" className={input} value={planForm.storageGb} onChange={e=>setPlanForm(f=>({...f,storageGb:e.target.value}))}/></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={label}>Meeting quota (days)</label><input type="number" className={input} placeholder="blank = unlimited" value={planForm.meetingQuotaDays} onChange={e=>setPlanForm(f=>({...f,meetingQuotaDays:e.target.value}))}/></div>
                      <div><label className={label}>Max duration (min)</label><input type="number" className={input} placeholder="blank = unlimited" value={planForm.maxMeetingDurationMin} onChange={e=>setPlanForm(f=>({...f,maxMeetingDurationMin:e.target.value}))}/></div>
                    </div>
                    <button type="submit" className="w-full bg-blue-500 hover:bg-blue-400 text-white py-2.5 rounded-xl text-sm font-medium">Create Plan</button>
                  </form>
                </div>
                <div>
                  <h2 className="font-semibold mb-4">Existing Plans ({plans.length})</h2>
                  <div className="space-y-2">
                    {plans.map(p=>(
                      <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                        <div><div className="font-medium text-sm">{p.name}</div><div className="text-xs text-white/40 capitalize">{p.accountType} · {p.seatModel}</div></div>
                        <div className="text-right"><div className="text-sm font-semibold">${parseFloat(p.priceMonthly).toFixed(0)}/mo</div><div className="text-xs text-white/40">${parseFloat(p.priceAnnual).toFixed(0)}/yr</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "addons" && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Add-ons</h1>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h2 className="font-semibold mb-4">Register Add-on</h2>
                  <p className="text-xs text-white/40 mb-4">Add-ons use a manifest-driven system. Use the API directly with the full manifest JSON for production registration.</p>
                  <div className="bg-slate-800 rounded-xl p-4 text-xs text-white/60 font-mono">
                    POST /api/admin/addons<br/>
                    {"{"}<br/>
                    &nbsp;&nbsp;"name": "Large Meeting Capacity",<br/>
                    &nbsp;&nbsp;"manifest": {"{ ...full manifest... }"}<br/>
                    {"}"}
                  </div>
                </div>
                <div>
                  <h2 className="font-semibold mb-4">Registered Add-ons ({addons.length})</h2>
                  <div className="space-y-2">
                    {addons.map((a:any)=>(
                      <div key={a.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <div className="font-medium text-sm">{a.name}</div>
                        <div className="text-xs text-white/40 mt-0.5">Available on: {a.planAddons?.map((pa:any)=>pa.plan?.name).join(", ")||"No plans"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "coupons" && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Coupons</h1>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-lg">
                <h2 className="font-semibold mb-4">Create Coupon</h2>
                <form onSubmit={createCoupon} className="space-y-3">
                  <div><label className={label}>Code</label><input className={input} required value={couponForm.code} onChange={e=>setCouponForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="SAVE20"/></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={label}>Type</label>
                      <select className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm" value={couponForm.discountType} onChange={e=>setCouponForm(f=>({...f,discountType:e.target.value}))}>
                        <option value="percentage">Percentage</option><option value="fixed">Fixed ($)</option>
                      </select>
                    </div>
                    <div><label className={label}>Value</label><input type="number" className={input} required value={couponForm.discountValue} onChange={e=>setCouponForm(f=>({...f,discountValue:e.target.value}))}/></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={label}>Global max uses</label><input type="number" className={input} placeholder="unlimited" value={couponForm.maxGlobalUses} onChange={e=>setCouponForm(f=>({...f,maxGlobalUses:e.target.value}))}/></div>
                    <div><label className={label}>Per user max uses</label><input type="number" className={input} placeholder="unlimited" value={couponForm.maxPerUserUses} onChange={e=>setCouponForm(f=>({...f,maxPerUserUses:e.target.value}))}/></div>
                  </div>
                  <div><label className={label}>Expires at (optional)</label><input type="datetime-local" className={input} value={couponForm.expiresAt} onChange={e=>setCouponForm(f=>({...f,expiresAt:e.target.value}))}/></div>
                  <button type="submit" className="w-full bg-blue-500 hover:bg-blue-400 text-white py-2.5 rounded-xl text-sm font-medium">Create Coupon</button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
