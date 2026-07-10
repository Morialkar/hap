import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const goldenDir = path.join(repoRoot, "tests/parity/golden");
const artifactDir = path.join(repoRoot, "docs/artifacts/r1-f3/spot-check");
const v2BaseUrl = process.env.R1_F3_V2_URL ?? "http://127.0.0.1:8056";
const v3BaseUrl = process.env.R1_F3_V3_URL ?? "http://127.0.0.1:15173";
const email = process.env.E2E_V3_EMAIL ?? "test@example.com";
const password = process.env.E2E_V3_PASSWORD ?? "password";

const spotChecks = [
  { type: "work", legacyId: 3, reason: "baseline work with accent and publisher/printer references" },
  { type: "work", legacyId: 18, reason: "long title and bibliography-style payload" },
  { type: "work", legacyId: 37, reason: "periodical-like publication title in works table" },
  { type: "work", legacyId: 58, reason: "religious work with date/category references" },
  { type: "work", legacyId: 116, reason: "accented French title and person references" },
  { type: "work", legacyId: 207, reason: "late catalogue record with sparse fields" },
  { type: "work", legacyId: 470, reason: "last imported work boundary record" },
  { type: "periodical", legacyId: 1, reason: "periodical with blank title edge case" },
  { type: "periodical", legacyId: 10, reason: "mid-list periodical with frequency references" },
  { type: "periodical", legacyId: 17, reason: "last imported periodical boundary record" },
];

function readGolden(file) {
  return JSON.parse(fs.readFileSync(path.join(goldenDir, file), "utf8"));
}

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function titleFor(record) {
  const title = normalize(record.fields.titre);
  return title || "(titre vide)";
}

async function api(page, pathAndQuery, options = {}) {
  const response = await page.request.fetch(`${v3BaseUrl}/api/v1${pathAndQuery}`, options);
  if (!response.ok()) {
    throw new Error(`${options.method ?? "GET"} ${pathAndQuery} failed with ${response.status()}: ${await response.text()}`);
  }

  return response.json();
}

async function authenticate(page) {
  const current = await page.request.get(`${v3BaseUrl}/api/v1/user`);
  if (current.ok()) {
    return;
  }

  const response = await page.request.post(`${v3BaseUrl}/api/v1/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`v3 login failed with ${response.status()}: ${await response.text()}`);
  }
}

async function discover(page) {
  await authenticate(page);

  const databases = await api(page, "/databases");
  const database = databases.find((candidate) => /catalogue littéraire|eusèbe|eusebe/i.test(candidate.name));
  if (!database) {
    throw new Error("Catalogue Littéraire database was not found.");
  }

  const tables = await api(page, `/tables?database_id=${encodeURIComponent(database.id)}`);
  const byName = new Map(tables.map((table) => [table.name, table]));
  const works = byName.get("Ouvrages");
  const periodicals = byName.get("Périodiques");
  if (!works || !periodicals) {
    throw new Error("Expected Ouvrages and Périodiques tables to exist.");
  }

  return { database, tables: { works, periodicals } };
}

async function recordsFor(page, table) {
  const response = await api(page, `/records?table_id=${encodeURIComponent(table.id)}&per_page=1000`);
  return response.data;
}

function findV3Record(records, goldenRecord) {
  const goldenTitle = normalize(goldenRecord.fields.titre);
  return records.find((record) => normalize(record.data.Titre) === goldenTitle);
}

async function waitForV3Record(page, title) {
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: /modifier|supprimer/i }).first().waitFor({ state: "visible", timeout: 15000 });
  if (title !== "(titre vide)") {
    await page.getByText(title, { exact: false }).first().waitFor({ state: "visible", timeout: 15000 });
  }
}

async function captureV2(page, item, output) {
  const segment = item.type === "work" ? "ouvrage" : "periodique";
  await page.goto(`${v2BaseUrl}/view/${segment}/id/${item.legacyId}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: output, fullPage: true });
}

async function captureV3(page, context, item, v3RecordId, title, output) {
  const table = item.type === "work" ? context.tables.works : context.tables.periodicals;
  const url = `${v3BaseUrl}/tables/${context.database.id}/${table.id}?recordId=${encodeURIComponent(v3RecordId)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForV3Record(page, title);
  await page.screenshot({ path: output, fullPage: true });
}

fs.mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const context = await discover(page);
const worksGolden = readGolden("detail_ouvrages.json").records;
const periodicalsGolden = readGolden("detail_periodiques.json").records;
const worksV3 = await recordsFor(page, context.tables.works);
const periodicalsV3 = await recordsFor(page, context.tables.periodicals);
const manifest = [];

for (const [index, item] of spotChecks.entries()) {
  const goldenRecords = item.type === "work" ? worksGolden : periodicalsGolden;
  const v3Records = item.type === "work" ? worksV3 : periodicalsV3;
  const goldenRecord = goldenRecords.find((record) => record.id === item.legacyId);
  if (!goldenRecord) {
    throw new Error(`Missing ${item.type} golden record ${item.legacyId}`);
  }

  const v3Record = findV3Record(v3Records, goldenRecord);
  if (!v3Record) {
    throw new Error(`Missing v3 match for ${item.type} ${item.legacyId} (${titleFor(goldenRecord)})`);
  }

  const number = String(index + 1).padStart(2, "0");
  const slug = `${number}-${item.type}-${item.legacyId}`;
  const v2Screenshot = path.join(artifactDir, `${slug}-v2.png`);
  const v3Screenshot = path.join(artifactDir, `${slug}-v3.png`);
  const title = titleFor(goldenRecord);

  await captureV2(page, item, v2Screenshot);
  await captureV3(page, context, item, v3Record.id, title, v3Screenshot);

  manifest.push({
    number: index + 1,
    type: item.type,
    legacyId: item.legacyId,
    v3RecordId: v3Record.id,
    title,
    reason: item.reason,
    v2Screenshot: path.relative(repoRoot, v2Screenshot),
    v3Screenshot: path.relative(repoRoot, v3Screenshot),
  });
}

await browser.close();

const manifestPath = path.join(artifactDir, "manifest.json");
fs.writeFileSync(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
fs.renameSync(`${manifestPath}.tmp`, manifestPath);

const rows = manifest.map((item) => {
  return `| ${item.number} | ${item.type} | ${item.legacyId} | ${item.title.replaceAll("|", "\\|")} | [v2](./artifacts/r1-f3/spot-check/${path.basename(item.v2Screenshot)}) | [v3](./artifacts/r1-f3/spot-check/${path.basename(item.v3Screenshot)}) | Agent spot-check OK; user verdict pending |`;
});

console.log(rows.join("\n"));
