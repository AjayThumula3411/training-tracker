"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import ProfileCard from "@/components/ProfileCard";
import ProfilePhotoUploadField from "@/components/ProfilePhotoUploadField";
import FeedbackSection from "@/components/FeedbackSection";
import TaskTable from "@/components/TaskTable";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Feedback, Role, Task, TrainingStatus, UserProfile } from "@/lib/types";

type ApiError = {
  message?: string;
};

const trainingStatuses: TrainingStatus[] = ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "FAILED"];
const toInputDate = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");

export default function MyProfilePage() {
  const { user, loading: authLoading, fetchUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "JUNIOR_DEV" as Role,
    department: "",
    joinDate: "",
    photoUrl: "",
    skills: "",
    githubUrl: "",
    linkedinUrl: "",
    internalNotes: "",
    trainingStatus: "NOT_STARTED" as TrainingStatus,
    trainingStartDate: "",
    trainingEndDate: "",
  });

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [profileRes, tasksRes, feedbackRes] = await Promise.all([
        api.get("/profile/me"),
        api.get("/tasks"),
        api.get("/feedback/my"),
      ]);

      const nextProfile = profileRes.data as UserProfile;
      setProfile(nextProfile);
      setTasks(tasksRes.data as Task[]);
      setFeedback(feedbackRes.data as Feedback[]);
      setForm({
        name: nextProfile.name || "",
        email: nextProfile.email || "",
        role: nextProfile.role,
        department: nextProfile.department || "",
        joinDate: toInputDate(nextProfile.joinDate),
        photoUrl: nextProfile.photoUrl || "",
        skills: nextProfile.skills?.join(", ") || "",
        githubUrl: nextProfile.githubUrl || "",
        linkedinUrl: nextProfile.linkedinUrl || "",
        internalNotes: nextProfile.internalNotes || "",
        trainingStatus: nextProfile.trainingStatus || "NOT_STARTED",
        trainingStartDate: toInputDate(nextProfile.trainingStartDate),
        trainingEndDate: toInputDate(nextProfile.trainingEndDate),
      });
    } catch (err) {
      const apiError = err as AxiosError<ApiError>;
      setError(apiError.response?.data?.message || "Unable to load your profile.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      void loadPage();
    }
  }, [authLoading, loadPage, router, user]);

  const canEditAll = user?.role === "HR";
  const canEditTeamLeadFields = user?.role === "TEAM_LEAD";
  const isDeveloper = user?.role === "JUNIOR_DEV" || user?.role === "SENIOR_DEV";
  const canEditOwnIdentityFields = Boolean(isDeveloper || canEditAll || canEditTeamLeadFields);
  const canManageOwnTraining = Boolean(canEditAll);

  const buildPayload = () => {
    if (canEditAll) {
      return {
        name: form.name.trim(),
        email: form.email.trim(),
        department: form.department.trim(),
        photoUrl: form.photoUrl.trim(),
        joinDate: form.joinDate || undefined,
        skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
        githubUrl: form.githubUrl.trim(),
        linkedinUrl: form.linkedinUrl.trim(),
        internalNotes: form.internalNotes.trim(),
        trainingStatus: form.trainingStatus,
        trainingProgress: profile?.trainingProgress ?? 0,
        trainingStartDate: form.trainingStartDate || undefined,
        trainingEndDate: form.trainingEndDate || undefined,
      };
    }

    if (canEditTeamLeadFields) {
      return {
        name: form.name.trim(),
        photoUrl: form.photoUrl.trim(),
        skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
        githubUrl: form.githubUrl.trim(),
        linkedinUrl: form.linkedinUrl.trim(),
      };
    }

    if (isDeveloper) {
      return {
        name: form.name.trim(),
        photoUrl: form.photoUrl.trim(),
        skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
        githubUrl: form.githubUrl.trim(),
        linkedinUrl: form.linkedinUrl.trim(),
      };
    }

    return {};
  };

  const saveProfile = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      setError("");
      await api.patch(`/profile/${profile.id}`, buildPayload());
      await fetchUser();
      await loadPage();
      toast.success("Profile updated");
    } catch (err) {
      const apiError = err as AxiosError<ApiError>;
      const message = apiError.response?.data?.message || "Unable to save profile.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="auth-shell">
        <div className="app-panel rounded-[28px] px-8 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="app-shell">
        <Navbar />
        <main className="app-container">
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error || "Profile not found."}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />

      <main className="app-container space-y-6">
        <ProfileCard user={profile} />

        <section className="premium-panel rounded-[28px] p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Edit Profile</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Role-based profile controls</h2>
          <p className="section-subtitle mt-2">
            Developers can edit only allowed fields. Team leads can edit only their own basic details. HR has full profile control.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {canEditOwnIdentityFields && (
              <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} className="field" placeholder="Full name" />
            )}
            {canEditAll && (
              <input value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} className="field" placeholder="Email" />
            )}
            {canEditAll && (
              <input value={form.department} onChange={(e) => setForm((current) => ({ ...current, department: e.target.value }))} className="field" placeholder="Department" />
            )}
            {canEditAll && (
              <input type="date" value={form.joinDate} onChange={(e) => setForm((current) => ({ ...current, joinDate: e.target.value }))} className="field" />
            )}
            {canEditOwnIdentityFields && profile && (
              <ProfilePhotoUploadField
                photoUrl={form.photoUrl}
                name={form.name || profile.name}
                uploadPath={`/profile/${profile.id}/photo`}
                disabled={saving}
                onPhotoChange={(photoUrl) => setForm((current) => ({ ...current, photoUrl }))}
                onPhotoUploaded={(photoUrl) => {
                  setProfile((current) => (current ? { ...current, photoUrl } : current));
                  void fetchUser();
                }}
              />
            )}
            {canEditOwnIdentityFields && (
              <input value={form.githubUrl} onChange={(e) => setForm((current) => ({ ...current, githubUrl: e.target.value }))} className="field" placeholder="GitHub URL" />
            )}
            {canEditOwnIdentityFields && (
              <input value={form.linkedinUrl} onChange={(e) => setForm((current) => ({ ...current, linkedinUrl: e.target.value }))} className="field" placeholder="LinkedIn URL" />
            )}
            {canManageOwnTraining && (
              <select value={form.trainingStatus} onChange={(e) => setForm((current) => ({ ...current, trainingStatus: e.target.value as TrainingStatus }))} className="field">
                {trainingStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            )}
            {canManageOwnTraining && (
              <input type="date" value={form.trainingStartDate} onChange={(e) => setForm((current) => ({ ...current, trainingStartDate: e.target.value }))} className="field" />
            )}
            {canManageOwnTraining && (
              <input type="date" value={form.trainingEndDate} onChange={(e) => setForm((current) => ({ ...current, trainingEndDate: e.target.value }))} className="field" />
            )}
          </div>

          {(isDeveloper || canEditAll || canEditTeamLeadFields) && (
            <textarea
              value={form.skills}
              onChange={(e) => setForm((current) => ({ ...current, skills: e.target.value }))}
              className="field mt-4 min-h-[110px] resize-y"
              placeholder="Skills separated by commas"
            />
          )}

          {canEditAll && (
            <textarea
              value={form.internalNotes}
              onChange={(e) => setForm((current) => ({ ...current, internalNotes: e.target.value }))}
              className="field mt-4 min-h-[130px] resize-y"
              placeholder="Internal notes"
            />
          )}

          <div className="mt-6">
            <button onClick={saveProfile} disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </section>

        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        <section className="premium-panel rounded-[28px] p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Assigned Tasks</p>
          <div className="mt-6">
            <TaskTable tasks={tasks} currentUserRole={user?.role} currentUserId={user?.id} onRefresh={loadPage} />
          </div>
        </section>

        <FeedbackSection feedback={feedback} onRefresh={loadPage} />
      </main>
    </div>
  );
}
