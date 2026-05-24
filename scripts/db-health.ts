import { checkDatabaseHealth } from "@/lib/database";

async function main() {
  const health = await checkDatabaseHealth();
  console.log(JSON.stringify(health, null, 2));

  if (!health.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
