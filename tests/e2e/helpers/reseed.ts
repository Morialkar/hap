import { execSync } from "child_process";
import * as path from "path";

const COMPOSE_FILE =
  process.env.COMPOSE_FILE ??
  path.resolve(__dirname, "../../../legacy/compose.yml");

/**
 * Reseed the capsule DB to canonical state (470/213/17) by bouncing the stack.
 * Used in write-path test teardown.
 */
export function reseedCapsule(): void {
  const cwd = __dirname;
  execSync(`docker compose -f ${COMPOSE_FILE} down && docker compose -f ${COMPOSE_FILE} up -d`, {
    stdio: "pipe",
    timeout: 120_000,
    cwd,
  });
  waitForCapsule();
}

function waitForCapsule(retries = 20, delayMs = 3000): void {
  for (let i = 0; i < retries; i++) {
    try {
      execSync("curl -sf http://localhost:8056/ > /dev/null", { stdio: "pipe" });
      return;
    } catch {
      if (i < retries - 1) {
        execSync(`sleep ${delayMs / 1000}`, { stdio: "pipe" });
      }
    }
  }
  throw new Error("Capsule did not come up after reseed");
}
