"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Plan {
  id: string; name: string; accountType: string; seatModel: string;
  priceMonthly: string; priceAnnual: string;
  details: { maxParticipants: number; storageGb: number; maxMeetingDurationMin: number | null; meetingQuotaDays: number | null; baseSeatCount: number | null; baseRoomPoolSize: number | null } | null;
  addons: Array<{ id: string; addon: { name: string } }>;
}

const PLAN_FEATURES: Record<string, string[]> = {
  "Starter": ["1 dedicated room", "50 participants max", "10 GB storage", "Meeting duration quota", "1 hr per session"],
  "Starter Plus": ["1 dedicated room", "100 participants max", "50 GB storage", "Meeting duration quota", "Unlimited meeting length", "Large Meeting addon", "Log Storage addon"],
  "Team": ["Dedicated rooms per member", "100 participants max", "100 GB storage", "Unlimited meetings", "Role-based access", "Large Meeting addon"],
  "Business": ["Shared room pool", "100 participants max", "500 GB storage", "Unlimited meetings", "Role-based access", "Extra Users addon"],
  "Enterprise": ["Dedicated + Shared hybrid", "100 participants max", "1,000 GB storage", "Unlimited meetings", "All addons available", "Custom pricing"],
};

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [filter, setFilter] = useState<"all" | "individual" | "organization">("all");

  useEffect(() => {
    fetch(`/api/plans${filter !== "all" ? `?accountType=${filter}` : ""}`)
      .then(r => r.json())
      .then(d => setPlans(d.plans || []));
  }, [filter]);

  const filtered = plans.filter(p => filter === "all" || p.accountType === filter);
  const savings = (p: Plan) => {
    const monthly = parseFloat(p.priceMonthly) * 12;
    const annual = parseFloat(p.priceAnnual);
    return Math.round(((monthly - annual) / monthly) * 100);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center text-xs font-bold">OM</div>
          <span className="font-semibold">Onmeeting</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm text-white/60 hover:text-white">Sign in</Link>
          <Link href="/auth/register" className="text-sm bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded-lg transition-colors">Get started</Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Plans & Pricing</h1>
          <p className="text-white/50 text-lg">Choose the right plan for your team</p>

          {/* Billing cycle toggle */}
          <div className="inline-flex items-center bg-white/5 rounded-xl p-1 mt-6 border border-white/10">
            <button onClick={() => setCycle("monthly")} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${cycle === "monthly" ? "bg-blue-500 text-white" : "text-white/60 hover:text-white"}`}>Monthly</button>
            <button onClick={() => setCycle("annual")} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${cycle === "annual" ? "bg-blue-500 text-white" : "text-white/60 hover:text-white"}`}>
              Annual <span className={`text-xs px-1.5 py-0.5 rounded ${cycle === "annual" ? "bg-white/20" : "bg-green-500/20 text-green-400"}`}>Save up to 17%</span>
            </button>
          </div>

          {/* Account type filter */}
          <div className="inline-flex items-center gap-2 mt-4 ml-4">
            {(["all", "individual", "organization"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}>{f}</button>
            ))}
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {filtered.map((plan) => {
            const price = cycle === "annual" ? (parseFloat(plan.priceAnnual) / 12).toFixed(0) : parseFloat(plan.priceMonthly).toFixed(0);
            const isPopular = plan.name === "Business";
            const savePct = savings(plan);
            const features = PLAN_FEATURES[plan.name] || [];

            return (
              <div key={plan.id} className={`relative rounded-2xl p-6 border flex flex-col ${isPopular ? "bg-blue-600/20 border-blue-500" : "bg-white/5 border-white/10"}`}>
                {isPopular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium bg-blue-500 text-white px-3 py-1 rounded-full">Most popular</div>}
                <div>
                  <div className="text-xs font-medium text-white/50 mb-1 capitalize">{plan.accountType}</div>
                  <div className="text-lg font-bold mb-1">{plan.name}</div>
                  {plan.name === "Enterprise" ? (
                    <div className="text-2xl font-bold mb-4">Custom</div>
                  ) : (
                    <div className="mb-4">
                      <span className="text-3xl font-bold">${price}</span>
                      <span className="text-white/50 text-sm">/mo</span>
                      {cycle === "annual" && savePct > 0 && <div className="text-xs text-green-400 mt-0.5">Save {savePct}% annually</div>}
                    </div>
                  )}
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-white/70">
                      <span className="text-blue-400 mt-0.5 flex-shrink-0">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register" className={`block text-center text-sm font-medium py-2.5 rounded-xl transition-colors ${isPopular ? "bg-blue-500 hover:bg-blue-400 text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}>
                  {plan.name === "Enterprise" ? "Contact us" : "Get started"}
                </Link>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="col-span-5 text-center text-white/30 py-16">Loading plans...</div>}
        </div>
      </div>
    </div>
  );
}
