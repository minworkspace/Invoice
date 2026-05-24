import bcrypt from "bcryptjs";
import { DocumentType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const company = await prisma.company.upsert({
    where: { id: "demo-company" },
    update: {},
    create: {
      id: "demo-company",
      name: "Acme Event Rentals",
      email: "hello@acme-rentals.test",
      phone: "+60 12-345 6789",
      address: "12 Jalan Meranti\n50450 Kuala Lumpur\nMalaysia",
      settings: {
        create: {
          chopUrl: null,
          ssmNumber: "1152254-A",
          invoicePrefix: "INV-",
          invoiceStartNumber: 38318,
          quotationPrefix: "QUO-",
          quotationStartNumber: 1200,
          receiptPrefix: "REC-",
          receiptStartNumber: 9000,
          documentNumberPadding: 5,
          paymentInfo: "Bank: Maybank\nAccount Name: Acme Event Rentals\nAccount No: 5123 4567 8901",
          defaultImportantNotes: "1. Prices are valid for the stated document date.\n2. Please confirm payment before delivery or service date.",
          defaultRemarks: "Thank you for choosing Acme Event Rentals."
        }
      }
    }
  });

  await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: { passwordHash },
    create: {
      companyId: company.id,
      name: "Demo Owner",
      email: "demo@example.com",
      passwordHash,
      role: "COMPANY_ADMIN"
    }
  });

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
  const superAdminName = process.env.SUPER_ADMIN_NAME || "System Owner";

  if (superAdminEmail && superAdminPassword) {
    const systemCompany = await prisma.company.upsert({
      where: { id: "system-admin-company" },
      update: {},
      create: {
        id: "system-admin-company",
        name: "System Administration",
        email: superAdminEmail
      }
    });
    const superAdminHash = await bcrypt.hash(superAdminPassword, 10);

    await prisma.user.upsert({
      where: { email: superAdminEmail.toLowerCase() },
      update: {
        name: superAdminName,
        passwordHash: superAdminHash,
        role: "SUPER_ADMIN",
        isActive: true
      },
      create: {
        companyId: systemCompany.id,
        name: superAdminName,
        email: superAdminEmail.toLowerCase(),
        passwordHash: superAdminHash,
        role: "SUPER_ADMIN"
      }
    });
  }

  const customer = await prisma.customer.upsert({
    where: { id: "demo-customer-cindy" },
    update: {},
    create: {
      id: "demo-customer-cindy",
      companyId: company.id,
      name: "Cindy Tan",
      email: "cindy@example.com",
      phone: "+60 13-222 3344",
      whatsapp: "60132223344",
      address: "8 Jalan Ampang\n50450 Kuala Lumpur"
    }
  });

  const quotation = await prisma.quotation.upsert({
    where: {
      companyId_quotationNumber: {
        companyId: company.id,
        quotationNumber: "QUO-01200"
      }
    },
    update: {},
    create: {
      companyId: company.id,
      customerId: customer.id,
      quotationNumber: "QUO-01200",
      status: "CONFIRMED",
      issueDate: new Date("2026-05-01"),
      validUntil: new Date("2026-05-15"),
      subtotal: "1250.00",
      total: "1250.00",
      importantNotes: "Includes standard setup and teardown.",
      paymentInfo: "Bank: Maybank\nAccount No: 5123 4567 8901",
      remarks: "Quotation prepared for Cindy's event.",
      items: {
        create: [
          {
            companyId: company.id,
            description: "Event canopy rental\n20ft x 20ft with side covers",
            quantity: "1",
            unitPrice: "850.00",
            lineTotal: "850.00",
            sortOrder: 0
          },
          {
            companyId: company.id,
            description: "Lighting package",
            quantity: "1",
            unitPrice: "400.00",
            lineTotal: "400.00",
            sortOrder: 1
          }
        ]
      }
    }
  });

  const invoice = await prisma.invoice.upsert({
    where: {
      companyId_invoiceNumber: {
        companyId: company.id,
        invoiceNumber: "INV-38318"
      }
    },
    update: {},
    create: {
      companyId: company.id,
      customerId: customer.id,
      quotationId: quotation.id,
      invoiceNumber: "INV-38318",
      status: "PAID",
      issueDate: new Date("2026-05-02"),
      dueDate: new Date("2026-05-09"),
      subtotal: "1250.00",
      total: "1250.00",
      paidAmount: "1250.00",
      refundableDeposit: "200.00",
      importantNotes: "Please keep this invoice for your records.",
      paymentInfo: "Bank: Maybank\nAccount No: 5123 4567 8901",
      remarks: "Deposit is refundable after item return inspection.",
      items: {
        create: [
          {
            companyId: company.id,
            description: "Event canopy rental\n20ft x 20ft with side covers",
            quantity: "1",
            unitPrice: "850.00",
            lineTotal: "850.00",
            sortOrder: 0
          },
          {
            companyId: company.id,
            description: "Lighting package",
            quantity: "1",
            unitPrice: "400.00",
            lineTotal: "400.00",
            sortOrder: 1
          }
        ]
      }
    }
  });

  const receipt = await prisma.receipt.upsert({
    where: { invoiceId: invoice.id },
    update: {},
    create: {
      companyId: company.id,
      customerId: customer.id,
      invoiceId: invoice.id,
      receiptNumber: "REC-09000",
      status: "PAID",
      receiptDate: new Date("2026-05-03"),
      amount: "1250.00",
      paymentMethod: "Bank Transfer",
      notes: "Payment received in full.",
      payments: {
        create: {
          companyId: company.id,
          customerId: customer.id,
          invoiceId: invoice.id,
          amount: "1250.00",
          paidAt: new Date("2026-05-03"),
          method: "Bank Transfer",
          reference: "DEMO-TRANSFER"
        }
      }
    }
  });

  await prisma.documentNumberSequence.upsert({
    where: {
      companyId_documentType: {
        companyId: company.id,
        documentType: DocumentType.QUOTATION
      }
    },
    update: { currentNumber: 1200 },
    create: {
      companyId: company.id,
      documentType: DocumentType.QUOTATION,
      currentNumber: 1200
    }
  });

  await prisma.documentNumberSequence.upsert({
    where: {
      companyId_documentType: {
        companyId: company.id,
        documentType: DocumentType.INVOICE
      }
    },
    update: { currentNumber: 38318 },
    create: {
      companyId: company.id,
      documentType: DocumentType.INVOICE,
      currentNumber: 38318
    }
  });

  await prisma.documentNumberSequence.upsert({
    where: {
      companyId_documentType: {
        companyId: company.id,
        documentType: DocumentType.RECEIPT
      }
    },
    update: { currentNumber: 9000 },
    create: {
      companyId: company.id,
      documentType: DocumentType.RECEIPT,
      currentNumber: 9000
    }
  });

  console.log({
    company: company.name,
    user: "demo@example.com",
    demoPassword: "see README demo login section",
    customer: customer.name,
    quotation: quotation.quotationNumber,
    invoice: invoice.invoiceNumber,
    receipt: receipt.receiptNumber
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
