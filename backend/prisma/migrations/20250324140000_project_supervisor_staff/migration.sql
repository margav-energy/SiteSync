-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "supervisor_id" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "assigned_staff_id" TEXT;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Project_supervisor_id_fkey'
  ) THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_supervisor_id_fkey"
      FOREIGN KEY ("supervisor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Project_assigned_staff_id_fkey'
  ) THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_assigned_staff_id_fkey"
      FOREIGN KEY ("assigned_staff_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
