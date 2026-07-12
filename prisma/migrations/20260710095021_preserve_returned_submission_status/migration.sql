-- AlterTable
ALTER TABLE `Submission` ADD COLUMN `returnedFromStatus` ENUM('DRAFT', 'SUBMITTED', 'MAKEUP', 'VOIDED') NULL;
