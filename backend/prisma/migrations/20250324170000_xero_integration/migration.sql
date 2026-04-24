-- CreateEnum
CREATE TYPE "XeroConnectionStatus" AS ENUM ('active', 'disconnected', 'reauth_required');

-- CreateTable
CREATE TABLE "xero_connections" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "xero_tenant_id" TEXT,
    "xero_tenant_name" TEXT,
    "xero_connection_id" TEXT,
    "access_token_enc" TEXT,
    "refresh_token_enc" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scopes" TEXT,
    "status" "XeroConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "connected_by_user_id" TEXT,
    "connected_at" TIMESTAMP(3),
    "last_refreshed_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xero_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "xero_connections_company_id_key" ON "xero_connections"("company_id");
CREATE UNIQUE INDEX "xero_connections_xero_tenant_id_key" ON "xero_connections"("xero_tenant_id");

CREATE TABLE "xero_oauth_pending" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "encrypted_token_bundle" TEXT NOT NULL,
    "tenants_json" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xero_oauth_pending_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "xero_oauth_pending_company_id_idx" ON "xero_oauth_pending"("company_id");

CREATE TABLE "xero_audit_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xero_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "xero_audit_logs_company_id_idx" ON "xero_audit_logs"("company_id");
CREATE INDEX "xero_audit_logs_created_at_idx" ON "xero_audit_logs"("created_at");

ALTER TABLE "xero_connections" ADD CONSTRAINT "xero_connections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "xero_connections" ADD CONSTRAINT "xero_connections_connected_by_user_id_fkey" FOREIGN KEY ("connected_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "xero_oauth_pending" ADD CONSTRAINT "xero_oauth_pending_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "xero_oauth_pending" ADD CONSTRAINT "xero_oauth_pending_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
