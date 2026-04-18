"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import TaskTable from "@/components/TaskTable";
import AssignTaskModal from "@/components/AssignTaskModal";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Task } from "@/lib/types";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/tasks");
      setTasks(res.data);
    } catch (err) {
      console.error("Error fetching tasks", err);
      setError("Unable to load tasks right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const loadTasks = async () => {
      await fetchTasks();
    };

    void loadTasks();
  }, [authLoading, fetchTasks, router, user]);

  const summary = useMemo(
    () => [
      { label: "Open tasks", value: tasks.length.toString().padStart(2, "0") },
      { label: "In progress", value: tasks.filter((task) => task.status === "IN_PROGRESS").length.toString().padStart(2, "0") },
      { label: "Completed", value: tasks.filter((task) => task.status === "COMPLETED").length.toString().padStart(2, "0") },
    ],
    [tasks]
  );

  const roleInsight = useMemo(() => {
    if (user?.role === "HR") {
      return {
        label: "Control scope",
        value: "Create, assign, and review work",
        meta: "Create tasks, assign developers, manage task details, and review submitted work.",
      };
    }

    if (user?.role === "TEAM_LEAD") {
      return {
        label: "Control scope",
        value: "Review and approval control",
        meta: "Review submitted work, request revisions, and close reviewed tasks from the queue.",
      };
    }

    return {
      label: "Control scope",
      value: "Execution workflow",
      meta: "Move your own assigned work from progress to review.",
    };
  }, [user?.role]);

  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="app-panel rounded-[28px] px-8 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">Loading your task workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />

      <main className="app-container space-y-6">
        <section className="premium-panel section-card rounded-[30px] px-6 py-6 md:px-8">
          <div className="page-header">
            <div className="page-header-main">
              <p className="page-header-kicker">Task Management</p>
              <h1 className="page-header-title">My Tasks</h1>
              <p className="page-header-copy">
                Review active assignments, move work through the documented flow, and keep delivery ownership current.
              </p>
            </div>

            {user?.role === "HR" && (
              <div className="page-header-actions">
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    setShowModal(true);
                  }}
                  className="btn-primary"
                >
                  Assign Task
                </button>
              </div>
            )}
          </div>

          <div className="kpi-row mt-6">
            {summary.map((item) => (
              <div key={item.label} className="kpi-tile">
                <p className="metric-label">{item.label}</p>
                <p className="metric-value">{item.value}</p>
              </div>
            ))}            
          </div>
        </section>

        <section className="info-strip">
          <div className="info-chip">
            <p className="info-chip-label">{roleInsight.label}</p>
            <p className="info-chip-value">{roleInsight.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{roleInsight.meta}</p>
          </div>
          <div className="info-chip">
            <p className="info-chip-label">Review Queue</p>
            <p className="info-chip-value">{tasks.filter((task) => task.status === "SUBMITTED").length} waiting</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Submitted work that needs manager attention.</p>
          </div>
          <div className="info-chip">
            <p className="info-chip-label">Revision Loop</p>
            <p className="info-chip-value">{tasks.filter((task) => task.status === "NEEDS_REVISION").length} returned</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Tasks currently blocked on follow-up changes.</p>
          </div>
        </section>

        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        {loading ? (
          <div className="app-card rounded-[26px] p-8 text-center text-sm text-slate-500">Loading tasks...</div>
        ) : (
          <TaskTable
            tasks={tasks}
            currentUserRole={user?.role}
            currentUserId={user?.id}
            onRefresh={fetchTasks}
            onEdit={(task) => {
              setSelectedTask(task);
              setShowModal(true);
            }}
          />
        )}

        {showModal && (
          <AssignTaskModal
            task={selectedTask}
            onClose={() => {
              setShowModal(false);
              setSelectedTask(null);
            }}
            onSuccess={() => {
              setShowModal(false);
              setSelectedTask(null);
              fetchTasks();
            }}
          />
        )}
      </main>
    </div>
  );
}
