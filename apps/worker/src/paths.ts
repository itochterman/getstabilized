import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function fixturePath(...parts: string[]): string {
  return join(root, "fixtures", ...parts);
}
