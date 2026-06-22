import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-sm font-bold">OM</div>
          <span className="font-semibold text-lg">Onmeeting</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm text-white/70 hover:text-white transition-colors">Sign in</Link>
          <Link href="/auth/register" className="text-sm bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded-lg transition-colors font-medium">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-block text-xs font-medium bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full mb-6 border border-blue-500/30">
          Seats. Rooms. Control.
        </div>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          Video conferencing<br />
          <span className="text-blue-400">built for teams that scale</span>
        </h1>
        <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10">
          Dedicated seats for focused work. Shared rooms for flexible teams. One platform with enterprise billing that actually makes sense.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/auth/register" className="bg-blue-500 hover:bg-blue-400 text-white px-8 py-3.5 rounded-xl font-semibold transition-colors">
            Start free trial
          </Link>
          <Link href="/billing" className="border border-white/20 hover:border-white/40 text-white/80 hover:text-white px-8 py-3.5 rounded-xl transition-colors">
            View plans
          </Link>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="max-w-6xl mx-auto px-8 pb-24">
        <h2 className="text-2xl font-semibold text-center mb-10 text-white/80">Plans for every team size</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: "Starter", type: "Individual", price: "$50", desc: "1 dedicated room, 50 participants, 10 GB storage" },
            { name: "Starter Plus", type: "Individual", price: "$150", desc: "1 dedicated room, 100 participants, 50 GB storage, unlimited meetings" },
            { name: "Team", type: "Organization", price: "$300", desc: "Dedicated seats per member, 100 GB storage, role-based access" },
            { name: "Business", type: "Organization", price: "$500", desc: "Shared room pool, 500 GB storage, Extra Users addon" },
          ].map((plan) => (
            <div key={plan.name} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-blue-500/50 transition-colors">
              <div className="text-xs text-blue-300 font-medium mb-2">{plan.type}</div>
              <div className="text-xl font-bold mb-1">{plan.name}</div>
              <div className="text-3xl font-bold text-blue-400 mb-3">{plan.price}<span className="text-sm font-normal text-white/50">/mo</span></div>
              <p className="text-sm text-white/60">{plan.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-6">
          <Link href="/billing" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            Compare all plans & features →
          </Link>
        </div>
      </section>
    </main>
  );
}
