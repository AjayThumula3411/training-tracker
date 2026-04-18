import Link from "next/link";
import { FaArrowRight, FaClipboardList, FaShieldAlt, FaUserCheck, FaUsers } from "react-icons/fa";

const platformStats = [
  { label: "Completion visibility", value: "94%", meta: "Track readiness across onboarding cohorts." },
  { label: "Open assignments", value: "128", meta: "Spot bottlenecks before they slow training velocity." },
  { label: "Audit coverage", value: "24/7", meta: "Keep role changes, invites, and updates fully traceable." },
];

const modules = [
  {
    title: "Operational dashboard",
    description: "Surface assignments, progress, and team workload in one executive-friendly view.",
    icon: <FaClipboardList />,
  },
  {
    title: "Profile intelligence",
    description: "Maintain developer skills, departments, training status, and review context without scattered notes.",
    icon: <FaUsers />,
  },
  {
    title: "Invite and access control",
    description: "Bring people into the workspace with role-based onboarding and faster setup flows.",
    icon: <FaUserCheck />,
  },
  {
    title: "Compliance trail",
    description: "Review actions and ownership changes with a clean audit history for leads and HR.",
    icon: <FaShieldAlt />,
  },
];

export default function Home() {
  return (
    <main className="app-shell">
      <section className="mx-auto max-w-[1200px] px-4 pb-10 pt-6 md:px-6 md:pt-8">
        <div className="premium-panel overflow-hidden rounded-[36px]">
          <div className="hero-grid px-6 py-8 md:px-10 md:py-10">
            <div className="space-y-6">
              <span className="premium-chip">
                <span className="premium-chip-dot" />
                Training Operations Platform
              </span>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-bold leading-tight text-slate-950 md:text-[3.8rem]">
                  Training Tracker
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                  Premium operational control for onboarding, assignments, profile intelligence, and audit-ready team coordination.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/login" className="btn-primary">
                  Open Workspace
                  <FaArrowRight />
                </Link>
                <Link href="/register" className="btn-secondary">
                  Create Account
                </Link>
              </div>

              <div className="kpi-row">
                {platformStats.map((item) => (
                  <div key={item.label} className="kpi-tile">
                    <p className="metric-label">{item.label}</p>
                    <p className="metric-value">{item.value}</p>
                    <p className="metric-meta">{item.meta}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="spotlight-card p-5 md:p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm font-medium text-slate-300">Live workspace snapshot</p>
                  <h2 className="text-2xl font-semibold">Training command view</h2>
                </div>
                <span className="badge bg-emerald-400/15 text-emerald-300">Healthy</span>
              </div>

              <div className="mt-5 space-y-4">
                <div className="glass-card-dark rounded-3xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">This week</p>
                      <p className="mt-1 text-3xl font-semibold">42 assignments</p>
                    </div>
                    <div className="rounded-2xl bg-blue-500/20 px-3 py-2 text-sm font-semibold text-blue-200">
                      +12% vs last week
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "In progress", value: "19" },
                      { label: "Ready for review", value: "11" },
                      { label: "Completed", value: "12" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl bg-white/6 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
                        <p className="mt-2 text-xl font-semibold">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 text-slate-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">Key workflow areas</p>
                      <h3 className="text-xl font-semibold">Built for HR and team leads</h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      Role-aware
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {modules.map((item) => (
                      <div
                        key={item.title}
                        className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 md:grid-cols-[40px_1fr]"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                          {item.icon}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-950">{item.title}</h4>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
