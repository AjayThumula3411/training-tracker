"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FaBell, FaChartLine, FaClipboardList, FaShieldAlt, FaUsers } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Notification as AppNotification } from "@/lib/types";

const formatRole = (role?: string) =>
  role
    ? role
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Workspace User";

export default function Navbar() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const navigation = useMemo(() => {
    const links = [
      { href: "/dashboard", label: "Overview", icon: <FaChartLine /> },
      { href: "/dashboard/tasks", label: "Tasks", icon: <FaClipboardList /> },
    ];

    if (user?.role === "HR" || user?.role === "TEAM_LEAD") {
      links.push({ href: "/dashboard/profiles", label: "Profiles", icon: <FaUsers /> });
      links.push({ href: "/dashboard/audit-log", label: "Audit", icon: <FaShieldAlt /> });
    }

    if (user?.role === "HR") {
      links.push({ href: "/dashboard/users", label: "Users", icon: <FaUsers /> });
    }

    return links;
  }, [user?.role]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const res = await api.get("/notifications");
      setNotifications(res.data);
    } catch {
      setNotifications([]);
    }
  }, [user]);

  useEffect(() => {
    const loadNotifications = async () => {
      await fetchNotifications();
    };

    void loadNotifications();
  }, [fetchNotifications]);

  const handleLogout = async () => {
    await api.post("/auth/logout");
    window.localStorage.removeItem("auth_token");
    setUser(null);
    router.replace("/login");
  };

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    fetchNotifications();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-900/8 bg-[linear-gradient(180deg,rgba(248,251,255,0.92),rgba(255,255,255,0.8))] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#050816,#0f1f4d_52%,#0f766e_120%)] text-sm font-bold text-white shadow-[0_18px_30px_rgba(2,6,23,0.28)]">
              TT
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Workspace
              </p>
              <h1 className="font-display text-[1.05rem] font-bold leading-tight text-slate-950">
                Training Tracker
              </h1>
            </div>
          </Link>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center lg:flex">
          <nav className="flex items-center justify-center gap-1.5 rounded-full border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,247,255,0.88))] p-1 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            {navigation.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative inline-flex min-w-[108px] items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border border-[#c9d8ff] bg-[linear-gradient(135deg,#f8fbff,#edf4ff_45%,#eefcf9)] text-slate-950 shadow-[0_12px_26px_rgba(37,99,235,0.16)]"
                      : "text-slate-600 hover:bg-[linear-gradient(135deg,#f8fafc,#eff6ff)] hover:text-slate-950"
                  }`}
                >
                  <span className={`nav-icon text-sm ${active ? "text-cyan-700" : "text-slate-500"}`}>{item.icon}</span>
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <div className="relative">
            <button
              onClick={() => setOpen((value) => !value)}
              className="relative flex h-10 w-10 items-center justify-center rounded-[18px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,247,255,0.88))] text-slate-600 shadow-[0_14px_28px_rgba(15,23,42,0.08)] transition hover:border-slate-200 hover:text-slate-950"
              aria-label="Notifications"
            >
              <FaBell />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-3 w-[320px] overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,#f7fbff)] shadow-[0_24px_50px_rgba(15,23,42,0.18)]">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Notifications</p>
                  <p className="text-xs text-slate-500">Latest updates for your workspace</p>
                </div>
                <div className="max-h-80 overflow-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No notifications yet.</p>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => markRead(item.id)}
                        className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
                          item.read ? "bg-white text-slate-500" : "bg-blue-50/70 text-slate-900"
                        }`}
                      >
                        <p className="text-sm font-medium">{item.message}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="hidden min-w-[72px] rounded-[18px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,247,255,0.88))] px-4 py-2 shadow-[0_14px_28px_rgba(15,23,42,0.08)] md:block">
            <p className="text-sm font-semibold leading-none text-slate-900">{user?.name || "User"}</p>
            <p className="mt-1 text-xs leading-none text-slate-400">{formatRole(user?.role)}</p>
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center rounded-[18px] border border-[#d7e2f3] bg-[linear-gradient(135deg,#ffffff,#f4f8ff)] px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_14px_28px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-[#c9d8ff]"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
