UPDATE `Invoice`
SET `templateKey` = 'clean'
WHERE `templateKey` = 'modern';

UPDATE `Quotation`
SET `templateKey` = 'clean'
WHERE `templateKey` = 'modern';

UPDATE `Receipt`
SET `templateKey` = 'clean'
WHERE `templateKey` = 'modern';

UPDATE `CompanySettings`
SET `defaultInvoiceTemplate` = 'clean'
WHERE `defaultInvoiceTemplate` = 'modern';

UPDATE `CompanySettings`
SET `defaultQuotationTemplate` = 'clean'
WHERE `defaultQuotationTemplate` = 'modern';

UPDATE `CompanySettings`
SET `defaultReceiptTemplate` = 'clean'
WHERE `defaultReceiptTemplate` = 'modern';

UPDATE `Invoice`
SET `templateKey` = 'classic'
WHERE `templateKey` = 'compact';

UPDATE `Quotation`
SET `templateKey` = 'classic'
WHERE `templateKey` = 'compact';

UPDATE `Receipt`
SET `templateKey` = 'classic'
WHERE `templateKey` = 'compact';

UPDATE `CompanySettings`
SET `defaultInvoiceTemplate` = 'classic'
WHERE `defaultInvoiceTemplate` = 'compact';

UPDATE `CompanySettings`
SET `defaultQuotationTemplate` = 'classic'
WHERE `defaultQuotationTemplate` = 'compact';

UPDATE `CompanySettings`
SET `defaultReceiptTemplate` = 'classic'
WHERE `defaultReceiptTemplate` = 'compact';
