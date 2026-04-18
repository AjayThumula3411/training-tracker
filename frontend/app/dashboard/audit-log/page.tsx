"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { AuditLog } from "@/lib/types";

const formatAction = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const renderDetails = (details?: Record<string, unknown> | null) => {
  if (!details || Object.keys(details).length === 0) {
    return "No extra details";
  }

  return Object.entries(details)
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (char) => char.toUpperCase());

      if (value === null || value === undefined) {
        return `${label}: -`;
      }

      if (typeof value === "object") {
        return `${label}: ${JSON.stringify(value)}`;
      }

      return `${label}: ${String(value)}`;
    })
    .join(" | ");
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState("");
  const { user, loading } = useAuth();
  const router = useRouter();
  const hasAuditAccess = user?.role === "HR" || user?.role === "TEAM_LEAD";
  const accessError =
    !loading && user && !hasAuditAccess ? "Audit log is limited to HR and team leads." : "";

  const fetchLogs = useCallback(async () => {
    try {
      setError("");
      const res = await api.get("/audit-log");
      setLogs(res.data);
    } catch {
      setLogs([]);
      setError("Unable to load audit log. HR or Team Lead access is required.");
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (!hasAuditAccess) {
      return;
    }

    const loadLogs = async () => {
      await fetchLogs();
    };

    void loadLogs();
  }, [fetchLogs, hasAuditAccess, loading, router, user]);

  const groupedLogs = useMemo(() => logs, [logs]);

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="app-panel rounded-[28px] px-8 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">Loading audit history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />

      <main className="app-container space-y-6">
        <section className="app-panel rounded-[30px] px-6 py-6 md:px-8">
          <div className="page-header">
            <div className="page-header-main">
              <p className="page-header-kicker">Governance</p>
              <h1 className="page-header-title">Audit Log</h1>
              <p className="page-header-copy">
                Review operational activity, ownership changes, and workflow events across the workspace.
              </p>
            </div>
          </div>
        </section>

        {(accessError || error) && (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{accessError || error}</p>
        )}

        <section className="space-y-4">
          {groupedLogs.map((log) => (
            <article key={log.id} className="app-card rounded-[24px] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="badge bg-slate-100 text-slate-700">{formatAction(log.action)}</span>
                    <span className="text-xs font-medium text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-800">
                    {log.entity}
                    {log.entityId ? ` (${log.entityId.slice(0, 8)})` : ""}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{renderDetails(log.details)}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Actor: {log.actorId.slice(0, 8)}
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
