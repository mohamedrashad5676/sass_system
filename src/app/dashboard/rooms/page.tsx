"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Room {
  id: string;
  name: string;
  seatModel: string;
  isActive: boolean;
  owner: { id: string; firstName: string; lastName: string; email: string };
  activeMeeting: { id: string; startedAt: string; startedBy: string } | null;
}

export default function RoomsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string>("");
  const [myRole, setMyRole] = useState<string>("member");
  const [createModal, setCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRooms = useCallback(async (accountId: string) => {
    const res = await fetch(`/api/rooms?accountId=${accountId}`);
    if (res.ok) {
      const data = await res.json();
      setRooms(data.rooms);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) { router.push("/auth/login"); return; }
        const data = await res.json();
        setMyUserId(data.user.id);
        const acct = data.accounts?.[0];
        if (!acct) { router.push("/dashboard"); return; }
        setAccount(acct);
        setMyRole(acct.role);
        await fetchRooms(acct.userAccount.id);
      } catch {
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, fetchRooms]);

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.userAccount.id, name: newRoomName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Room created successfully");
        setCreateModal(false);
        setNewRoomName("");
        await fetchRooms(account.userAccount.id);
      } else {
        showToast(data.error || "Failed to create room", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setCreating(false);
    }
  };

  const startMeeting = async (roomId: string) => {
    setActionLoading(roomId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/start`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast("Meeting started!");
        await fetchRooms(account.userAccount.id);
      } else {
        showToast(data.error || "Failed to start meeting", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const endMeeting = async (roomId: string) => {
    setActionLoading(roomId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/start`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast("Meeting ended");
        await fetchRooms(account.userAccount.id);
      } else {
        showToast(data.error || "Failed to end meeting", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const getSeatModelBadge = (model: string) => {
    if (model === "dedicated") return "bg-violet-500/15 text-violet-400 border-violet-500/30";
    if (model === "shared_pool") return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
    return "bg-gray-500/15 text-gray-400 border-gray-500/30";
  };

  const canManage = ["owner", "admin"].includes(myRole);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium shadow-xl transition-all ${
          toast.type === "success"
            ? "bg-green-900/80 border-green-500/40 text-green-300"
            : "bg-red-900/80 border-red-500/40 text-red-300"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col p-6">
          <div className="mb-8">
            <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Onmeeting
            </span>
          </div>
          <nav className="space-y-1 flex-1">
            {[
              { label: "Dashboard", href: "/dashboard", icon: "⊞" },
              { label: "Rooms", href: "/dashboard/rooms", icon: "🎥", active: true },
              { label: "Addons", href: "/dashboard/addons", icon: "⚡" },
              { label: "Members", href: "/dashboard/members", icon: "👥" },
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
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-white">Rooms</h1>
                <p className="text-gray-400 mt-1">
                  {rooms.length} room{rooms.length !== 1 ? "s" : ""} · {account?.userAccount?.name}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() => setCreateModal(true)}
                  className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                  + New Room
                </button>
              )}
            </div>

            {rooms.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-16 text-center">
                <div className="text-5xl mb-4">🎥</div>
                <h3 className="text-lg font-semibold text-white mb-2">No rooms yet</h3>
                <p className="text-gray-400 text-sm mb-6">
                  Create your first room to start hosting meetings
                </p>
                {canManage && (
                  <button
                    onClick={() => setCreateModal(true)}
                    className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    Create Room
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map((room) => {
                  const isActive = !!room.activeMeeting;
                  const isOwner = room.owner.id === myUserId;
                  const isLoading = actionLoading === room.id;

                  return (
                    <div
                      key={room.id}
                      className={`bg-gray-900 rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
                        isActive
                          ? "border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.08)]"
                          : "border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {isActive && (
                              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            )}
                            <h3 className="font-semibold text-white">{room.name}</h3>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getSeatModelBadge(room.seatModel)}`}>
                            {room.seatModel.replace("_", " ")}
                          </span>
                        </div>
                        {isActive && (
                          <span className="text-xs text-green-400 font-medium bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20">
                            Live
                          </span>
                        )}
                      </div>

                      {/* Owner */}
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold">
                          {room.owner.firstName[0]}{room.owner.lastName[0]}
                        </div>
                        <span className="text-xs text-gray-400">
                          {room.owner.firstName} {room.owner.lastName}
                          {isOwner && <span className="text-violet-400 ml-1">(you)</span>}
                        </span>
                      </div>

                      {/* Active meeting info */}
                      {isActive && room.activeMeeting && (
                        <div className="text-xs text-gray-400 bg-green-900/10 border border-green-500/15 rounded-lg px-3 py-2">
                          Started {new Date(room.activeMeeting.startedAt).toLocaleTimeString()}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-auto pt-2 border-t border-gray-800 flex gap-2">
                        {!isActive ? (
                          <button
                            onClick={() => startMeeting(room.id)}
                            disabled={isLoading}
                            className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                          >
                            {isLoading ? "Starting..." : "Start Meeting"}
                          </button>
                        ) : (
                          <button
                            onClick={() => endMeeting(room.id)}
                            disabled={isLoading}
                            className="flex-1 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                          >
                            {isLoading ? "Ending..." : "End Meeting"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create room modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Create New Room</h3>
              <button
                onClick={() => setCreateModal(false)}
                className="text-gray-500 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Room Name</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createRoom()}
                placeholder="e.g. Main Conference Room"
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500 placeholder-gray-600"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Rooms are created based on your plan's seat model ({account?.userAccount?.subscription?.plan?.seatModel?.replace("_", " ") || "—"}).
              </p>
            </div>
            <div className="p-6 border-t border-gray-800 flex gap-3 justify-end">
              <button
                onClick={() => setCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={createRoom}
                disabled={creating || !newRoomName.trim()}
                className="px-5 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
