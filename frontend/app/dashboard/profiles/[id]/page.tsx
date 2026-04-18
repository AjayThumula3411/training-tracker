"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import ProfileCard from "@/components/ProfileCard";
import FeedbackSection from "@/components/FeedbackSection";
import FeedbackForm from "@/components/FeedbackForm";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Feedback, TrainingStatus, UserProfile } from "@/lib/types";

type ApiError = {
  message?: string;
};

const trainingStatuses: TrainingStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "FAILED",
];

export default function ProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, loading: authLoading, fetchUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>("NOT_STARTED");
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [profileForm, setProfileForm] = useState({
    name: "",
    department: "",
    skills: "",
    githubUrl: "",
    linkedinUrl: "",
    internalNotes: "",
  });
  const [savingTraining, setSavingTraining] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      const profileRes = await api.get(`/profile/${id}`);
      setProfile(profileRes.data);
      setTrainingStatus(profileRes.data.trainingStatus || "NOT_STARTED");
      setTrainingProgress(profileRes.data.trainingProgress || 0);
      setProfileForm({
        name: profileRes.data.name || "",
        department: profileRes.data.department || "",
        skills: Array.isArray(profileRes.data.skills) ? profileRes.data.skills.join(", ") : "",
        githubUrl: profileRes.data.githubUrl || "",
        linkedinUrl: profileRes.data.linkedinUrl || "",
        internalNotes: profileRes.data.internalNotes || "",
      });

      try {
        const feedbackRes = await api.get(`/feedback/${id}`);
        setFeedback(feedbackRes.data);
      } catch {
        setFeedback([]);
      }
    } catch (error) {
      setError("Unable to load this profile.");
      console.error("Profile fetch failed:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const canAccessProfile = Boolean(user);

    if (!canAccessProfile) {
      setLoading(false);
      setError("You do not have access to this profile.");
      return;
    }

    fetchData();
  }, [authLoading, fetchData, id, router, user]);

  if (loading || authLoading) {
    return (
      <div className="auth-shell">
        <div className="app-panel rounded-[28px] px-8 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile || !id) {
    return (
      <div className="auth-shell">
        <div className="app-panel rounded-[28px] px-8 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">Profile not found.</p>
        </div>
      </div>
    );
  }

  const canManageTraining =
    user?.role === "TEAM_LEAD" &&
    (profile.role === "JUNIOR_DEV" || profile.role === "SENIOR_DEV");
  const canEditProfile = user?.role === "HR" || user?.id === id;
  const canUseFeedback =
    (user?.role === "SENIOR_DEV" || user?.role === "TEAM_LEAD" || user?.role === "HR") &&
    (profile.role === "JUNIOR_DEV" || profile.role === "SENIOR_DEV");

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      setError("");

      const payload = {
        name: profileForm.name.trim(),
        department: profileForm.department.trim(),
        skills: profileForm.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        githubUrl: profileForm.githubUrl.trim(),
        linkedinUrl: profileForm.linkedinUrl.trim(),
        internalNotes: profileForm.internalNotes.trim(),
      };

      await api.patch(`/profile/${id}`, payload);
      await fetchData();

      if (user?.id === id) {
        await fetchUser();
      }

      toast.success("Profile updated");
    } catch (err) {
      const apiError = err as AxiosError<ApiError>;
      const message = apiError.response?.data?.message || "Unable to update profile.";
      setError(message);
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  };

  const saveTraining = async () => {
    try {
      setSavingTraining(true);
      setError("");
      await api.patch(`/profiles/${id}/status`, {
        trainingStatus,
        trainingProgress,
      });
      toast.success("Training progress updated");
      await fetchData();
    } catch (err) {
      const apiError = err as AxiosError<ApiError>;
      const message = apiError.response?.data?.message || "Unable to update training progress.";
      setError(message);
      toast.error(message);
    } finally {
      setSavingTraining(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />

      <main className="app-container space-y-6">
        <ProfileCard user={profile} />
        {canEditProfile && (
          <section className="premium-panel rounded-[28px] p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Profile control</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">Edit profile details</h3>
            <p className="section-subtitle mt-2">Keep profile data clean, credible, and ready for training reviews.</p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <input
                value={profileForm.name}
                onChange={(e) => setProfileForm((current) => ({ ...current, name: e.target.value }))}
                className="field"
                placeholder="Full name"
              />
              <input
                value={profileForm.department}
                onChange={(e) => setProfileForm((current) => ({ ...current, department: e.target.value }))}
                className="field"
                placeholder="Department"
              />
              <input
                value={profileForm.githubUrl}
                onChange={(e) => setProfileForm((current) => ({ ...current, githubUrl: e.target.value }))}
                className="field"
                placeholder="GitHub URL"
              />
              <input
                value={profileForm.linkedinUrl}
                onChange={(e) => setProfileForm((current) => ({ ...current, linkedinUrl: e.target.value }))}
                className="field"
                placeholder="LinkedIn URL"
              />
            </div>

            <div className="mt-4 grid gap-4">
              <textarea
                value={profileForm.skills}
                onChange={(e) => setProfileForm((current) => ({ ...current, skills: e.target.value }))}
                className="field min-h-[110px] resize-y"
                placeholder="Skills, separated by commas"
              />
              {user?.role === "HR" && (
                <textarea
                  value={profileForm.internalNotes}
                  onChange={(e) => setProfileForm((current) => ({ ...current, internalNotes: e.target.value }))}
                  className="field min-h-[140px] resize-y"
                  placeholder="Internal notes for HR and leads"
                />
              )}
            </div>

            <div className="mt-6">
              <button onClick={saveProfile} disabled={savingProfile} className="btn-primary">
                {savingProfile ? "Saving..." : "Save Profile Changes"}
              </button>
            </div>

            {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
          </section>
        )}
        {canManageTraining && (
          <section className="premium-panel rounded-[28px] p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Training control</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">Update training progress</h3>
            <p className="section-subtitle mt-2">Adjust readiness, progression, and milestone completion in one place.</p>

            <div className="mt-6 grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
              <select
                value={trainingStatus}
                onChange={(e) => setTrainingStatus(e.target.value as TrainingStatus)}
                className="field"
              >
                {trainingStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Progress</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={trainingProgress}
                  onChange={(e) => setTrainingProgress(Number(e.target.value))}
                  className="w-full"
                />
                <p className="mt-2 text-sm font-medium text-slate-500">{trainingProgress}%</p>
              </div>

              <button onClick={saveTraining} disabled={savingTraining} className="btn-primary">
                {savingTraining ? "Saving..." : "Save Update"}
              </button>
            </div>
          </section>
        )}
        {error && !canEditProfile && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <FeedbackSection feedback={feedback} onRefresh={fetchData} />
        {canUseFeedback && (
          <FeedbackForm developerId={id} onSuccess={fetchData} />
        )}
      </main>
    </div>
  );
}
