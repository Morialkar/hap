import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const dockerEnv = path.join(root, "docker/.env");
const dockerEnvExample = path.join(root, "docker/.env.example");
const apiEnv = path.join(root, "apps/api/.env");
const apiEnvExample = path.join(root, "apps/api/.env.example");
const apiVendorAutoload = path.join(root, "apps/api/vendor/autoload.php");

const args = new Set(process.argv.slice(2));
const wantsHelp = args.has("--help") || args.has("-h");
const shouldFresh = args.has("--fresh");
const shouldImportEusebe = args.has("--import-eusebe");
const eusebeDumpPath = process.env.EUSEBE_DUMP_PATH ?? "/Users/nao/Eusebe/sql/eusebe.sql";

if (wantsHelp) {
  console.log(`Usage: pnpm dev:stack [-- --fresh] [-- --import-eusebe]

Starts the local development stack:
  - Docker API services: PHP-FPM, nginx, PostgreSQL/PostGIS, Mailpit
  - API migrations and seeders
  - Vite client in the foreground

Options:
  --fresh          Run migrate:fresh --seed --force instead of migrate --force.
  --import-eusebe Import the Eusèbe dump after migrations.
  --help          Print this help.

Environment:
  EUSEBE_DUMP_PATH Path used by --import-eusebe.
`);
  process.exit(0);
}

function ensureFile(target, source) {
  if (fs.existsSync(target)) {
    return;
  }

  fs.copyFileSync(source, target);
  console.log(`created ${path.relative(root, target)} from ${path.relative(root, source)}`);
}

function readEnvFile(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "" && !line.trimStart().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index === -1) {
          return [line, ""];
        }

        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function upsertEnvFile(file, values) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const seen = new Set();
  const updated = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match) {
      return line;
    }

    const key = match[1];
    if (!(key in values)) {
      return line;
    }

    seen.add(key);
    return `${key}=${values[key]}`;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) {
      updated.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(file, `${updated.join("\n").replace(/\n+$/, "")}\n`);
}

function syncApiEnvForDocker() {
  const dockerValues = readEnvFile(dockerEnv);

  upsertEnvFile(apiEnv, {
    APP_URL: `http://localhost:${dockerValues.APP_PORT ?? "8080"}`,
    DB_CONNECTION: "pgsql",
    DB_HOST: "db",
    DB_PORT: "5432",
    DB_DATABASE: dockerValues.DB_DATABASE ?? "hap",
    DB_USERNAME: dockerValues.DB_USERNAME ?? "hap",
    DB_PASSWORD: dockerValues.DB_PASSWORD ?? "secret",
    SESSION_DRIVER: "database",
    CACHE_STORE: "database",
    QUEUE_CONNECTION: "database",
    MAIL_HOST: "mailpit",
    MAIL_PORT: dockerValues.MAILPIT_SMTP_PORT ?? "1025",
  });
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      stdio: options.stdio ?? "inherit",
      env: { ...process.env, ...(options.env ?? {}) },
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${commandArgs.join(" ")} failed with ${signal ?? code}`));
    });
  });
}

async function dockerCompose(commandArgs) {
  await run("docker", ["compose", "-f", "docker/compose.yml", ...commandArgs]);
}

async function dockerExec(commandArgs) {
  await dockerCompose(["exec", "-T", "app", ...commandArgs]);
}

async function ensureAppKey() {
  const envContent = fs.readFileSync(apiEnv, "utf8");
  const appKey = envContent.match(/^APP_KEY=(.*)$/m)?.[1]?.trim() ?? "";

  if (appKey !== "") {
    return;
  }

  await dockerExec(["php", "artisan", "key:generate", "--force"]);
}

ensureFile(dockerEnv, dockerEnvExample);
ensureFile(apiEnv, apiEnvExample);
syncApiEnvForDocker();

console.log("starting Docker services: API, nginx, PostgreSQL/PostGIS, Mailpit");
await dockerCompose(["up", "--build", "-d"]);

if (!fs.existsSync(apiVendorAutoload)) {
  console.log("installing API Composer dependencies");
  await dockerExec(["composer", "install"]);
}

await ensureAppKey();

if (shouldFresh) {
  console.log("running fresh API migrations and seeders");
  await dockerExec(["php", "artisan", "migrate:fresh", "--seed", "--force"]);
} else {
  console.log("running API migrations");
  await dockerExec(["php", "artisan", "migrate", "--force"]);
}

if (shouldImportEusebe) {
  if (!fs.existsSync(eusebeDumpPath)) {
    throw new Error(`Eusèbe dump not found: ${eusebeDumpPath}`);
  }

  const tempDumpDest = path.join(root, "apps/api/storage/app/eusebe_dump.sql");
  console.log(`copying Eusèbe dump to temporary location: ${tempDumpDest}`);
  fs.copyFileSync(eusebeDumpPath, tempDumpDest);

  try {
    console.log("importing Eusèbe dump inside Docker container...");
    await dockerExec(["php", "artisan", "import:eusebe", "storage/app/eusebe_dump.sql"]);
  } finally {
    if (fs.existsSync(tempDumpDest)) {
      console.log("removing temporary Eusèbe dump file");
      fs.unlinkSync(tempDumpDest);
    }
  }
}

console.log("");
console.log("API:      http://localhost:8080/api/v1/ping");
console.log("Mailpit:  http://localhost:8025");
console.log("Client:   http://127.0.0.1:5173");
console.log("");
console.log("Press Ctrl-C to stop the client.");
console.log("Docker services stay up. Stop them with: docker compose -f docker/compose.yml down");
console.log("");

await run("pnpm", ["--filter", "client", "dev", "--host", "127.0.0.1"], {
  env: {
    VITE_API_PROXY_TARGET: "http://localhost:8080",
  },
});
