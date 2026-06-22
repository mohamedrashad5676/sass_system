"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email:"", password:"", firstName:"", lastName:"", accountType:"individual" as "individual"|"organization", orgName:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const res = await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    const data = await res.json();
    if (!res.ok){setError(data.error||"Registration failed");setLoading(false);return;}
    router.push("/dashboard");
  }

  const input = "w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500";
  const label = "block text-xs font-medium text-white/60 mb-1.5";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-sm font-bold">OM</div>
            <span className="font-semibold text-lg">Onmeeting</span>
          </Link>
          <h1 className="text-2xl font-bold text-white mt-4 mb-1">Create your account</h1>
        </div>
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>First name</label><input className={input} required value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))}/></div>
            <div><label className={label}>Last name</label><input className={input} required value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))}/></div>
          </div>
          <div><label className={label}>Email</label><input type="email" className={input} required value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
          <div><label className={label}>Password</label><input type="password" className={input} required minLength={8} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}/></div>
          <div>
            <label className={label}>Account type</label>
            <select className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" value={form.accountType} onChange={e=>setForm(f=>({...f,accountType:e.target.value as any}))}>
              <option value="individual">Individual</option>
              <option value="organization">Organization</option>
            </select>
          </div>
          {form.accountType==="organization"&&<div><label className={label}>Organization name</label><input className={input} value={form.orgName} onChange={e=>setForm(f=>({...f,orgName:e.target.value}))}/></div>}
          <button type="submit" disabled={loading} className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
            {loading?"Creating...":"Create account"}
          </button>
          <p className="text-center text-sm text-white/50">Already have an account? <Link href="/auth/login" className="text-blue-400">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
