import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Training Tracker",
  description: "Training operations dashboard for onboarding, assignments, profiles, and audit visibility.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-screen">
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="top-right" reverseOrder={false} />
      </body>
    </html>
  );
}
