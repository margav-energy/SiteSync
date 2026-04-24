-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;

-- Backfill: assign each existing project to the first admin (or superadmin) in that company so visibility rules apply.
UPDATE "Project" AS p
SET created_by_user_id = sub.uid
FROM (
  SELECT DISTINCT ON (company_id) company_id, id AS uid
  FROM "User"
  WHERE role IN ('admin', 'superadmin')
  ORDER BY company_id, CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at ASC
) AS sub
WHERE p.company_id = sub.company_id
  AND p.created_by_user_id IS NULL;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Project_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_created_by_user_id_fkey"
      FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
