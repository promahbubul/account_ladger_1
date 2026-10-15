-- AlterTable users: make full_name optional (nullable)
ALTER TABLE "users" ALTER COLUMN "full_name" DROP NOT NULL;
