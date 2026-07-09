-- AlterTable
ALTER TABLE "User" ADD COLUMN "gender" TEXT,
                   ADD COLUMN "splitType" TEXT NOT NULL DEFAULT 'fullbody',
                   ADD COLUMN "equipmentPreference" TEXT NOT NULL DEFAULT 'gym',
                   ADD COLUMN "dietaryRestrictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                   ADD COLUMN "trainingDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
                   ADD COLUMN "phone" TEXT;
