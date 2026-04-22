"use client";

import ProgressBar from "@/components/progressBar";
import TrainingStatusBadge from "@/components/TrainingStatusBadge";
import { useAuth } from "@/context/AuthContext";
import { resolveAssetUrl } from "@/lib/media";
import { UserProfile } from "@/lib/types";

type ProfileCardProps = {
  user: UserProfile;
};

const formatRole = (role?: string) =>
  role
    ? role
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Team Member";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "Not available";

export default function ProfileCard({ user }: ProfileCardProps) {
  const { user: viewer } = useAuth();
  const canViewInternalNotes = viewer?.role === "HR" || viewer?.role === "TEAM_LEAD";
  const showsTrainingDetails = user.role === "JUNIOR_DEV" || user.role === "SENIOR_DEV";
  const photoUrl = resolveAssetUrl(user.photoUrl);

  return (
    <section className="premium-panel rounded-[28px] p-6 md:p-8">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Profile overview</p>
          <div className="mt-4 flex items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] bg-slate-100 text-2xl font-semibold text-slate-600">
              {photoUrl ? (
                <img src={photoUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-3xl font-semibold text-slate-950">{user.name}</h2>
              <p className="mt-2 text-base text-slate-600">{user.email || "Email unavailable"}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="badge bg-blue-100 text-blue-700">{formatRole(user.role)}</span>
            {showsTrainingDetails && user.trainingStatus && <TrainingStatusBadge status={user.trainingStatus} />}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="soft-stat">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Department</p>
              <p className="mt-2 font-medium text-slate-900">{user.department || "Not specified"}</p>
            </div>
            <div className="soft-stat">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Joined</p>
              <p className="mt-2 font-medium text-slate-900">{formatDate(user.joinDate)}</p>
            </div>
            {showsTrainingDetails && (
              <div className="soft-stat">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Training starts</p>
                <p className="mt-2 font-medium text-slate-900">{formatDate(user.trainingStartDate)}</p>
              </div>
            )}
            {showsTrainingDetails && (
              <div className="soft-stat">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Training ends</p>
                <p className="mt-2 font-medium text-slate-900">{formatDate(user.trainingEndDate)}</p>
              </div>
            )}
          </div>

          {showsTrainingDetails && (
            <div className="soft-stat mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Training progress</p>
              <div className="mt-3">
                <ProgressBar value={user.trainingProgress ?? 0} />
              </div>
            </div>
          )}

          {canViewInternalNotes && (
            <div className="soft-stat mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Internal notes</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {user.internalNotes?.trim() || "No internal notes added."}
              </p>
            </div>
          )}
        </div>

        <div className="spotlight-card p-6">
          <p className="text-sm font-semibold text-slate-300">Skill coverage</p>
          <h3 className="mt-2 text-2xl font-semibold">Current strengths</h3>

          {user.skills && user.skills.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {user.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-sm font-medium text-slate-100"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-slate-300">No skills have been recorded for this profile yet.</p>
          )}

          <div className="mt-6 grid gap-3">
            <a
              href={user.githubUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                user.githubUrl
                  ? "border-white/15 bg-white/6 text-white"
                  : "cursor-default border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              GitHub: {user.githubUrl || "Not added"}
            </a>
            <a
              href={user.linkedinUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                user.linkedinUrl
                  ? "border-white/15 bg-white/6 text-white"
                  : "cursor-default border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              LinkedIn: {user.linkedinUrl || "Not added"}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
