ALTER TABLE "Task"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

UPDATE "Task"
SET "createdById" = "assignedById",
    "updatedById" = "assignedById"
WHERE "createdById" IS NULL OR "updatedById" IS NULL;

ALTER TABLE "Task"
ALTER COLUMN "createdById" SET NOT NULL,
ALTER COLUMN "updatedById" SET NOT NULL;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "Task_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
