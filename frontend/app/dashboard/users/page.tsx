"use client";

import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Role, UserProfile } from "@/lib/types";

type InviteResponse = {
  message: string;
};

const inviteRoles: Role[] = ["JUNIOR_DEV", "SENIOR_DEV", "TEAM_LEAD", "HR"];
const developerRoles: Role[] = ["JUNIOR_DEV", "SENIOR_DEV"];

const formatRole = (role: string) =>
  role
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("JUNIOR_DEV");
  const [inviteMessage, setInviteMessage] = useState("");
  const [error, setError] = useState("");
  const { user, loading } = useAuth();
  const router = useRouter();
  const hasUserManagementAccess = user?.role === "HR";
  const accessError =
    !loading && user && !hasUserManagementAccess ? "User management is only available to HR." : "";

  const fetchUsers = useCallback(async () => {
    try {
      setError("");
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (error: unknown) {
      setUsers([]);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message || "Unable to load users."
        : "Unable to load users.";

      setError(message);
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (!hasUserManagementAccess) {
      return;
    }

    const loadUsers = async () => {
      await fetchUsers();
    };

    void loadUsers();
  }, [fetchUsers, hasUserManagementAccess, loading, router, user]);

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="app-panel rounded-[28px] px-8 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">Loading user management...</p>
        </div>
      </div>
    );
  }

  const createInvite = async () => {
    setError("");
    setInviteMessage("");

    try {
      const res = await api.post<InviteResponse>("/users/invite", {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteMessage(res.data.message);
      setInviteEmail("");
      await fetchUsers();
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message || "Unable to create invite."
        : "Unable to create invite.";

      setError(message);
    }
  };

  const updateRole = async (userId: string, role: Role) => {
    try {
      await api.patch(`/users/${userId}/role`, { role });
      await fetchUsers();
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message || "Unable to update role."
        : "Unable to update role.";

      setError(message);
    }
  };

  const deleteUser = async (user: UserProfile) => {
    const confirmed = window.confirm(
      `Permanently delete ${user.name}'s profile? This will remove the user and related records from the database.`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/users/${user.id}`);
      await fetchUsers();
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message || "Unable to delete user."
        : "Unable to delete user.";

      setError(message);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />

      <main className="app-container space-y-6">
        <section className="premium-panel rounded-[30px] px-6 py-6 md:px-8">
          <div className="page-header">
            <div className="page-header-main">
              <p className="page-header-kicker">Administration</p>
              <h1 className="page-header-title">User Management</h1>
              <p className="page-header-copy">
                Create invites, assign roles, and keep workspace access aligned with team responsibilities.
              </p>
            </div>
          </div>
        </section>

        <section className="premium-panel rounded-[28px] p-6 md:p-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-950">Create invite</h2>
            <p className="text-sm text-slate-500">Generate a setup link for a new teammate.</p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="developer@example.com"
              className="field"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="field"
            >
              {inviteRoles.map((role) => (
                <option key={role} value={role}>
                  {formatRole(role)}
                </option>
              ))}
            </select>
            <button onClick={createInvite} className="btn-primary">
              Send Invite
            </button>
          </div>

          {inviteMessage && (
            <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {inviteMessage}
            </p>
          )}
        </section>

        {(accessError || error) && (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{accessError || error}</p>
        )}

        <section className="table-shell">
          <table>
            <colgroup>
              <col className="w-[21%]" />
              <col className="w-[34%]" />
              <col className="w-[25%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <p className="font-semibold text-slate-900">{user.name}</p>
                  </td>
                  <td className="text-sm text-slate-600">{user.email}</td>
                  <td>
                    <div className="max-w-[240px]">
                      {user.role === "JUNIOR_DEV" || user.role === "SENIOR_DEV" ? (
                        <select
                          value={user.role}
                          onChange={(e) => updateRole(user.id, e.target.value as Role)}
                          className="field px-3 py-2 text-sm"
                        >
                          {developerRoles.map((role) => (
                            <option key={role} value={role}>
                              {formatRole(role)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                          {formatRole(user.role)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        onClick={() => deleteUser(user)}
                        className="btn-secondary px-3 py-2 text-sm text-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
