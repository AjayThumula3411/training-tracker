"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import api from "@/lib/api";
import Input from "@/components/Input";
import { Role } from "@/lib/types";

type ApiError = {
  message?: string;
};

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("JUNIOR_DEV");
  const [inviteToken, setInviteToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) setInviteToken(token);
  }, []);

  const handleRegister = async () => {
    try {
      setLoading(true);
      setError("");

      await api.post("/auth/register", {
        name,
        email,
        password,
        role,
        inviteToken: inviteToken || undefined,
      });

      router.push("/login");
    } catch (err) {
      const responseError = err as AxiosError<ApiError>;
      setError(responseError.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card grid md:grid-cols-[0.95fr_1.05fr]">
        <section className="auth-hero bg-[linear-gradient(160deg,#eff6ff_0%,#ffffff_45%,#ecfeff_100%)] px-7 py-10 md:px-10 md:py-12">
          <span className="premium-chip">
            <span className="premium-chip-dot" />
            Team onboarding
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-slate-950">Set up access for a professional training workspace.</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">
            Create your account to start managing onboarding, delivery readiness, and profile history in one place.
          </p>

          <div className="mt-10 grid gap-4">
            {[
              { title: "Role-based workflow", text: "Separate HR, lead, and developer experiences cleanly." },
              { title: "Fast profile setup", text: "Capture department, skills, and links in minutes." },
              { title: "Clear operational trail", text: "Keep invites, assignments, and changes visible." },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-slate-200 bg-white/90 px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <h3 className="font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-form-shell px-7 py-10 md:px-10 md:py-12">
          <div className="relative mx-auto max-w-md rounded-[30px] border border-white/60 bg-white/72 p-7 shadow-[0_24px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Create account</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">Join Training Tracker</h2>

            {error && <p className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

            <div className="mt-6 space-y-4">
              <Input
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <Input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {inviteToken ? (
                <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Invite detected. Your role will be assigned by HR.
                </p>
              ) : (
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="field"
                >
                  <option value="JUNIOR_DEV">Junior Dev</option>
                  <option value="SENIOR_DEV">Senior Dev</option>
                  <option value="TEAM_LEAD">Team Lead</option>
                  <option value="HR">HR</option>
                </select>
              )}

              <button onClick={handleRegister} disabled={loading} className="btn-primary w-full">
                {loading ? "Creating..." : "Register"}
              </button>
            </div>

            <p className="mt-6 text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-blue-700">
                Login
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
