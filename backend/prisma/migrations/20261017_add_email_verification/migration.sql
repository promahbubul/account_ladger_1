-- AlterTable users: add email_verified
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable email_verification_codes
CREATE TABLE IF NOT EXISTS "email_verification_codes" (
    "id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "attempts" INT NOT NULL DEFAULT 0,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_verification_codes_user_id_idx" ON "email_verification_codes"("user_id");
CREATE INDEX IF NOT EXISTS "email_verification_codes_code_hash_idx" ON "email_verification_codes"("code_hash");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_verification_codes_user_id_fkey'
  ) THEN
    ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Migration of legacy accounts:
-- Google authenticated accounts (where email verification was already confirmed by Google) and system administrators
UPDATE "users" SET "email_verified" = true WHERE "auth_provider" IN ('GOOGLE', 'GOOGLE_LINKED') OR "role" = 'ADMIN';
