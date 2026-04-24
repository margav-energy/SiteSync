-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "action_route" TEXT,
ADD COLUMN "action_params" JSONB;
