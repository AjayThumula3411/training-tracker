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

export default function ProfilesPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, loading } = useAuth();
  const hasProfileAccess = Boolean(user);
  const accessError = "";

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

    if (!hasProfileAccess) {
      return;
    }

    const loadProfiles = async () => {
      await fetchUsers();
    };

    void loadProfiles();
  }, [fetchUsers, hasProfileAccess, loading, router, user]);

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="app-panel rounded-[28px] px-8 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">Loading profiles...</p>
        </div>
      </div>
    );
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
                Browse team context and open profile feedback history based on your role visibility.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(accessError || error) && (
            <div className="md:col-span-2 xl:col-span-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {accessError || error}
            </div>
          )}

          {users.map((profile) => (
            <button
              key={profile.id}
              onClick={() => router.push(`/dashboard/profiles/${profile.id}`)}
              className="premium-panel rounded-[26px] p-6 text-left transition hover:-translate-y-1"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{profile.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{profile.email || "Email not available"}</p>
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
              </div>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}
