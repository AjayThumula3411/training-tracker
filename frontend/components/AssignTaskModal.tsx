"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Priority, Task, UserProfile } from "@/lib/types";

type ApiError = {
  message?: string;
};

type AssignTaskModalProps = {
  onClose: () => void;
  onSuccess: () => void;
  task?: Task | null;
  assignee?: UserProfile | null;
};

const getErrorMessage = (err: unknown, fallback: string) => {
  const axiosError = err as AxiosError<ApiError>;
  return axiosError.response?.data?.message || fallback;
};

export default function AssignTaskModal({
  onClose,
  onSuccess,
  task,
  assignee,
}: AssignTaskModalProps) {
  const isEditing = Boolean(task);
  const directAssignee =
    assignee && (assignee.role === "JUNIOR_DEV" || assignee.role === "SENIOR_DEV") ? assignee : null;

  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [priority, setPriority] = useState<Priority>(task?.priority || "MEDIUM");
  const [existingAttachments, setExistingAttachments] = useState<string[]>(task?.attachments || []);
  const [developers, setDevelopers] = useState<UserProfile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [assignedToId, setAssignedToId] = useState(task?.assignedToId || directAssignee?.id || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingDevelopers, setLoadingDevelopers] = useState(true);

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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(event.target.files || []));
  };

  const removeSelectedFile = (fileName: string) => {
    setSelectedFiles((current) => current.filter((file) => file.name !== fileName));
  };

  const uploadSelectedFiles = async (taskId: string) => {
    for (const file of selectedFiles) {
      const contentBase64 = await toBase64(file);
      await api.post("/tasks/upload", {
        taskId,
        fileName: file.name,
        mimeType: file.type,
        contentBase64,
      });
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setError("");
        setLoadingDevelopers(true);
        const res = await api.get("/tasks/assignable-developers");
        const directDevelopers = res.data as UserProfile[];
        const nextDevelopers =
          directAssignee && !directDevelopers.some((developer) => developer.id === directAssignee.id)
            ? [directAssignee, ...directDevelopers]
            : directDevelopers;

        setDevelopers(nextDevelopers);
      } catch (err) {
        if (directAssignee) {
          setDevelopers([directAssignee]);
          setAssignedToId((current) => current || directAssignee.id);
          setError("");
          return;
        }

        setError(getErrorMessage(err, "Unable to load developers. Please refresh your session."));
      } finally {
        setLoadingDevelopers(false);
      }
    };

    void fetchUsers();
  }, [directAssignee]);

  useEffect(() => {
    if (directAssignee && !task?.assignedToId) {
      setAssignedToId((current) => current || directAssignee.id);
    }
  }, [directAssignee, task?.assignedToId]);

  useEffect(() => {
    setExistingAttachments(task?.attachments || []);
    setSelectedFiles([]);
  }, [task]);

  const formIsValid = useMemo(
    () => title.trim().length > 2 && description.trim().length > 4 && Boolean(assignedToId),
    [assignedToId, description, title]
  );

  const handleSubmit = async () => {
    if (!formIsValid) {
      setError("Please complete the title, description, and assignee.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || "",
        priority,
        assignedToId,
      };

      if (isEditing && task) {
        const response = await api.put(`/tasks/${task.id}`, payload);
        await uploadSelectedFiles(response.data.id);
        toast.success("Task updated");
      } else {
        const response = await api.post("/tasks/assign", payload);
        await uploadSelectedFiles(response.data.id);
        toast.success("Task assigned");
      }

      onSuccess();
    } catch (err) {
      const message = getErrorMessage(err, isEditing ? "Error updating task" : "Error creating task");
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeExistingAttachment = async (attachmentUrl: string) => {
    if (!task) return;

    try {
      setSubmitting(true);
      setError("");
      await api.delete(`/tasks/${task.id}/attachment`, {
        data: { attachmentUrl },
      });
      setExistingAttachments((current) => current.filter((entry) => entry !== attachmentUrl));
      toast.success("Attachment removed");
    } catch (err) {
      const message = getErrorMessage(err, "Unable to remove attachment");
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/42 px-4 py-6">
      <div className="flex min-h-full items-start justify-center">
        <div className="modal-surface w-full max-w-lg rounded-[26px] p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                {isEditing ? "Edit assignment" : "Create assignment"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                {isEditing ? "Edit task" : "Assign task"}
              </h2>
            </div>
            <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <div className="relative mt-2">
                <input
                  className="field text-slate-950 placeholder:text-slate-400"
                  placeholder="Task title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>

            <div>
              <textarea
                className="field mt-2 min-h-[140px] resize-y text-slate-950 placeholder:text-slate-400"
                placeholder="Describe the expected outcome and context"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="relative mt-2">
                  <input
                    className="field text-slate-950"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="relative mt-2">
                  <select
                    className="field pr-12 text-slate-950"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="relative mt-2">
                <select
                  className="field text-slate-950"
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  disabled={loadingDevelopers}
                >
                  <option value="">
                    {loadingDevelopers ? "Loading developers..." : developers.length ? "Select developer" : "No developers available"}
                  </option>
                  {developers.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.name} {dev.role === "JUNIOR_DEV" ? "(Junior Dev)" : "(Senior Dev)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                onChange={handleFileChange}
                className="block w-full rounded-[20px] border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-600"
              />
              <p className="text-xs text-slate-500">Choose PDF, DOC, or DOCX files from your device.</p>
              {existingAttachments.length > 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Current files</p>
                  <div className="mt-2 space-y-2">
                    {existingAttachments.map((attachment, index) => (
                      <div key={attachment} className="flex items-center justify-between gap-3">
                        <a
                          href={attachment}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-blue-700 underline-offset-2 hover:underline"
                        >
                          File {index + 1}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeExistingAttachment(attachment)}
                          disabled={submitting}
                          className="text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedFiles.length > 0 ? (
                <div className="rounded-2xl bg-blue-50 px-4 py-3 text-xs text-blue-700">
                  <p className="font-semibold">Selected files</p>
                  <div className="mt-2 space-y-2">
                    {selectedFiles.map((file) => (
                      <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeSelectedFile(file.name)}
                          disabled={submitting}
                          className="text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || loadingDevelopers || !formIsValid}
                className="btn-primary"
              >
                {submitting ? (isEditing ? "Saving..." : "Assigning...") : isEditing ? "Save Changes" : "Assign Task"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
