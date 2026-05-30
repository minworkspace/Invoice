import fs from "fs";
import path from "path";

function parseEnvValue(value) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function readDatabaseUrlFromEnvFile() {
  const candidates = [".env", ".env.local", ".env.production"];

  for (const filename of candidates) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    const line = lines.find((entry) => entry.trim().startsWith("DATABASE_URL="));

    if (line) {
      return {
        source: filename,
        value: parseEnvValue(line.slice("DATABASE_URL=".length))
      };
    }
  }

  return {
    source: "environment",
    value: undefined
  };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function printDatabaseTarget() {
  const envFileDatabaseUrl = process.env.DATABASE_URL ? null : readDatabaseUrlFromEnvFile();
  const databaseUrl = process.env.DATABASE_URL || envFileDatabaseUrl?.value;
  const source = process.env.DATABASE_URL ? "environment" : envFileDatabaseUrl?.source || "environment";

  console.log("[database] DATABASE_URL exists:", databaseUrl ? "yes" : "no");
  console.log("[database] DATABASE_URL source:", source);

  if (!databaseUrl) {
    console.error("[database] DATABASE_URL is missing. Set it in the deployment environment before running build.");
    process.exit(1);
  }

  try {
    const url = new URL(databaseUrl);
    const databaseName = url.pathname.replace(/^\/+/, "") || "(missing)";
    const username = safeDecode(url.username) || "(missing)";
    const port = url.port || (url.protocol === "mysqls:" ? "3306" : "3306");

    console.log("[database] protocol:", url.protocol.replace(":", ""));
    console.log("[database] host:", url.hostname || "(missing)");
    console.log("[database] port:", port);
    console.log("[database] database:", safeDecode(databaseName));
    console.log("[database] user:", username);

    if (url.hash) {
      console.warn("[database] URL contains a # fragment. If your password has #, encode it as %23.");
    }

    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      console.warn("[database] Host is local. This is valid only if Hostinger lists localhost as the MySQL host for this database.");
    }
  } catch (error) {
    console.error("[database] DATABASE_URL exists but could not be parsed as a URL.");
    console.error("[database] Check for unencoded special characters in the username or password.");
    console.error("[database] Characters such as @, #, %, :, /, ?, and & must be URL-encoded.");
    process.exit(1);
  }
}

printDatabaseTarget();
