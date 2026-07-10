-- AlterTable
ALTER TABLE `submission` ADD COLUMN `returnedFromStatus` ENUM('DRAFT', 'SUBMITTED', 'MAKEUP', 'VOIDED') NULL;
