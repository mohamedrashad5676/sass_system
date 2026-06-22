"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Management {
  id: string;
  role: string;
  user: User;
  features: { featureKey: string; featureValue: string }[];
}

interface MemberFeature {
  featureKey: string;
  featureValue: string;
}

const FEATURE_PRESETS = [
  { key: "large_meeting", label: "Large Meeting Access", type: "boolean" },
  { key: "capacity_of_large_meeting", label: "Large Meeting Capacity", type: "select", options: ["500", "1000"] },
  { key: "crm_access", label: "CRM Access", type: "boolean" },
  { key: "recording_access", label: "Recording Access", type: "boolean" },
];

export default function MembersPage() {
  const router = useRouter();
  const [account, setAccount] = useState<any>(null);
  const [members, setMembers] = useState<Management[]>([]);
  const [myRole, setMyRole] = useState<string>("member");
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Management | null>(null);
  const [featureModal, setFeatureModal] = useState(false);
  const [featureForm, setFeatureForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMembers = useCallback(async (accountId: string) => {
    try {
      const res = await fetch(`/api/members?accountId=${accountId}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
        setMyRole(data.myRole);
      }
    } catch {}
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) { router.push("/auth/login"); return; }
        const data = await res.json();
        const acct = data.accounts?.[0];
        if (!acct) { router.push("/dashboard"); return; }
        setAccount(acct);
        await fetchMembers(acct.userAccount.id);
      } catch {
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, fetchMembers]);

  const openFeatureModal = async (member: Management) => {
    setSelectedMember(member);
    // Build feature form from existing features
    const initial: Record<string, string> = {};
    FEATURE_PRESETS.forEach((p) => {
      const existing = member.features.find((f) => f.featureKey === p.key);
      initial[p.key] = existing?.featureValue ?? (p.type === "boolean" ? "false" : "");
    });
    setFeatureForm(initial);
    setFeatureModal(true);
  };

  const saveFeatures = async () => {
    if (!selectedMember) return;
    setSaving(true);
    try {
      const features: MemberFeature[] = Object.entries(featureForm)
        .filter(([, v]) => v !== "" && v !== "false")
        .map(([featureKey, featureValue]) => ({ featureKey, featureValue }));

      const res = await fetch("/api/members/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managementId: selectedMember.id, features }),
      });

      if (res.ok) {
        showToast("Member permissions updated");
        setFeatureModal(false);
        await fetchMembers(account.userAccount.id);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to update permissions", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      admin: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      member: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };
    return colors[role] || colors.member;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canManage = ["owner", "admin"].includes(myRole);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg ${
          toast.type === "success"
            ? "bg-green-900/80 border-green-500/50 text-green-300"
            : "bg-red-900/80 border-red-500/50 text-red-300"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Sidebar */}
      <div className="flex h-screen">
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col p-6">
          <div className="mb-8">
            <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Onmeeting
            </span>
          </div>
          <nav className="space-y-1 flex-1">
            {[
              { label: "Dashboard", href: "/dashboard", icon: "⊞" },
              { label: "Addons", href: "/dashboard/addons", icon: "⚡" },
              { label: "Members", href: "/dashboard/members", icon: "👥", active: true },
              { label: "Invoices", href: "/dashboard/invoices", icon: "📄" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href="/dashboard"
            className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-2 transition-colors"
          >
            ← Back
          </a>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white">Team Members</h1>
              <p className="text-gray-400 mt-1">
                {account?.userAccount?.name} · {members.length} member{members.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Legend */}
            {canManage && (
              <div className="mb-6 p-4 bg-violet-900/20 border border-violet-500/20 rounded-xl">
                <p className="text-violet-300 text-sm">
                  <span className="font-semibold">Admin tip:</span> Click "Manage Permissions" on any member to grant them access to purchased addons like Large Meeting or CRM.
                </p>
              </div>
            )}

            {/* Members table */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_200px_140px] px-5 py-3 bg-gray-800/50 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">
                <span>Member</span>
                <span>Role</span>
                <span>Active Features</span>
                <span className="text-right">Actions</span>
              </div>

              {members.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-500">No members found</div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="grid grid-cols-[1fr_120px_200px_140px] px-5 py-4 border-b border-gray-800 last:border-0 items-center hover:bg-gray-800/30 transition-colors"
                  >
                    {/* Member info */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-sm font-bold">
                        {m.user.firstName[0]}{m.user.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {m.user.firstName} {m.user.lastName}
                        </p>
                        <p className="text-xs text-gray-400">{m.user.email}</p>
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getRoleBadge(m.role)}`}>
                        {m.role}
                      </span>
                    </div>

                    {/* Active features */}
                    <div className="flex flex-wrap gap-1.5">
                      {m.features.length === 0 ? (
                        <span className="text-xs text-gray-600">No features assigned</span>
                      ) : (
                        m.features
                          .filter((f) => f.featureValue !== "false")
                          .slice(0, 3)
                          .map((f) => (
                            <span
                              key={f.featureKey}
                              className="text-xs px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full"
                            >
                              {f.featureKey.replace(/_/g, " ")}
                            </span>
                          ))
                      )}
                      {m.features.filter((f) => f.featureValue !== "false").length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{m.features.filter((f) => f.featureValue !== "false").length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end">
                      {canManage && (
                        <button
                          onClick={() => openFeatureModal(m)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-violet-500/40 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/60 transition-colors font-medium"
                        >
                          Manage Permissions
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Feature modal */}
      {featureModal && selectedMember && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Manage Permissions
                  </h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {selectedMember.user.firstName} {selectedMember.user.lastName}
                  </p>
                </div>
                <button
                  onClick={() => setFeatureModal(false)}
                  className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {FEATURE_PRESETS.map((preset) => (
                <div key={preset.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{preset.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {preset.key === "large_meeting" && "Allow access to large meeting rooms"}
                      {preset.key === "capacity_of_large_meeting" && "Max participants for this member"}
                      {preset.key === "crm_access" && "Access to CRM module"}
                      {preset.key === "recording_access" && "Access to meeting recordings"}
                    </p>
                  </div>

                  {preset.type === "boolean" ? (
                    <button
                      onClick={() =>
                        setFeatureForm((prev) => ({
                          ...prev,
                          [preset.key]: prev[preset.key] === "true" ? "false" : "true",
                        }))
                      }
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        featureForm[preset.key] === "true" ? "bg-violet-600" : "bg-gray-700"
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          featureForm[preset.key] === "true" ? "translate-x-7" : "translate-x-1"
                        }`}
                      />
                    </button>
                  ) : (
                    <select
                      value={featureForm[preset.key] || ""}
                      onChange={(e) =>
                        setFeatureForm((prev) => ({ ...prev, [preset.key]: e.target.value }))
                      }
                      className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500"
                    >
                      <option value="">None</option>
                      {preset.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt} participants
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-gray-800 flex gap-3 justify-end">
              <button
                onClick={() => setFeatureModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveFeatures}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
