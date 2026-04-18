"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaArrowRight,
  FaChartLine,
  FaClipboardList,
  FaShieldAlt,
  FaUserTie,
  FaUsersCog,
} from "react-icons/fa";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { DashboardSummary } from "@/lib/types";

const roleLabel = (role?: string) =>
  role
    ? role
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Workspace User";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    const loadDashboard = async () => {
      try {
        setError("");
        const res = await api.get("/dashboard");
        setSummary(res.data);
      } catch {
        setError("Unable to load live dashboard data.");
      }
    };

    void loadDashboard();
  }, [user]);

  const metrics = useMemo(
    () => [
      {
        label: "Total tasks",
        value: summary ? String(summary.metrics.totalTasks) : "--",
        meta: "All visible work items in your current role scope",
      },
      {
        label: "Completed",
        value: summary ? `${summary.metrics.completedTasks}` : "--",
        meta: "Approved or finished tasks in your visible queue",
      },
      {
        label: "Feedback",
        value: summary ? `${summary.metrics.feedbackCount}` : "--",
        meta: "Recent feedback items available in your workspace",
      },
    ],
    [summary]
  );

  const quickActions = [
    {
      title: "My Tasks",
      description: "Track ownership, due dates, and status updates from a cleaner task view.",
      icon: <FaClipboardList />,
      href: "/dashboard/tasks",
      visible: true,
      accent: "from-blue-500/15 to-cyan-400/15 text-blue-700",
    },
    {
      title: "Profiles",
      description: "Review team skill coverage, training progress, and individual context.",
      icon: <FaUserTie />,
      href: "/dashboard/profiles",
      visible: user?.role === "HR" || user?.role === "TEAM_LEAD",
      accent: "from-emerald-500/15 to-teal-400/15 text-emerald-700",
    },
    {
      title: "Users",
      description: "Manage invites, access roles, and onboarding flow for the whole workspace.",
      icon: <FaUsersCog />,
      href: "/dashboard/users",
      visible: user?.role === "HR",
      accent: "from-violet-500/15 to-fuchsia-400/15 text-violet-700",
    },
    {
      title: "Audit Log",
      description: "Inspect operational events and role-sensitive changes with traceability.",
      icon: <FaShieldAlt />,
      href: "/dashboard/audit-log",
      visible: user?.role === "HR" || user?.role === "TEAM_LEAD",
      accent: "from-amber-500/15 to-orange-400/15 text-amber-700",
    },
  ].filter((item) => item.visible);

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="app-panel w-full max-w-md rounded-[28px] p-8 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-blue-100" />
          <p className="mt-4 text-sm font-medium text-slate-500">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />

      <main className="app-container space-y-6">
        <section className="premium-panel overflow-hidden rounded-[32px]">
          <div className="hero-grid px-6 py-6 md:px-8 md:py-8">
            <div className="space-y-5">
              <span className="premium-chip">
                <span className="premium-chip-dot" />
                Dashboard
              </span>
              <div className="page-header-main">
                <h1 className="section-heading">Welcome back, {user?.name || "Team Member"}</h1>
                <p className="page-header-copy max-w-2xl text-base">
                  Keep training operations moving with one place to manage assignments, profiles, and the workflow signals that matter most.
                </p>
              </div>

              <div className="kpi-row">
                {metrics.map((item) => (
                  <div key={item.label} className="kpi-tile kpi-tile-strong">
                    <p className="metric-label">{item.label}</p>
                    <p className="metric-value">{item.value}</p>
                    <p className="metric-meta">{item.meta}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="spotlight-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-300">Signed in as</p>
                  <h2 className="font-display mt-1 text-3xl font-bold">{user?.name}</h2>
                  <p className="mt-2 text-sm text-slate-400">{roleLabel(user?.role)}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-xl">
                  <FaChartLine />
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {[
                  { label: "Department", value: user?.department || "Not added yet" },
                  {
                    label: "Skills",
                    value: user?.skills?.length ? user.skills.slice(0, 3).join(", ") : "No skills added",
                  },
                  {
                    label: "Pending approvals",
                    value: summary ? String(summary.metrics.pendingApprovals) : "0",
                  },
                  {
                    label: "Training completion",
                    value: summary ? `${summary.metrics.trainingCompletionRate}%` : `${user?.trainingProgress ?? 0}%`,
                  },
                  {
                    label: "MFA",
                    value:
                      user?.mfaEnabled && user?.mfaMethod === "EMAIL_OTP"
                        ? "Email OTP required"
                        : "Not configured",
                  },
                ].map((item) => (
                  <div key={item.label} className="glass-card-dark rounded-2xl px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-100">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Workspace modules</p>
              <h2 className="font-display mt-2 text-3xl font-bold text-slate-950">Navigate the core workflows</h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {quickActions.map((item) => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="premium-panel group rounded-[26px] p-6 text-left transition hover:-translate-y-1"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent}`}
                >
                  <span className="text-xl">{item.icon}</span>
                </div>
                <h3 className="font-display mt-5 text-[1.8rem] font-bold text-slate-950">{item.title}</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{item.description}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                  Open section
                  <FaArrowRight className="transition group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {summary && (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="premium-panel rounded-[26px] p-6">
              <div className="section-topline">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Recent tasks</p>
                  <p className="section-subtitle mt-2">Fresh work items moving through your workspace.</p>
                </div>
                <div className="soft-stat hidden md:block">
                  <p className="soft-stat-label">Visible</p>
                  <p className="soft-stat-value">{summary.recentTasks.length}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {summary.recentTasks.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent tasks to show.</p>
                ) : (
                  summary.recentTasks.map((task) => (
                    <div key={task.id} className="list-card">
                      <p className="font-semibold text-slate-900">{task.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{task.assignedTo?.name || "Unassigned"}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="premium-panel rounded-[26px] p-6">
              <div className="section-topline">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Recent feedback</p>
                  <p className="section-subtitle mt-2">Latest coaching, review, and collaboration signals.</p>
                </div>
                <div className="soft-stat hidden md:block">
                  <p className="soft-stat-label">Items</p>
                  <p className="soft-stat-value">{summary.recentFeedback.length}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {summary.recentFeedback.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent feedback to show.</p>
                ) : (
                  summary.recentFeedback.map((item) => (
                    <div key={item.id} className="list-card">
                      <p className="text-sm leading-6 text-slate-700">{item.content}</p>
                      <p className="mt-2 text-xs text-slate-400">{item.author?.name || "System"}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
