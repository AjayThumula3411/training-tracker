"use client";

import { ChangeEvent, useState } from "react";
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

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to read file"));
        return;
      }
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });

const shortId = (id: string) => id.slice(0, 8);

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
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  const [busyTaskId, setBusyTaskId] = useState("");

  const handleFileChange = (taskId: string, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setPendingFiles((current) => ({ ...current, [taskId]: files }));
  };

  const removePendingFile = (taskId: string, fileName: string) => {
    setPendingFiles((current) => ({
      ...current,
      [taskId]: (current[taskId] || []).filter((file) => file.name !== fileName),
    }));
  };

  const uploadFiles = async (task: Task) => {
    const files = pendingFiles[task.id] || [];

    for (const file of files) {
      const contentBase64 = await toBase64(file);
      await api.post("/tasks/upload", {
        taskId: task.id,
        fileName: file.name,
        mimeType: file.type,
        contentBase64,
      });
    }
  };

  const updateStatus = async (task: Task, status: TaskStatus) => {
    try {
      setBusyTaskId(task.id);

      if (status === "SUBMITTED") {
        await uploadFiles(task);
      }

      await api.patch(`/tasks/${task.id}/status`, { status });

      setPendingFiles((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });

      toast.success(
        status === "REVIEWED"
          ? "Task reviewed"
          : status === "COMPLETED"
            ? "Task approved"
            : status === "NEEDS_REVISION"
              ? "Task sent back for revision"
              : status === "SUBMITTED"
                ? "Task submitted"
                : "Task updated"
      );
      onRefresh?.();
    } catch (error) {
      const apiError = error as AxiosError<ApiError>;
      toast.error(apiError.response?.data?.message || "Failed to update status");
    } finally {
      setBusyTaskId("");
    }
  };

  const deleteTask = async (task: Task) => {
    const confirmed = window.confirm(`Delete "${task.title}"?`);
    if (!confirmed) return;

    try {
      setBusyTaskId(task.id);
      await api.delete(`/tasks/${task.id}`);
      toast.success("Task deleted");
      onRefresh?.();
    } catch (error) {
      const apiError = error as AxiosError<ApiError>;
      toast.error(apiError.response?.data?.message || "Failed to delete task");
    } finally {
      setBusyTaskId("");
    }
  };

  const removeAttachment = async (task: Task, attachmentUrl: string) => {
    try {
      setBusyTaskId(task.id);
      await api.delete(`/tasks/${task.id}/attachment`, {
        data: { attachmentUrl },
      });
      toast.success("Attachment removed");
      onRefresh?.();
    } catch (error) {
      const apiError = error as AxiosError<ApiError>;
      toast.error(apiError.response?.data?.message || "Failed to remove attachment");
    } finally {
      setBusyTaskId("");
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
          <col className="w-[9%]" />
          <col className="w-[17%]" />
          <col className="w-[10%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[10%]" />
          <col className="w-[13%]" />
        </colgroup>
        <thead>
          <tr>
            <th>Task ID</th>
            <th>Title</th>
            <th>Priority</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Assigned To</th>
            <th>Assigned By</th>
            <th>Attachments</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const canDeveloperUpdate = isDeveloper && task.assignedToId === currentUserId;
            const canReview = task.status === "SUBMITTED" && canReviewTasks;
            const canCompleteReview = task.status === "REVIEWED" && canReviewTasks;
            const canEdit = isHr || isTeamLead;
            const canDelete = isHr;
            const canUpload = canDeveloperUpdate && (task.status === "IN_PROGRESS" || task.status === "NEEDS_REVISION");
            const canManageAttachments = canEdit || canUpload;
            const filesSelected = pendingFiles[task.id]?.length || 0;
            const isBusy = busyTaskId === task.id;

            return (
              <tr key={task.id}>
                <td className="text-sm font-semibold text-slate-700">{shortId(task.id)}</td>
                <td>
                  <p className="font-semibold text-slate-900">{task.title}</p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                    {task.description || "No description provided."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>Created by {task.createdBy?.name || task.assignedBy?.name || "Unknown"}</span>
                    <span>&bull;</span>
                    <span>Updated by {task.updatedBy?.name || "Unknown"}</span>
                  </div>
                </td>
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
                <td className="text-sm text-slate-600">{task.assignedTo?.name || "Unknown"}</td>
                <td className="text-sm text-slate-600">{task.assignedBy?.name || "Unknown"}</td>
                <td>
                  <div className="space-y-2">
                    {task.attachments && task.attachments.length > 0 ? (
                      task.attachments.map((attachment, index) => (
                        <div key={`${task.id}-${index}`} className="flex items-center gap-2">
                          <a
                            href={attachment}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
                          >
                            File {index + 1}
                          </a>
                          {canManageAttachments && (
                            <button
                              type="button"
                              onClick={() => removeAttachment(task, attachment)}
                              disabled={isBusy}
                              className="text-xs font-medium text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No files</p>
                    )}
                    {canUpload && (
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          multiple
                          onChange={(event) => handleFileChange(task.id, event)}
                          className="block w-full text-xs text-slate-500"
                        />
                        {filesSelected > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500">{filesSelected} file(s) ready for submit</p>
                            {(pendingFiles[task.id] || []).map((file) => (
                              <div key={`${task.id}-${file.name}-${file.size}`} className="flex items-center gap-2">
                                <span className="truncate text-xs text-slate-500">{file.name}</span>
                                <button
                                  type="button"
                                  onClick={() => removePendingFile(task.id, file.name)}
                                  disabled={isBusy}
                                  className="text-xs font-medium text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="table-actions">
                    {canDeveloperUpdate && task.status === "ASSIGNED" && (
                      <button
                        onClick={() => updateStatus(task, "IN_PROGRESS")}
                        disabled={isBusy}
                        className="btn-secondary px-3 py-2 text-xs"
                      >
                        Start
                      </button>
                    )}

                    {canDeveloperUpdate && task.status === "NEEDS_REVISION" && (
                      <button
                        onClick={() => updateStatus(task, "IN_PROGRESS")}
                        disabled={isBusy}
                        className="btn-secondary px-3 py-2 text-xs"
                      >
                        Start
                      </button>
                    )}

                    {canDeveloperUpdate && task.status === "IN_PROGRESS" && (
                      <button
                        onClick={() => updateStatus(task, "SUBMITTED")}
                        disabled={isBusy}
                        className="btn-secondary px-3 py-2 text-xs"
                      >
                        Submit
                      </button>
                    )}

                    {canReview && (
                      <>
                        <button
                          onClick={() => updateStatus(task, "REVIEWED")}
                          disabled={isBusy}
                          className="btn-primary px-3 py-2 text-xs"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => updateStatus(task, "NEEDS_REVISION")}
                          disabled={isBusy}
                          className="btn-secondary px-3 py-2 text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {canCompleteReview && (
                      <button
                        onClick={() => updateStatus(task, "COMPLETED")}
                        disabled={isBusy}
                        className="btn-primary px-3 py-2 text-xs"
                      >
                        Approve
                      </button>
                    )}

                    {canEdit && (
                      <button onClick={() => onEdit?.(task)} className="btn-secondary px-3 py-2 text-xs">
                        Edit
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => deleteTask(task)}
                        disabled={isBusy}
                        className="btn-secondary px-3 py-2 text-xs text-rose-700"
                      >
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
