-- Adds attendance / geofence columns when the DB was marked in sync without running the baseline SQL.
-- Uses IF NOT EXISTS so databases that applied 20250101000000_init_schema fully are unchanged.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "allowed_radius_meters" DOUBLE PRECISION NOT NULL DEFAULT 150;

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "accuracy_in" DOUBLE PRECISION;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "accuracy_out" DOUBLE PRECISION;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "distance_from_project_in_m" DOUBLE PRECISION;
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "distance_from_project_out_m" DOUBLE PRECISION;
