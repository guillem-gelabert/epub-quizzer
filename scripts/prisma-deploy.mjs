import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

function runPrisma(args) {
  // Prefer local prisma binary (if present), fall back to npx.
  const localCmd = process.platform === "win32" ? "prisma.cmd" : "prisma";

  const result = spawnSync(localCmd, args, { stdio: "inherit" });
  if (result.error?.code === "ENOENT") {
    const npx = spawnSync("npx", ["--yes", "prisma", ...args], { stdio: "inherit" });
    if (npx.status !== 0) process.exit(npx.status ?? 1);
    return;
  }

  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set; skipping Prisma deploy step.");
  process.exit(0);
}

const migrationsDir = "prisma/migrations";
const hasMigrations =
  existsSync(migrationsDir) &&
  readdirSync(migrationsDir, { withFileTypes: true }).some((d) => d.isDirectory());

// If you have migrations committed, deploy them.
// If you don't (common early on), keep the app deployable by syncing schema to DB.
if (hasMigrations) {
  runPrisma(["migrate", "deploy"]);
} else {
  runPrisma(["db", "push"]);
}

