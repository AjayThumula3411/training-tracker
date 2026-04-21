"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { FaEnvelope, FaLock, FaShieldAlt, FaKey } from "react-icons/fa";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Input from "@/components/Input";
import { storeAuthToken } from "@/lib/auth-storage";
import { useAuth } from "@/context/AuthContext";

type ApiError = {
  message?: string;
};

type LoginOtpResponse = {
  message: string;
  email: string;
  expiresInMinutes: number;
};

type VerifyOtpResponse = {
  message: string;
  token: string;
  user: {
    id: string;
    name: string;
    role: "JUNIOR_DEV" | "SENIOR_DEV" | "TEAM_LEAD" | "HR";
  };
};

export default function LoginPage() {
  const router = useRouter();
  const { fetchUser, setUser, user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const requestOtp = async () => {
    try {
      setLoading(true);
      const res = await api.post<LoginOtpResponse>("/auth/login", { email, password });
      setEmail(res.data.email);
      setOtpEmail(res.data.email);
      setOtp("");
      setStep(2);
      toast.success(res.data.message || "OTP sent to your email");
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      const message = error.response?.data?.message || "Unable to send OTP";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setLoading(true);
      const res = await api.post<VerifyOtpResponse>("/auth/verify-otp", { email: otpEmail || email, otp });
      storeAuthToken(res.data.token);
      setUser({
        id: res.data.user.id,
        name: res.data.user.name,
        role: res.data.user.role,
      });
      await fetchUser();

      toast.success("Welcome back");
      router.replace("/dashboard");
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      toast.error(error.response?.data?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [authLoading, router, user]);

  const progressValue = step === 1 ? 50 : 100;

  return (
    <div className="auth-shell">
      <div className="auth-card grid md:grid-cols-[0.9fr_1.1fr]">
        <section className="auth-hero bg-slate-950 px-7 py-10 text-white md:px-10 md:py-12">
          <span className="premium-chip border-white/10 bg-white/8 text-blue-200">
            <span className="premium-chip-dot" />
            Secure access
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">Run training operations with more clarity.</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
            Sign in to manage assignments, review profile progress, and keep onboarding activity visible across the team.
          </p>

          <div className="mt-10 space-y-4">
            {[ 
              "Role-aware access for HR, leads, and developers",
              "One view for assignments, feedback, and status",
              "Audit-ready workspace for operational changes",
            ].map((item) => (
              <div key={item} className="glass-card-dark flex items-start gap-3 rounded-2xl px-4 py-4">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
                  <FaShieldAlt />
                </div>
                <p className="text-sm leading-6 text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-form-shell px-7 py-10 md:px-10 md:py-12">
          <div className="relative mx-auto max-w-md rounded-[30px] border border-white/60 bg-white/72 p-7 shadow-[0_24px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Welcome back</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">Sign in to your workspace</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Use your team credentials, then verify the OTP sent to your email.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                <span>Credentials</span>
                <span>Email OTP</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              <p className="text-sm text-slate-500">
                {step === 1 ? "Step 1 of 2: verify your credentials" : "Step 2 of 2: enter the email OTP"}
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {step === 1 ? (
                <>
                  <Input
                    icon={<FaEnvelope />}
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />

                  <Input
                    icon={<FaLock />}
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />

                  <button onClick={requestOtp} disabled={loading} className="btn-primary w-full">
                    {loading ? "Sending OTP..." : "Send OTP"}
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    OTP sent to <span className="font-semibold">{otpEmail || email}</span>.
                  </div>

                  <Input
                    icon={<FaKey />}
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    autoComplete="one-time-code"
                  />

                  <button onClick={verifyOtp} disabled={loading || otp.trim().length < 6} className="btn-primary w-full">
                    {loading ? "Verifying OTP..." : "Verify OTP"}
                  </button>

                  <button
                    onClick={requestOtp}
                    disabled={loading}
                    className="btn-secondary w-full"
                  >
                    Resend OTP
                  </button>

                  <button
                    onClick={() => {
                      setStep(1);
                      setOtp("");
                      setOtpEmail("");
                    }}
                    disabled={loading}
                    className="w-full text-sm font-semibold text-slate-500"
                  >
                    Back to credentials
                  </button>
                </>
              )}
            </div>

            <p className="mt-6 text-sm text-slate-500">
              Need an account?{" "}
              <Link href="/register" className="font-semibold text-blue-700">
                Register
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
