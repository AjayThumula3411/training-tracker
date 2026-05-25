"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { FaEnvelope, FaKey, FaLock, FaShieldAlt } from "react-icons/fa";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Input from "@/components/Input";
import { storeAuthToken } from "@/lib/auth-storage";
import { useAuth } from "@/context/AuthContext";

type ApiError = {
  message?: string;
};

type LoginResponse = {
  message: string;
  email: string;
  expiresInMinutes?: number;
  challengeToken: string;
};

type VerifyOtpResponse = {
  message: string;
  email: string;
  challengeToken: string;
  setupRequired: boolean;
  secret?: string;
  otpAuthUri?: string;
  issuer?: string;
  accountName?: string;
};

type VerifyGoogleAuthenticatorResponse = {
  message: string;
  token: string;
  user: {
    id: string;
    name: string;
    role: "JUNIOR_DEV" | "SENIOR_DEV" | "TEAM_LEAD" | "HR";
  };
};

type LoginStep = 1 | 2 | 3;

export default function LoginPage() { // If user is already authenticated, redirect to dashboard
  const router = useRouter();  // Get auth context
  const { fetchUser, setUser, user, loading: authLoading } = useAuth(); // Local state for form inputs and flow control

  const [email, setEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [googleCode, setGoogleCode] = useState("");
  const [emailChallengeToken, setEmailChallengeToken] = useState("");
  const [googleChallengeToken, setGoogleChallengeToken] = useState("");
  const [googleSetup, setGoogleSetup] = useState<{
    setupRequired: boolean;
    secret?: string;
    otpAuthUri?: string;
    issuer?: string;
    accountName?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<LoginStep>(1);

  const requestOtp = async () => {
    try {
      setLoading(true);
      const res = await api.post<LoginResponse>("/auth/login", { email, password });
      setLoginEmail(res.data.email);
      setEmail(res.data.email);
      setEmailOtp("");
      setGoogleCode("");
      setEmailChallengeToken(res.data.challengeToken);
      setGoogleChallengeToken("");
      setGoogleSetup(null);
      setStep(2);
      toast.success(res.data.message || "OTP sent to your email");
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      toast.error(error.response?.data?.message || "Unable to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailOtp = async () => {
    try {
      setLoading(true);
      const res = await api.post<VerifyOtpResponse>("/auth/verify-otp", {
        challengeToken: emailChallengeToken,
        email: loginEmail || email,
        otp: emailOtp,
      });

      setGoogleChallengeToken(res.data.challengeToken);
      setGoogleCode("");
      setGoogleSetup({
        setupRequired: res.data.setupRequired,
        secret: res.data.secret,
        otpAuthUri: res.data.otpAuthUri,
        issuer: res.data.issuer,
        accountName: res.data.accountName,
      });
      setStep(3);
      toast.success(res.data.message || "Continue with Google Authenticator");
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      toast.error(error.response?.data?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const verifyGoogleAuthenticator = async () => {
    try {
      setLoading(true);
      const res = await api.post<VerifyGoogleAuthenticatorResponse>("/auth/verify-google-authenticator", {
        challengeToken: googleChallengeToken,
        otp: googleCode,
      });

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
      toast.error(error.response?.data?.message || "Google Authenticator verification failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [authLoading, router, user]);

  const progressValue = step === 1 ? 34 : step === 2 ? 67 : 100;

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
              "Password, email OTP, and Google Authenticator in one guided flow",
              "Role-aware access for HR, leads, and developers",
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
              Finish all three checks in sequence: password, email OTP, then Google Authenticator.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                <span>Credentials</span>
                <span>Email OTP</span>
                <span>Authenticator</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              <p className="text-sm text-slate-500">
                {step === 1 && "Step 1 of 3: verify your credentials"}
                {step === 2 && "Step 2 of 3: enter the email OTP"}
                {step === 3 && "Step 3 of 3: enter the Google Authenticator code"}
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {step === 1 && (
                <>
                  <Input
                    icon={<FaEnvelope />}
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                  />

                  <Input
                    icon={<FaLock />}
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />

                  <button onClick={requestOtp} disabled={loading} className="btn-primary w-full">
                    {loading ? "Continuing..." : "Continue"}
                  </button>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    OTP sent to <span className="font-semibold">{loginEmail || email}</span>.
                  </div>

                  <Input
                    icon={<FaKey />}
                    placeholder="Enter 6-digit email OTP"
                    value={emailOtp}
                    onChange={(event) => setEmailOtp(event.target.value)}
                    autoComplete="one-time-code"
                  />

                  <button
                    onClick={verifyEmailOtp}
                    disabled={loading || emailOtp.trim().length < 6}
                    className="btn-primary w-full"
                  >
                    {loading ? "Verifying OTP..." : "Verify Email OTP"}
                  </button>

                  <button onClick={requestOtp} disabled={loading} className="btn-secondary w-full">
                    Resend OTP
                  </button>

                  <button
                    onClick={() => {
                      setStep(1);
                      setEmailOtp("");
                      setEmailChallengeToken("");
                    }}
                    disabled={loading}
                    className="w-full text-sm font-semibold text-slate-500"
                  >
                    Back to credentials
                  </button>
                </>
              )}

              {step === 3 && (
                <>
                  {googleSetup?.otpAuthUri ? (
                    <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                      <p className="font-semibold text-emerald-900">
                        {googleSetup.setupRequired
                          ? "Scan Google Authenticator to finish login"
                          : "Google Authenticator scanner"}
                      </p>
                      <p>
                        Scan the QR code in Google Authenticator, then enter the generated 6-digit code to complete login.
                      </p>
                      <div className="flex justify-center rounded-2xl border border-emerald-200 bg-white p-4">
                        <QRCode
                          value={googleSetup.otpAuthUri}
                          size={180}
                          bgColor="#ffffff"
                          fgColor="#0f172a"
                        />
                      </div>
                      <p>
                        Account: <span className="font-semibold">{googleSetup.accountName || loginEmail || email}</span>
                      </p>
                      <p>
                        Issuer: <span className="font-semibold">{googleSetup.issuer || "Training Tracker"}</span>
                      </p>
                      <p className="break-all">
                        Manual setup key: <span className="font-semibold">{googleSetup.secret}</span>
                      </p>
                      <p className="break-all text-xs text-emerald-700">OTP URI: {googleSetup.otpAuthUri}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      Open Google Authenticator and enter the 6-digit code for <span className="font-semibold">{loginEmail || email}</span>.
                    </div>
                  )}

                  <Input
                    icon={<FaKey />}
                    placeholder="Enter 6-digit Google Authenticator code"
                    value={googleCode}
                    onChange={(event) => setGoogleCode(event.target.value)}
                    autoComplete="one-time-code"
                  />

                  <button
                    onClick={verifyGoogleAuthenticator}
                    disabled={loading || googleCode.trim().length < 6}
                    className="btn-primary w-full"
                  >
                    {loading ? "Verifying Authenticator..." : "Verify Google Authenticator"}
                  </button>

                  <button
                    onClick={() => {
                      setStep(2);
                      setGoogleCode("");
                      setGoogleChallengeToken("");
                    }}
                    disabled={loading}
                    className="w-full text-sm font-semibold text-slate-500"
                  >
                    Back to email OTP
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
