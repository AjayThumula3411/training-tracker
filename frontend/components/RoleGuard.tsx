"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { Role } from "@/lib/types";

type RoleGuardProps = {
  allowedRoles?: Role[];
  roles?: Role[];
  children: ReactNode;
};

export default function RoleGuard({ allowedRoles, roles, children }: RoleGuardProps) {
  const { user } = useAuth();
  const permittedRoles = allowedRoles ?? roles ?? [];

  if (!user || !permittedRoles.includes(user.role)) return null;

  return <>{children}</>;
}
