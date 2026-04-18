"use client";

import { useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { FeedbackType } from "@/lib/types";

type FeedbackFormProps = {
  developerId: string;
  onSuccess?: () => void;
};

type ApiError = {
  message?: string;
};

export default function FeedbackForm({ developerId, onSuccess }: FeedbackFormProps) {
  const [content, setContent] = useState("");
  const [type, setType] = useState<FeedbackType>("EXTERNAL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  if (!user || (user.role !== "SENIOR_DEV" && user.role !== "TEAM_LEAD" && user.role !== "HR")) return null;

  const canCreateInternal = user.role === "TEAM_LEAD" || user.role === "HR";

  async function submit() {
    if (!content.trim()) {
      setError("Please enter feedback before submitting.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await api.post("/feedback", {
        developerId,
        content,
        type,
      });

      setContent("");
      toast.success("Feedback submitted");
      onSuccess?.();
    } catch (err) {
      const apiError = err as AxiosError<ApiError>;
      const message = apiError.response?.data?.message || "Error submitting feedback";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="premium-panel rounded-[28px] p-6 md:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Feedback</p>
      <h3 className="mt-2 text-2xl font-semibold text-slate-950">Add feedback</h3>
      <p className="section-subtitle mt-2">
        External feedback is visible broadly. Internal feedback is limited to HR and Team Lead only.
      </p>

      <div className="mt-6 grid gap-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write actionable feedback for this developer."
          className="field min-h-[140px] resize-y"
        />

        {canCreateInternal && (
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FeedbackType)}
            className="field"
          >
            <option value="EXTERNAL">External</option>
            <option value="INTERNAL">Internal</option>
          </select>
        )}

        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        <div>
          <button onClick={submit} disabled={loading} className="btn-primary">
            {loading ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      </div>
    </section>
  );
}
