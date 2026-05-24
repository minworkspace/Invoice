import fs from "fs/promises";
import path from "path";

const root = process.cwd();
const nextDir = path.join(root, ".next");
const standaloneDir = path.join(nextDir, "standalone");
const standaloneNextDir = path.join(standaloneDir, ".next");
const sourcePublicDir = path.join(root, "public");
const standalonePublicDir = path.join(standaloneDir, "public");
const sourcePrismaDir = path.join(root, "prisma");
const standalonePrismaDir = path.join(standaloneDir, "prisma");
const sourceNodeModulesDir = path.join(root, "node_modules");
const standaloneNodeModulesDir = path.join(standaloneDir, "node_modules");

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function removeIfExists(targetPath) {
  if (await pathExists(targetPath)) {
    await fs.rm(targetPath, { recursive: true, force: true });
  }
}

async function copyFileIfExists(sourcePath, destinationPath) {
  if (!(await pathExists(sourcePath))) return;
  await ensureDir(path.dirname(destinationPath));
  await fs.copyFile(sourcePath, destinationPath);
}

async function copyDirectory(sourcePath, destinationPath) {
  if (!(await pathExists(sourcePath))) return;
  await ensureDir(path.dirname(destinationPath));
  await fs.cp(sourcePath, destinationPath, { recursive: true, force: true });
}

async function resetPublicRuntimeFolders() {
  const generatedDir = path.join(standalonePublicDir, "generated-pdfs");
  const uploadsDir = path.join(standalonePublicDir, "uploads");

  await removeIfExists(generatedDir);
  await ensureDir(generatedDir);
  await copyFileIfExists(path.join(sourcePublicDir, "generated-pdfs", ".gitkeep"), path.join(generatedDir, ".gitkeep"));

  await removeIfExists(uploadsDir);
  await ensureDir(uploadsDir);
  await copyFileIfExists(path.join(sourcePublicDir, "uploads", ".gitkeep"), path.join(uploadsDir, ".gitkeep"));

  const uploadSubfolders = ["company-logos", "company-chops"];
  for (const folder of uploadSubfolders) {
    const destinationDir = path.join(uploadsDir, folder);
    await ensureDir(destinationDir);
    await copyFileIfExists(
      path.join(sourcePublicDir, "uploads", folder, ".gitkeep"),
      path.join(destinationDir, ".gitkeep")
    );
  }
}

async function copyPrismaArtifacts() {
  await removeIfExists(standalonePrismaDir);
  await ensureDir(standalonePrismaDir);

  await copyFileIfExists(path.join(sourcePrismaDir, "schema.prisma"), path.join(standalonePrismaDir, "schema.prisma"));
  await copyDirectory(path.join(sourcePrismaDir, "migrations"), path.join(standalonePrismaDir, "migrations"));
}

async function copyPrismaCliPackages() {
  await copyDirectory(path.join(sourceNodeModulesDir, "prisma"), path.join(standaloneNodeModulesDir, "prisma"));
  await copyDirectory(path.join(sourceNodeModulesDir, "@prisma"), path.join(standaloneNodeModulesDir, "@prisma"));
}

async function removeEnvFiles() {
  const envFiles = [".env", ".env.local", ".env.development", ".env.production", ".env.example"];

  for (const filename of envFiles) {
    await removeIfExists(path.join(standaloneDir, filename));
  }
}

async function main() {
  if (!(await pathExists(standaloneDir))) {
    throw new Error("Standalone build output not found. Run next build first.");
  }

  await copyDirectory(path.join(nextDir, "static"), path.join(standaloneNextDir, "static"));
  await copyPrismaArtifacts();
  await copyPrismaCliPackages();
  await resetPublicRuntimeFolders();
  await removeEnvFiles();
  await ensureDir(path.join(standaloneDir, "tmp"));
}

main().catch((error) => {
  console.error("Failed to prepare standalone deploy output.", error);
  process.exit(1);
});
