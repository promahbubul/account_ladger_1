-- Migration: 20261015_add_firebase_auth
-- Add firebase_uid, auth_provider, and avatar_url to users table for Google Social Authentication

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firebase_uid" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" VARCHAR(50) DEFAULT 'LOCAL';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;

-- Enforce uniqueness of firebase_uid across non-null records
CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_firebase_uid" ON "users"("firebase_uid") WHERE "firebase_uid" IS NOT NULL;
