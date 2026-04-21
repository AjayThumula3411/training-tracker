"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import ProfileCard from "@/components/ProfileCard";
import FeedbackSection from "@/components/FeedbackSection";
import FeedbackForm from "@/components/FeedbackForm";
import TaskTable from "@/components/TaskTable";
import AssignTaskModal from "@/components/AssignTaskModal";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Feedback, Task, TrainingStatus, UserProfile } from "@/lib/types";

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

const toInputDate = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");
export default function ProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, loading: authLoading, fetchUser, setUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTraining, setSavingTraining] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>("NOT_STARTED");
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingStartDate, setTrainingStartDate] = useState("");
  const [trainingEndDate, setTrainingEndDate] = useState("");
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    role: "JUNIOR_DEV" as UserProfile["role"],
    department: "",
    joinDate: "",
    photoUrl: "",
    skills: "",
    githubUrl: "",
    linkedinUrl: "",
    internalNotes: "",
  });
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError("");

      const profileRes = await api.get(`/profile/${id}`);
      const nextProfile = profileRes.data as UserProfile;

      setProfile(nextProfile);
      setTrainingStatus(nextProfile.trainingStatus || "NOT_STARTED");
      setTrainingProgress(nextProfile.trainingProgress ?? 0);
      setTrainingStartDate(toInputDate(nextProfile.trainingStartDate));
      setTrainingEndDate(toInputDate(nextProfile.trainingEndDate));
      setProfileForm({
        name: nextProfile.name || "",
        email: nextProfile.email || "",
        role: nextProfile.role,
        department: nextProfile.department || "",
        joinDate: toInputDate(nextProfile.joinDate),
        photoUrl: nextProfile.photoUrl || "",
        skills: Array.isArray(nextProfile.skills) ? nextProfile.skills.join(", ") : "",
        githubUrl: nextProfile.githubUrl || "",
        linkedinUrl: nextProfile.linkedinUrl || "",
        internalNotes: nextProfile.internalNotes || "",
      });

      const [feedbackResult, tasksResult] = await Promise.allSettled([
        api.get(`/feedback/${id}`),
        api.get(`/tasks/${id}`),
      ]);

      setFeedback(feedbackResult.status === "fulfilled" ? (feedbackResult.value.data as Feedback[]) : []);
      setTasks(tasksResult.status === "fulfilled" ? (tasksResult.value.data as Task[]) : []);
    } catch (err) {
      const apiError = err as AxiosError<ApiError>;
      setError(apiError.response?.data?.message || "Unable to load this profile.");
      setProfile(null);
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

    void fetchData();
  }, [authLoading, fetchData, router, user]);

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
          <p className="text-sm font-medium text-slate-500">{error || "Profile not found."}</p>
        </div>
      </div>
    );
  }

  const isHr = user?.role === "HR";
  const isTeamLead = user?.role === "TEAM_LEAD";
  const isDeveloper = user?.role === "JUNIOR_DEV" || user?.role === "SENIOR_DEV";
  const isSelf = user?.id === id;
  const canTeamLeadManageThisProfile =
    Boolean(
      isTeamLead &&
      (profile.role === "JUNIOR_DEV" || profile.role === "SENIOR_DEV" || isSelf)
    );
  const canEditName = Boolean(isHr || canTeamLeadManageThisProfile || (isDeveloper && isSelf));
  const canEditPhoto = Boolean(isHr || canTeamLeadManageThisProfile || (isDeveloper && isSelf));
  const canEditLinks = Boolean(isHr || canTeamLeadManageThisProfile || (isDeveloper && isSelf));
  const canEditSkills = Boolean(isHr || isTeamLead || (isDeveloper && isSelf));
  const canEditDepartment = Boolean(isHr);
  const canEditEmail = Boolean(isHr);
  const canEditJoinDate = Boolean(isHr);
  const canEditRole = Boolean(isHr && !isSelf);
  const canEditNotes = Boolean(isHr || isTeamLead);
  const canManageTraining = Boolean(isHr || (isTeamLead && !isSelf && (profile.role === "JUNIOR_DEV" || profile.role === "SENIOR_DEV")));
  const canAssignTasks = Boolean((isHr || isTeamLead) && (profile.role === "JUNIOR_DEV" || profile.role === "SENIOR_DEV"));
  const canEditProfile =
    canEditName ||
    canEditPhoto ||
    canEditLinks ||
    canEditSkills ||
    canEditDepartment ||
    canEditEmail ||
    canEditJoinDate ||
    canEditRole ||
    canEditNotes;
  const canUseFeedback =
    (user?.role === "SENIOR_DEV" || isTeamLead || isHr) &&
    (profile.role === "JUNIOR_DEV" || profile.role === "SENIOR_DEV") &&
    user?.id !== profile.id;

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      setError("");

      const payload = {
        name: canEditName ? profileForm.name.trim() : undefined,
        email: canEditEmail ? profileForm.email.trim() : undefined,
        role: canEditRole ? profileForm.role : undefined,
        department: canEditDepartment ? profileForm.department.trim() : undefined,
        joinDate: canEditJoinDate ? profileForm.joinDate || null : undefined,
        photoUrl: canEditPhoto ? profileForm.photoUrl.trim() : undefined,
        skills: canEditSkills
          ? profileForm.skills
              .split(",")
              .map((skill) => skill.trim())
              .filter(Boolean)
          : undefined,
        githubUrl: canEditLinks ? profileForm.githubUrl.trim() : undefined,
        linkedinUrl: canEditLinks ? profileForm.linkedinUrl.trim() : undefined,
        internalNotes: canEditNotes ? profileForm.internalNotes.trim() : undefined,
      };

      const response = await api.patch(`/profile/${id}`, payload);
      const updatedUser = response.data?.user as UserProfile | undefined;
      await fetchData();

      if (isSelf && updatedUser) {
        setUser(updatedUser);
      } else if (isSelf) {
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
      const response = await api.patch("/profile/training/status", {
        id,
        trainingStatus,
        trainingProgress,
        trainingStartDate: trainingStartDate || undefined,
        trainingEndDate: trainingEndDate || undefined,
      });
      const updatedUser = response.data?.user as UserProfile | undefined;
      toast.success("Training progress updated");
      await fetchData();
      if (isSelf && updatedUser) {
        setUser(updatedUser);
      } else if (isSelf) {
        await fetchUser();
      }
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
            <p className="section-subtitle mt-2">
              Every field on this form is shown only when your role is allowed to edit it.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {canEditName && (
                <input
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((current) => ({ ...current, name: e.target.value }))}
                  className="field"
                  placeholder="Full name"
                />
              )}
              {canEditEmail && (
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((current) => ({ ...current, email: e.target.value }))}
                  className="field"
                  placeholder="Email"
                />
              )}
              {canEditRole && (
                <select
                  value={profileForm.role}
                  onChange={(e) => setProfileForm((current) => ({ ...current, role: e.target.value as UserProfile["role"] }))}
                  className="field"
                >
                  <option value="JUNIOR_DEV">Junior Dev</option>
                  <option value="SENIOR_DEV">Senior Dev</option>
                  <option value="TEAM_LEAD">Team Lead</option>
                  <option value="HR">HR</option>
                </select>
              )}
              {canEditDepartment && (
                <input
                  value={profileForm.department}
                  onChange={(e) => setProfileForm((current) => ({ ...current, department: e.target.value }))}
                  className="field"
                  placeholder="Department"
                />
              )}
              {canEditJoinDate && (
                <input
                  type="date"
                  value={profileForm.joinDate}
                  onChange={(e) => setProfileForm((current) => ({ ...current, joinDate: e.target.value }))}
                  className="field"
                />
              )}
              {canEditPhoto && (
                <input
                  value={profileForm.photoUrl}
                  onChange={(e) => setProfileForm((current) => ({ ...current, photoUrl: e.target.value }))}
                  className="field"
                  placeholder="Profile photo URL"
                />
              )}
              {canEditLinks && (
                <input
                  value={profileForm.githubUrl}
                  onChange={(e) => setProfileForm((current) => ({ ...current, githubUrl: e.target.value }))}
                  className="field"
                  placeholder="GitHub URL"
                />
              )}
              {canEditLinks && (
                <input
                  value={profileForm.linkedinUrl}
                  onChange={(e) => setProfileForm((current) => ({ ...current, linkedinUrl: e.target.value }))}
                  className="field"
                  placeholder="LinkedIn URL"
                />
              )}
            </div>

            <div className="mt-4 grid gap-4">
              {canEditSkills && (
                <textarea
                  value={profileForm.skills}
                  onChange={(e) => setProfileForm((current) => ({ ...current, skills: e.target.value }))}
                  className="field min-h-[110px] resize-y"
                  placeholder="Skills / tech stack, separated by commas"
                />
              )}
              {canEditNotes && (
                <textarea
                  value={profileForm.internalNotes}
                  onChange={(e) => setProfileForm((current) => ({ ...current, internalNotes: e.target.value }))}
                  className="field min-h-[140px] resize-y"
                  placeholder="Internal notes for HR and Team Lead"
                />
              )}
            </div>

            <div className="mt-6">
              <button onClick={saveProfile} disabled={savingProfile} className="btn-primary">
                {savingProfile ? "Saving..." : "Save Profile Changes"}
              </button>
            </div>
          </section>
        )}

        {canManageTraining && (
          <section className="premium-panel rounded-[28px] p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Training control</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-950">Update training timeline and status</h3>
            <p className="section-subtitle mt-2">
              HR and Team Lead can update the training dates and overall training status.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Training status</label>
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
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Training start date</label>
                <input
                  type="date"
                  value={trainingStartDate}
                  onChange={(e) => setTrainingStartDate(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Training end date</label>
                <input
                  type="date"
                  value={trainingEndDate}
                  onChange={(e) => setTrainingEndDate(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Training progress</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={trainingProgress}
                  onChange={(e) => setTrainingProgress(Number(e.target.value))}
                  className="field"
                />
              </div>
            </div>

            <div className="mt-6">
              <button onClick={saveTraining} disabled={savingTraining} className="btn-primary">
                {savingTraining ? "Saving..." : "Save Training Update"}
              </button>
            </div>
          </section>
        )}

        <section className="premium-panel rounded-[28px] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Task tracking</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">Assigned training tasks</h3>
              <p className="section-subtitle mt-2">
                Review priority, due date, status flow, and ownership for this developer&apos;s assigned work.
              </p>
            </div>

            {canAssignTasks && (
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setShowAssignModal(true);
                }}
                className="btn-primary"
              >
                Assign Task
              </button>
            )}
          </div>

          <div className="mt-6">
            <TaskTable
              tasks={tasks}
              currentUserRole={user?.role}
              currentUserId={user?.id}
              onRefresh={fetchData}
              onEdit={(task) => {
                setSelectedTask(task);
                setShowAssignModal(true);
              }}
            />
          </div>
        </section>

        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        <FeedbackSection feedback={feedback} onRefresh={fetchData} />
        {canUseFeedback && <FeedbackForm developerId={id} onSuccess={fetchData} />}

        {showAssignModal && (
          <AssignTaskModal
            task={selectedTask}
            assignee={profile.role === "JUNIOR_DEV" || profile.role === "SENIOR_DEV" ? profile : null}
            onClose={() => {
              setShowAssignModal(false);
              setSelectedTask(null);
            }}
            onSuccess={() => {
              setShowAssignModal(false);
              setSelectedTask(null);
              void fetchData();
            }}
          />
        )}
      </main>
    </div>
  );
}
