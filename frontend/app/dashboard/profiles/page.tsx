"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { UserProfile } from "@/lib/types";

const roleLabel = (role?: string) =>
  role
    ? role
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Team Member";

const isDeveloperRole = (role?: string) => role === "JUNIOR_DEV" || role === "SENIOR_DEV";

export default function ProfilesPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, loading } = useAuth();
  const canBrowseDirectory = user?.role === "HR" || user?.role === "TEAM_LEAD";

  const fetchUsers = useCallback(async () => {
    try {
      setError("");
      const res = await api.get("/profiles");
      setUsers(res.data);
    } catch (err) {
      setUsers([]);
      setError("Unable to load profiles right now.");
      console.error("Error fetching users", err);
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (!canBrowseDirectory) {
      router.replace("/dashboard/profile");
      return;
    }

    const loadProfiles = async () => {
      await fetchUsers();
    };

    void loadProfiles();
  }, [canBrowseDirectory, fetchUsers, loading, router, user]);

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="app-panel rounded-[28px] px-8 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">Loading profiles...</p>
        </div>
      </div>
    );
  }

  if (!canBrowseDirectory) {
    return null;
  }

  return (
    <div className="app-shell">
      <Navbar />

      <main className="app-container space-y-6">
        <section className="premium-panel rounded-[30px] px-6 py-6 md:px-8">
          <div className="page-header">
            <div className="page-header-main">
              <p className="page-header-kicker">Directory</p>
              <h1 className="page-header-title">Profiles</h1>
              <p className="page-header-copy">
                {canBrowseDirectory
                  ? "Browse team profiles, training progress, and profile details based on your role visibility."
                  : "Open your profile, keep personal details current, and track your training journey."}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {error && (
            <div className="md:col-span-2 xl:col-span-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {users.map((profile) => (
            <button
              key={profile.id}
              onClick={() => router.push(`/dashboard/profiles/${profile.id}`)}
              className="premium-panel rounded-[26px] p-6 text-left transition hover:-translate-y-1"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-semibold text-slate-600">
                    {profile.photoUrl ? (
                      <img src={profile.photoUrl} alt={profile.name} className="h-full w-full object-cover" />
                    ) : (
                      profile.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">{profile.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{profile.email || "Email not available"}</p>
                  </div>
                </div>
                <span className="badge bg-blue-100 text-blue-700">{roleLabel(profile.role)}</span>
              </div>

              <div className="mt-6 grid gap-3 text-sm text-slate-600">
                <div className="soft-stat">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Department</p>
                  <p className="mt-2 font-medium text-slate-900">{profile.department || "Not set"}</p>
                </div>
                <div className="soft-stat">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Skills</p>
                  <p className="mt-2 line-clamp-2 font-medium text-slate-900">
                    {profile.skills?.length ? profile.skills.join(", ") : "No skills listed"}
                  </p>
                </div>
                {isDeveloperRole(profile.role) ? (
                  <div className="soft-stat">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Training status</p>
                    <p className="mt-2 font-medium text-slate-900">
                      {profile.trainingStatus ? profile.trainingStatus.replaceAll("_", " ") : "Not started"}
                    </p>
                  </div>
                ) : (
                  <div className="soft-stat">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Role scope</p>
                    <p className="mt-2 font-medium text-slate-900">{roleLabel(profile.role)}</p>
                  </div>
                )}
              </div>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}
