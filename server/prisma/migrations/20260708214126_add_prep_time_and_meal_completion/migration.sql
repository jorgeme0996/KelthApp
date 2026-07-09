-- AlterTable
ALTER TABLE "MealPlanEntry" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "prepTimeMinutes" INTEGER;
