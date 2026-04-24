-- AlterTable
ALTER TABLE "Incident"
ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN "photo_url" TEXT,
ADD COLUMN "resolved_by_user_id" TEXT,
ADD COLUMN "resolved_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Incident"
ADD CONSTRAINT "Incident_resolved_by_user_id_fkey"
FOREIGN KEY ("resolved_by_user_id") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
