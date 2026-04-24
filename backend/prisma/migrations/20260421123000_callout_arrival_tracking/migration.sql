ALTER TABLE "TimeEntry"
ADD COLUMN "arrived_at" TIMESTAMP(3),
ADD COLUMN "arrival_latitude" DOUBLE PRECISION,
ADD COLUMN "arrival_longitude" DOUBLE PRECISION,
ADD COLUMN "arrival_address" TEXT,
ADD COLUMN "travel_minutes" INTEGER,
ADD COLUMN "travel_miles" DOUBLE PRECISION;
