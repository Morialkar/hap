import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const repoRoot = path.resolve(__dirname, "../../..");
const apiRoot = path.join(repoRoot, "apps/api");
const databasePath = process.env.E2E_V3_DB_DATABASE ?? path.join(apiRoot, "database/e2e.sqlite");
const importReportPath = path.join(apiRoot, "eusebe_import_report.md");
const sqlPath = process.env.EUSEBE_SQL_PATH ?? "/Users/nao/Eusebe/sql/eusebe.sql";

function artisan(args: string[]): void {
  execFileSync("php", ["artisan", ...args], {
    cwd: apiRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      APP_ENV: process.env.E2E_V3_APP_ENV ?? "e2e",
      DB_CONNECTION: process.env.E2E_V3_DB_CONNECTION ?? "sqlite",
      DB_DATABASE: databasePath,
      SESSION_DRIVER: process.env.E2E_V3_SESSION_DRIVER ?? "file",
      CACHE_STORE: process.env.E2E_V3_CACHE_STORE ?? "array",
      QUEUE_CONNECTION: process.env.E2E_V3_QUEUE_CONNECTION ?? "sync",
    },
  });
}

export function bootstrapV3(): void {
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Legacy Eusèbe SQL dump not found at ${sqlPath}`);
  }

  fs.closeSync(fs.openSync(databasePath, "a"));
  artisan(["migrate:fresh", "--seed", "--force"]);
  artisan(["import:eusebe", sqlPath]);
  if (fs.existsSync(importReportPath)) {
    fs.unlinkSync(importReportPath);
  }
}
