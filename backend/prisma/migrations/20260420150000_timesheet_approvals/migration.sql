-- AlterTable
ALTER TABLE "TimeEntry"
ADD COLUMN "approved_by_user_id" TEXT,
ADD COLUMN "approved_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "TimeEntry"
ADD CONSTRAINT "TimeEntry_approved_by_user_id_fkey"
FOREIGN KEY ("approved_by_user_id") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
