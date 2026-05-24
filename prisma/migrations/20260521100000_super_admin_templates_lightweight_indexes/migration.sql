ALTER TABLE `User`
MODIFY `role` VARCHAR(191) NOT NULL DEFAULT 'STAFF';

UPDATE `User`
SET `role` = 'COMPANY_ADMIN'
WHERE `role` IN ('OWNER', 'ADMIN');

ALTER TABLE `User`
MODIFY `role` ENUM('SUPER_ADMIN', 'COMPANY_ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF';

ALTER TABLE `Company`
ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `User`
ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `CompanySettings`
ADD COLUMN `defaultInvoiceTemplate` VARCHAR(191) NOT NULL DEFAULT 'classic',
ADD COLUMN `defaultQuotationTemplate` VARCHAR(191) NOT NULL DEFAULT 'classic',
ADD COLUMN `defaultReceiptTemplate` VARCHAR(191) NOT NULL DEFAULT 'classic';

ALTER TABLE `Quotation`
ADD COLUMN `templateKey` VARCHAR(191) NOT NULL DEFAULT 'classic';

ALTER TABLE `Invoice`
ADD COLUMN `templateKey` VARCHAR(191) NOT NULL DEFAULT 'classic';

ALTER TABLE `Receipt`
ADD COLUMN `templateKey` VARCHAR(191) NOT NULL DEFAULT 'classic';

CREATE INDEX `Company_isActive_idx` ON `Company`(`isActive`);
CREATE INDEX `Company_createdAt_idx` ON `Company`(`createdAt`);
CREATE INDEX `User_role_idx` ON `User`(`role`);
CREATE INDEX `User_isActive_idx` ON `User`(`isActive`);
CREATE INDEX `User_createdAt_idx` ON `User`(`createdAt`);
CREATE INDEX `Quotation_companyId_createdAt_idx` ON `Quotation`(`companyId`, `createdAt`);
CREATE INDEX `Invoice_companyId_createdAt_idx` ON `Invoice`(`companyId`, `createdAt`);
CREATE INDEX `Receipt_companyId_status_idx` ON `Receipt`(`companyId`, `status`);
CREATE INDEX `Receipt_companyId_createdAt_idx` ON `Receipt`(`companyId`, `createdAt`);
