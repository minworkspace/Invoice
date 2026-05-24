import { prisma } from "@/lib/prisma";

export function getDatabaseSetupError() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return "DATABASE_URL is missing. Create .env from .env.example and set a MySQL connection string.";
  }

  if (!databaseUrl.startsWith("mysql://") && !databaseUrl.startsWith("mysqls://")) {
    return "DATABASE_URL must be a MySQL connection string, for example mysql://root:password@127.0.0.1:3306/invoice_app.";
  }

  return null;
}

export function isDatabaseConfigurationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Environment variable not found: DATABASE_URL") ||
    message.includes("DATABASE_URL is missing") ||
    message.includes("must be a MySQL connection string")
  );
}

export function isRecoverableDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    isDatabaseConfigurationError(error) ||
    message.includes("Can't reach database server") ||
    message.includes("Access denied") ||
    message.includes("does not exist") ||
    message.includes("P1000") ||
    message.includes("P1001") ||
    message.includes("P1003") ||
    message.includes("P1010") ||
    message.includes("P1012")
  );
}

export function authDatabaseErrorCode(error: unknown) {
  return isDatabaseConfigurationError(error) ? "db-missing" : "db-unavailable";
}

export function databaseErrorDetail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2).join(" | ");
}

export function authDatabaseErrorRedirect(error: unknown, path: "/login" | "/register") {
  const url = new URL(path, "http://localhost");
  url.searchParams.set("error", authDatabaseErrorCode(error));

  if (process.env.NODE_ENV !== "production") {
    url.searchParams.set("detail", databaseErrorDetail(error));
  }

  return `${url.pathname}${url.search}`;
}

export function authDatabaseErrorMessage(code?: string, detail?: string) {
  if (code === "db-missing") {
    return "DATABASE_URL is not configured. Create .env, set your MySQL URL, then restart yarn dev.";
  }

  if (code === "db-unavailable") {
    const message =
      "The app could not connect to MySQL. Check that MySQL is running, the database exists, migrations ran, and DATABASE_URL is correct.";

    return process.env.NODE_ENV !== "production" && detail ? `${message} Details: ${detail}` : message;
  }

  return null;
}

type DatabaseHealth = {
  ok: boolean;
  provider: "mysql";
  databaseUrlLoaded: boolean;
  databaseUrlPreview: string | null;
  databaseName: string | null;
  tableNames: string[];
  userCount: number | null;
  error: string | null;
};

function maskDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) return null;

  try {
    const url = new URL(databaseUrl);
    const auth = url.username ? `${url.username}${url.password ? ":***" : ""}@` : "";
    return `${url.protocol}//${auth}${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return databaseUrl.replace(/:[^:@/]+@/, ":***@");
  }
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const setupError = getDatabaseSetupError();
  const databaseUrl = process.env.DATABASE_URL;

  if (setupError) {
    return {
      ok: false,
      provider: "mysql",
      databaseUrlLoaded: false,
      databaseUrlPreview: null,
      databaseName: null,
      tableNames: [],
      userCount: null,
      error: setupError
    };
  }

  try {
    const currentDatabaseRows = (await prisma.$queryRawUnsafe("SELECT DATABASE() AS db")) as Array<{ db: string | null }>;
    const tableRows = (await prisma.$queryRawUnsafe("SHOW TABLES")) as Array<Record<string, string>>;
    const userCount = await prisma.user.count();
    const tableNames = tableRows.flatMap((row) => Object.values(row));

    return {
      ok: true,
      provider: "mysql",
      databaseUrlLoaded: true,
      databaseUrlPreview: maskDatabaseUrl(databaseUrl),
      databaseName: currentDatabaseRows[0]?.db || null,
      tableNames,
      userCount,
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      provider: "mysql",
      databaseUrlLoaded: true,
      databaseUrlPreview: maskDatabaseUrl(databaseUrl),
      databaseName: null,
      tableNames: [],
      userCount: null,
      error: databaseErrorDetail(error)
    };
  } finally {
    await prisma.$disconnect();
  }
}
