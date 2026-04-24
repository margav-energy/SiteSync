ALTER TYPE "JobCompletionStatus" ADD VALUE IF NOT EXISTS 'supervisor_approved';

ALTER TABLE "Project"
ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "completed_at" TIMESTAMP(3),
ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archived_at" TIMESTAMP(3);
