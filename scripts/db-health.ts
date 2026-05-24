import { checkDatabaseHealth } from "@/lib/database";
import { prisma } from "@/lib/prisma";

async function main() {
  const health = await checkDatabaseHealth();
  console.log(JSON.stringify(health, null, 2));

  if (!health.ok) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
