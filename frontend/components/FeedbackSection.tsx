"use client";

import { useMemo, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Feedback, FeedbackType } from "@/lib/types";

type FeedbackSectionProps = {
  feedback: Feedback[];
  onRefresh?: () => void | Promise<void>;
};

type FeedbackFilter = "ALL" | "EXTERNAL" | "INTERNAL";
type SortOrder = "NEWEST" | "OLDEST";
type ApiError = {
  message?: string;
};

const formatRole = (role?: string) =>
  role
    ? role
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Workspace User";

export default function FeedbackSection({ feedback, onRefresh }: FeedbackSectionProps) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FeedbackFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("NEWEST");
  const [editingId, setEditingId] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftType, setDraftType] = useState<FeedbackType>("EXTERNAL");
  const [loading, setLoading] = useState(false);

  const canViewInternal = user?.role === "HR" || user?.role === "TEAM_LEAD";
  const canUseInternalType = user?.role === "HR" || user?.role === "TEAM_LEAD";

  const filteredFeedback = useMemo(() => {
    const visibleFeedback = canViewInternal
      ? feedback
      : feedback.filter((item) => item.type === "EXTERNAL");

    const byType =
      filter === "ALL" ? visibleFeedback : visibleFeedback.filter((item) => item.type === filter);

    return [...byType].sort((a, b) => {
      const direction = sortOrder === "NEWEST" ? -1 : 1;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
    });
  }, [canViewInternal, feedback, filter, sortOrder]);

  const startEdit = (item: Feedback) => {
    setEditingId(item.id);
    setDraftContent(item.content);
    setDraftType(item.type);
  };

  const cancelEdit = () => {
    setEditingId("");
    setDraftContent("");
    setDraftType("EXTERNAL");
  };

  const saveEdit = async () => {
    if (!editingId) return;

    if (!draftContent.trim()) {
      toast.error("Feedback content is required.");
      return;
    }

    try {
      setLoading(true);
      await api.patch(`/feedback/${editingId}`, {
        content: draftContent.trim(),
        type: draftType,
      });
      toast.success("Feedback updated");
      cancelEdit();
      await onRefresh?.();
    } catch (err) {
      const apiError = err as AxiosError<ApiError>;
      toast.error(apiError.response?.data?.message || "Error updating feedback");
    } finally {
      setLoading(false);
    }
  };

  const removeFeedback = async (item: Feedback) => {
    const confirmed = window.confirm("Delete this feedback?");

    if (!confirmed) return;

    try {
      setLoading(true);
      await api.delete(`/feedback/${item.id}`);
      toast.success("Feedback deleted");
      await onRefresh?.();
    } catch (err) {
      const apiError = err as AxiosError<ApiError>;
      toast.error(apiError.response?.data?.message || "Error deleting feedback");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="premium-panel rounded-[28px] p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Feedback System</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">External and internal feedback</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            External feedback is broadly visible. Internal feedback is restricted to HR and Team Lead.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FeedbackFilter)}
            className="field w-auto min-w-[150px] px-3 py-2 text-sm"
          >
            <option value="ALL">All feedback</option>
            <option value="EXTERNAL">External</option>
            {canViewInternal && <option value="INTERNAL">Internal</option>}
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="field w-auto min-w-[140px] px-3 py-2 text-sm"
          >
            <option value="NEWEST">Newest first</option>
            <option value="OLDEST">Oldest first</option>
          </select>
        </div>
      </div>

      {filteredFeedback.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">No feedback matches the current filters.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {filteredFeedback.map((item) => {
            const isEditing = editingId === item.id;
            const canEdit = item.authorId === user?.id;
            const canDelete =
              item.type === "INTERNAL" ? user?.role === "HR" : item.authorId === user?.id || user?.role === "HR";

            return (
              <div key={item.id} className="list-card">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`badge ${
                      item.type === "INTERNAL" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {item.type}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>

                {isEditing ? (
                  <div className="mt-3 grid gap-3">
                    <textarea
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      className="field min-h-[120px] resize-y"
                    />
                    <select
                      value={draftType}
                      onChange={(e) => setDraftType(e.target.value as FeedbackType)}
                      className="field max-w-[220px]"
                      disabled={!canUseInternalType}
                    >
                      <option value="EXTERNAL">External</option>
                      {canUseInternalType && <option value="INTERNAL">Internal</option>}
                    </select>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={saveEdit} disabled={loading} className="btn-primary">
                        {loading ? "Saving..." : "Save"}
                      </button>
                      <button onClick={cancelEdit} disabled={loading} className="btn-secondary">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{item.content}</p>
                )}

                {item.author && (
                  <p className="mt-2 text-xs font-medium text-slate-400">
                    By {item.author.name} ({formatRole(item.author.role)})
                  </p>
                )}

                {!isEditing && (canEdit || canDelete) && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {canEdit && (
                      <button onClick={() => startEdit(item)} className="btn-secondary">
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => removeFeedback(item)} disabled={loading} className="btn-secondary text-rose-700">
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
