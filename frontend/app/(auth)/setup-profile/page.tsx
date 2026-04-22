"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { AxiosError } from "axios";
import ProfilePhotoUploadField from "@/components/ProfilePhotoUploadField";

type ApiError = {
  message?: string;
};

export default function SetupProfilePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    photoUrl: "",
    skills: "",
    githubUrl: "",
    linkedinUrl: "",
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);

      await api.post("/profile/setup", {
        name: form.name,
        photoUrl: form.photoUrl,
        skills: form.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        githubUrl: form.githubUrl,
        linkedinUrl: form.linkedinUrl,
      });

      toast.success("Profile setup completed");
      router.push("/dashboard");
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      toast.error(error.response?.data?.message || "Failed to setup profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card grid md:grid-cols-[0.88fr_1.12fr]">
        <section className="bg-slate-950 px-7 py-10 text-white md:px-10 md:py-12">
          <span className="section-kicker border-white/10 bg-white/8 text-blue-200">
            <span className="eyebrow-dot" />
            Profile completion
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">Add the context your team needs.</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
            HR controls access and role assignment first. This step lets you finish your own profile with the personal details only you should maintain.
          </p>
        </section>

        <section className="px-7 py-10 md:px-10 md:py-12">
          <div className="mx-auto max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Setup profile</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">Tell the workspace about you</h2>

            <div className="mt-8 grid gap-4">
              <input
                className="field"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <ProfilePhotoUploadField
                photoUrl={form.photoUrl}
                name={form.name}
                uploadPath="/profile/photo"
                disabled={loading}
                onPhotoChange={(photoUrl) => setForm((current) => ({ ...current, photoUrl }))}
              />

              <input
                className="field"
                placeholder="Skills (React, Node, SQL)"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
              />

              <input
                className="field"
                placeholder="GitHub URL"
                value={form.githubUrl}
                onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
              />

              <input
                className="field"
                placeholder="LinkedIn URL"
                value={form.linkedinUrl}
                onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
              />

              <button onClick={handleSubmit} disabled={loading} className="btn-primary mt-2 w-full">
                {loading ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
