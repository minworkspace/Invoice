import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/database";

export async function GET() {
  const health = await checkDatabaseHealth();

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        ok: health.ok,
        provider: health.provider,
        databaseUrlLoaded: health.databaseUrlLoaded
      },
      { status: health.ok ? 200 : 503 }
    );
  }

  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
