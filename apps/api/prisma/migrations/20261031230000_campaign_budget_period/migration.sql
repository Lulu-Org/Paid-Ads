-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('monthly', 'daily', 'total');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "budgetPeriod" "BudgetPeriod" NOT NULL DEFAULT 'monthly';
