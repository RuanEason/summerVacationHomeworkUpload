-- CreateTable
CREATE TABLE `SystemConfig` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `systemName` VARCHAR(100) NOT NULL DEFAULT '暑假作业打卡',
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    `rootUserId` VARCHAR(36) NOT NULL,
    `initializedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SystemConfig_rootUserId_key`(`rootUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(36) NOT NULL,
    `username` VARCHAR(64) NOT NULL,
    `displayName` VARCHAR(80) NOT NULL,
    `passwordHash` VARCHAR(255) NULL,
    `role` ENUM('ROOT', 'ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `status` ENUM('PENDING', 'ACTIVE', 'DISABLED') NOT NULL DEFAULT 'PENDING',
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(36) NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    INDEX `User_role_status_idx`(`role`, `status`),
    INDEX `User_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_expiresAt_idx`(`userId`, `expiresAt`),
    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invitation` (
    `id` VARCHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'USED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Invitation_tokenHash_key`(`tokenHash`),
    INDEX `Invitation_userId_status_idx`(`userId`, `status`),
    INDEX `Invitation_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Group` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `ownerAdminId` VARCHAR(36) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Group_ownerAdminId_isActive_idx`(`ownerAdminId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupMember` (
    `id` VARCHAR(36) NOT NULL,
    `groupId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `participatesInCheckIn` BOOLEAN NOT NULL DEFAULT true,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GroupMember_userId_key`(`userId`),
    INDEX `GroupMember_groupId_participatesInCheckIn_idx`(`groupId`, `participatesInCheckIn`),
    UNIQUE INDEX `GroupMember_groupId_userId_key`(`groupId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CheckInPlan` (
    `id` VARCHAR(36) NOT NULL,
    `groupId` VARCHAR(36) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `weekdays` JSON NOT NULL,
    `openTimeMinutes` INTEGER NOT NULL DEFAULT 0,
    `dueTimeMinutes` INTEGER NOT NULL DEFAULT 1439,
    `requiredImageCount` INTEGER NOT NULL DEFAULT 1,
    `maxImageCount` INTEGER NOT NULL DEFAULT 9,
    `allowMakeup` BOOLEAN NOT NULL DEFAULT false,
    `makeupDays` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CheckInPlan_groupId_status_idx`(`groupId`, `status`),
    INDEX `CheckInPlan_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CheckInOccurrence` (
    `id` VARCHAR(36) NOT NULL,
    `planId` VARCHAR(36) NOT NULL,
    `checkInDate` DATE NOT NULL,
    `opensAt` DATETIME(3) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `makeupUntil` DATETIME(3) NULL,
    `requiredImageCount` INTEGER NOT NULL,
    `maxImageCount` INTEGER NOT NULL,
    `status` ENUM('SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CheckInOccurrence_checkInDate_status_idx`(`checkInDate`, `status`),
    INDEX `CheckInOccurrence_opensAt_dueAt_idx`(`opensAt`, `dueAt`),
    UNIQUE INDEX `CheckInOccurrence_planId_checkInDate_key`(`planId`, `checkInDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Submission` (
    `id` VARCHAR(36) NOT NULL,
    `occurrenceId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'MAKEUP', 'VOIDED') NOT NULL DEFAULT 'DRAFT',
    `note` VARCHAR(500) NULL,
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Submission_userId_submittedAt_idx`(`userId`, `submittedAt`),
    INDEX `Submission_status_submittedAt_idx`(`status`, `submittedAt`),
    UNIQUE INDEX `Submission_occurrenceId_userId_key`(`occurrenceId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubmissionImage` (
    `id` VARCHAR(36) NOT NULL,
    `submissionId` VARCHAR(36) NOT NULL,
    `storageKey` VARCHAR(500) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `checksum` CHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SubmissionImage_storageKey_key`(`storageKey`),
    INDEX `SubmissionImage_submissionId_sortOrder_idx`(`submissionId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(36) NOT NULL,
    `actorId` VARCHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entityType` VARCHAR(80) NOT NULL,
    `entityId` VARCHAR(64) NULL,
    `summary` VARCHAR(500) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SystemConfig` ADD CONSTRAINT `SystemConfig_rootUserId_fkey` FOREIGN KEY (`rootUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Group` ADD CONSTRAINT `Group_ownerAdminId_fkey` FOREIGN KEY (`ownerAdminId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CheckInPlan` ADD CONSTRAINT `CheckInPlan_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CheckInOccurrence` ADD CONSTRAINT `CheckInOccurrence_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `CheckInPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_occurrenceId_fkey` FOREIGN KEY (`occurrenceId`) REFERENCES `CheckInOccurrence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubmissionImage` ADD CONSTRAINT `SubmissionImage_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
