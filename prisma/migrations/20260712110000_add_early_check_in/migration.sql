-- AlterTable
ALTER TABLE `CheckInPlan`
    ADD COLUMN `allowEarlyCheckIn` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `earlyCheckInDays` INTEGER NOT NULL DEFAULT 0;
