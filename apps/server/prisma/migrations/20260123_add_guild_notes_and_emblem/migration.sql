-- Add internalNotes and emblemUrl to Guild table
ALTER TABLE "Guild" ADD COLUMN "internalNotes" TEXT;
ALTER TABLE "Guild" ADD COLUMN "emblemUrl" TEXT;
