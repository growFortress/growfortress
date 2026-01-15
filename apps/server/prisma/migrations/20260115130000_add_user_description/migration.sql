-- Add missing user description column
ALTER TABLE "User" ADD COLUMN "description" TEXT DEFAULT '';
