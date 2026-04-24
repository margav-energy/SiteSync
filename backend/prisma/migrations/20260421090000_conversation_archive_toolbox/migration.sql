-- Add conversation type and archive tracking.
CREATE TYPE "ConversationType" AS ENUM ('direct', 'toolbox');

ALTER TABLE "Conversation"
ADD COLUMN "type" "ConversationType" NOT NULL DEFAULT 'direct',
ADD COLUMN "archived_by" TEXT[] DEFAULT ARRAY[]::TEXT[];
