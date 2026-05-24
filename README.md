# Invoice App MVP

Custom multi-company invoice, quotation, and receipt generator built with Next.js App Router, TypeScript, Tailwind CSS, Prisma, MySQL, and Yarn.

## What Is Included

- Multi-user email/password login with an HTTP-only session cookie.
- Company-scoped tenancy using `companyId` on business records.
- Company settings for document prefixes, starting numbers, padding, default notes, payment info, and remarks.
- Safe document numbering through `DocumentNumberSequence`.
- Database-level unique constraints for company document numbers:
  - `companyId + invoiceNumber`
  - `companyId + quotationNumber`
  - `companyId + receiptNumber`
- Quotation to invoice conversion.
- Invoice to receipt generation with duplicate receipt prevention.
- Editable invoices and quotations after creation.
- PDF metadata: `pdfUrl`, `pdfGeneratedAt`, and `pdfNeedsRegeneration`.
- PDF generation stored once under `public/uploads/company-{companyId}`.
- Lightweight storage abstraction in `lib/storage` with a local provider for uploads and generated PDFs.
- WhatsApp send modal with editable number, prefilled message, `wa.me` link, and send log.
- Search/filter pages for invoices, quotations, receipts, and customers.
- Customer document history page.
- Dashboard metrics and recent documents.
- Super admin overview under `/admin` for tenant, user, document, activity, storage, and health summaries.
- Selectable document templates: `classic`, `modern`, and `compact`.

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Install and start MySQL locally.

With Homebrew:

```bash
brew install mysql
brew services start mysql
```

Or with Docker:

```bash
docker run --name invoice-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=invoice_app -p 3306:3306 -d mysql:8
```

3. Create the local database if you are using Homebrew MySQL:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS invoice_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

If your local root user has no password, use:

```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS invoice_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

4. Create your environment file:

```bash
cp .env.example .env
```

5. Update `.env` with your MySQL connection.

Prisma is configured for MySQL in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

The required URL format is:

```text
mysql://USER:PASSWORD@HOST:PORT/DATABASE
```

Example for the Docker command above:

```env
DATABASE_URL="mysql://root:password@127.0.0.1:3306/invoice_app"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SUPER_ADMIN_EMAIL="owner@example.com"
SUPER_ADMIN_PASSWORD="change-this-password"
SUPER_ADMIN_NAME="System Owner"
```

If your local MySQL root user has no password, use:

```env
DATABASE_URL="mysql://root@127.0.0.1:3306/invoice_app"
```

Next.js and Prisma both read `.env` from the project root. Restart `yarn dev` after changing `.env`.

6. Generate Prisma Client:

```bash
yarn prisma generate
```

7. Run the migration:

```bash
yarn prisma migrate dev
```

8. Seed demo data:

```bash
yarn seed
```

9. Start development:

```bash
yarn dev
```

Open `http://localhost:3000`.

10. Run the database health check whenever you want a quick Prisma + MySQL diagnostic:

```bash
yarn db:health
curl http://localhost:3000/api/health/db
```

If login/register shows a database setup message, check:

- `.env` exists in `/Users/min/work/Invoice-app`.
- `DATABASE_URL` starts with `mysql://` or `mysqls://`.
- MySQL is running on the host and port in `DATABASE_URL`.
- The `invoice_app` database exists.
- `yarn prisma migrate dev` has completed.

Demo login after seeding:

```text
Email: demo@example.com
Password: password123
```

If `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` are set before `yarn seed`, the seed also creates a system owner login. Super admin pages are available at `/admin`; normal company users are redirected away from those routes.

## Useful Commands

```bash
yarn install
yarn dev
yarn build
yarn db:health
yarn prisma generate
yarn prisma migrate dev
yarn seed
```

## Docker MySQL Commands

Create the MySQL 8 container:

```bash
docker run --name invoice-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=invoice_app -p 3306:3306 -d mysql:8
```

Check the container:

```bash
docker ps -a
docker logs invoice-mysql
docker exec invoice-mysql mysql -uroot -ppassword -e "SHOW DATABASES;"
docker exec invoice-mysql mysql -uroot -ppassword -D invoice_app -e "SHOW TABLES;"
```

Full local recovery flow:

```bash
yarn db:health
yarn prisma migrate dev --name init
yarn seed
```

## PDF Handling

PDFs are generated with `pdfkit` in Node.js and saved to:

```text
public/uploads/company-{companyId}/{invoices|quotations|receipts}
```

Viewing a document does not regenerate the PDF. When invoice or quotation content changes and a PDF already exists, the document is marked with `pdfNeedsRegeneration = true`, and the UI shows a regeneration state.

The PDF renderer is centralized in `lib/pdf.ts` so invoice, quotation, and receipt templates can diverge later without changing the data model.

Template keys are stored on each document (`templateKey`) and company defaults live in Company Settings. Live previews stay as HTML; PDFs are generated only when the user clicks generate/regenerate.

Regenerating a PDF replaces the current deterministic file and deletes any older stored PDF URL for that document, so stale PDFs do not pile up.

## Local Storage

All file operations should go through `lib/storage`:

```ts
saveFile()
deleteFile()
getFileUrl()
getStorageUsage()
```

The current provider is `LocalStorageProvider`, which stores files under `public/uploads` for early-stage Hostinger deployment and easy WhatsApp sharing. App PDF downloads use a tenant-checked API route, but public upload URLs are still intended for MVP sharing links. Before scaling or handling highly sensitive PDFs, migrate the provider to signed private URLs with S3 or Cloudflare R2.

Company assets are stored as file paths/URLs only. MySQL does not store base64 images or PDF blobs. Logo/chop uploads are limited to 2MB and validated by MIME type plus basic file signatures. SVG uploads are accepted only after basic unsafe-content checks; PNG/JPEG remain the safest choice for generated PDF embedding.

## Hostinger Node.js Notes

- This app uses `output: "standalone"` in `next.config.ts`.
- It avoids Vercel-only storage and serverless-only assumptions.
- Ensure the deployed Node.js process can write to the configured PDF folder, or move PDF storage to a persistent writable folder and expose it through static routing.
- Set `NEXT_PUBLIC_APP_URL` to your production URL so WhatsApp messages include correct links.
- Back up both MySQL and `public/uploads`. The database contains document metadata, while generated PDFs, logos, and chops live on disk.
- Run Prisma commands during deployment as needed: `yarn prisma generate` and `yarn prisma migrate deploy`.
- Future storage migration path: implement `S3StorageProvider` or `CloudflareR2StorageProvider` behind `lib/storage` without changing invoice/PDF/logo business logic.

## Reference PDF

The invoice preview and generated invoice PDF are based on the provided `INVOICE 38318.pdf` reference: large title, top-right UPR mark, FROM/TO/document metadata, dark Description/Price table header, light table body, remarks below the table, and payment/important notes near the page footer.
