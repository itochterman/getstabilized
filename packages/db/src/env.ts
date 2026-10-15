import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

/** Load the repo root .env once. Real environment variables win over the file. */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  let dir = process.cwd();
  try {
    dir = dirname(fileURLToPath(import.meta.url));
  } catch {
    /* bundled, fall back to cwd */
  }
  for (let i = 0; i < 6; i++) {
    const file = join(dir, ".env");
    if (existsSync(file) && existsSync(join(dir, "package.json")) && existsSync(join(dir, "packages"))) {
      try {
        process.loadEnvFile(file);
      } catch {
        /* ignore malformed file */
      }
      return;
    }
    dir = resolve(dir, "..");
  }
}

export function databaseUrl(): string {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and start Postgres with `npm run db:up`.");
  return url;
}
