CREATE TABLE "LoginOtp" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginOtp_email_expiresAt_idx" ON "LoginOtp"("email", "expiresAt");
