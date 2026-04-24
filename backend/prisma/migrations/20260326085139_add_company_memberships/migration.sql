-- CreateTable
CREATE TABLE "company_memberships" (
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,

    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("user_id","company_id")
);

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one membership per existing user (matches legacy single-company model)
INSERT INTO "company_memberships" ("user_id", "company_id", "role")
SELECT "id", "company_id", "role" FROM "User";
