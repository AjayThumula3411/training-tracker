"use client";

import { AxiosError } from "axios";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Role, Task, TaskStatus } from "@/lib/types";

type TaskTableProps = {
  tasks: Task[];
  currentUserRole?: Role;
  currentUserId?: string;
  onRefresh?: () => void;
  onEdit?: (task: Task) => void;
};

type ApiError = {
  message?: string;
};

const priorityTone: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-rose-100 text-rose-700",
};

const formatStatus = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getStatusLabel = (status: TaskStatus) => {
  if (status === "COMPLETED") return "Approved";
  if (status === "NEEDS_REVISION") return "Rejected";
  return formatStatus(status);
};

export default function TaskTable({
  tasks,
  currentUserRole,
  currentUserId,
  onRefresh,
  onEdit,
}: TaskTableProps) {
  const isHr = currentUserRole === "HR";
  const isTeamLead = currentUserRole === "TEAM_LEAD";
  const isDeveloper = currentUserRole === "JUNIOR_DEV" || currentUserRole === "SENIOR_DEV";
  const canReviewTasks = isHr || isTeamLead;

  const updateStatus = async (id: string, status: TaskStatus) => {
    try {
      await api.patch(`/tasks/${id}/status`, { status });
      toast.success(
        status === "REVIEWED"
          ? "Task reviewed"
          : status === "COMPLETED"
          ? "Task approved"
          : status === "NEEDS_REVISION"
            ? "Task sent back for revision"
            : "Task updated"
      );
      onRefresh?.();
    } catch (error) {
      const apiError = error as AxiosError<ApiError>;
      toast.error(apiError.response?.data?.message || "Failed to update status");
    }
  };

  const deleteTask = async (task: Task) => {
    const confirmed = window.confirm(`Delete "${task.title}"?`);
    if (!confirmed) return;

    try {
      await api.delete(`/tasks/${task.id}`);
      toast.success("Task deleted");
      onRefresh?.();
    } catch (error) {
      const apiError = error as AxiosError<ApiError>;
      toast.error(apiError.response?.data?.message || "Failed to delete task");
    }
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div className="empty-state">
        <p className="text-lg font-semibold text-slate-900">No tasks assigned yet</p>
        <p className="mt-2 text-sm text-slate-500">New work will appear here as soon as it is assigned.</p>
      </div>
    );
  }

  return (
    <div className="table-shell">
      <table>
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[16%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr>
            <th>Task</th>
            <th>Assignee</th>
            <th>Priority</th>
            <th>Due</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const canDeveloperUpdate = isDeveloper && task.assignedToId === currentUserId;
            const canReview = task.status === "SUBMITTED" && canReviewTasks;
            const canCompleteReview = task.status === "REVIEWED" && canReviewTasks;
            const canEdit = isHr;
            const canDelete = isHr;

            return (
              <tr key={task.id}>
                <td>
                  <p className="font-semibold text-slate-900">{task.title}</p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                    {task.description || "No description provided."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>Assigned by {task.assignedBy?.name || "Unknown"}</span>
                    <span>&bull;</span>
                    <span>ID {task.id.slice(0, 8)}</span>
                  </div>
                </td>
                <td className="text-sm text-slate-600">{task.assignedTo?.name || "Unassigned"}</td>
                <td>
                  <span className={`badge ${priorityTone[task.priority] || "bg-slate-100 text-slate-700"}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="text-sm text-slate-600">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "TBD"}
                </td>
                <td>
                  <span
                    className={`badge ${
                      task.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-700"
                        : task.status === "NEEDS_REVISION"
                          ? "bg-rose-100 text-rose-700"
                          : task.status === "REVIEWED"
                            ? "bg-cyan-100 text-cyan-700"
                            : task.status === "SUBMITTED"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {getStatusLabel(task.status)}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    {canDeveloperUpdate &&
                      (
                        [
                          task.status === "ASSIGNED" && {
                            value: "IN_PROGRESS" as TaskStatus,
                            label: "Start Work",
                          },
                          task.status === "NEEDS_REVISION" && {
                            value: "IN_PROGRESS" as TaskStatus,
                            label: "Resume Work",
                          },
                          task.status === "IN_PROGRESS" && {
                            value: "SUBMITTED" as TaskStatus,
                            label: "Submit for Review",
                          },
                        ].filter(
                          (option): option is { value: TaskStatus; label: string } => Boolean(option)
                        )
                      ).map((option) => (
                          <button
                            key={option.value}
                            onClick={() => updateStatus(task.id, option.value)}
                            className="btn-secondary px-3 py-2 text-xs"
                          >
                            {option.label}
                          </button>
                        ))}

                    {canReview && (
                      <>
                        <button
                          onClick={() => updateStatus(task.id, "REVIEWED")}
                          className="btn-primary px-3 py-2 text-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(task.id, "NEEDS_REVISION")}
                          className="btn-secondary px-3 py-2 text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {canCompleteReview && (
                      <button
                        onClick={() => updateStatus(task.id, "COMPLETED")}
                        className="btn-primary px-3 py-2 text-xs"
                      >
                        Complete
                      </button>
                    )}

                    {canEdit && (
                      <button onClick={() => onEdit?.(task)} className="btn-secondary px-3 py-2 text-xs">
                        Edit
                      </button>
                    )}

                    {canDelete && (
                      <button onClick={() => deleteTask(task)} className="btn-secondary px-3 py-2 text-xs text-rose-700">
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
