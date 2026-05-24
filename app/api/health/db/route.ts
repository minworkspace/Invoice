import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/database";

export async function GET() {
  const health = await checkDatabaseHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
