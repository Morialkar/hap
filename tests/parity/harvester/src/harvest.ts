/**
 * R0-S3 — Eusèbe v2 Golden-Master Harvester
 *
 * Captures from the running capsule:
 *   - Dashboard counts (ouvrages, auteurs, périodiques)
 *   - Browse lists × 5 dimensions (titre, auteurs, dates, genre, catégorie)
 *   - Browse périodiques by titre
 *   - Detail payloads for every ouvrage and périodique
 *   - /annex structure (year groups + ordered entries)
 *   - All 7 /ajax/loadchoices/* JSON payloads verbatim
 *
 * Output: tests/parity/golden/*.json
 * Two consecutive runs must produce byte-identical output.
 *
 * Usage:
 *   TARGET_BASE_URL=http://localhost:8056 npm run harvest:dev
 */

import * as fs from "fs";
import * as path from "path";
import { parse, HTMLElement } from "node-html-parser";

const BASE_URL = process.env.TARGET_BASE_URL ?? "http://localhost:8056";
const GOLDEN_DIR = path.resolve(__dirname, "../../golden");

async function get(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}

function writeGolden(name: string, data: unknown): void {
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  const file = path.join(GOLDEN_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`  wrote ${path.relative(process.cwd(), file)}`);
}

function textOf(el: HTMLElement | null): string {
  if (!el) return "";
  return el.text.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function harvestDashboard(): Promise<void> {
  console.log("Dashboard...");
  const html = await get(`${BASE_URL}/`);
  const doc = parse(html);

  const h2s = doc.querySelectorAll("h2");
  const counts: Record<string, number> = {};
  const labels = ["ouvrages", "auteurs", "periodiques"];
  h2s.forEach((el, i) => {
    const n = parseInt(el.text.trim(), 10);
    if (!isNaN(n) && i < 3) counts[labels[i]] = n;
  });

  writeGolden("dashboard", { counts });
}

// ---------------------------------------------------------------------------
// Browse ouvrages by dimension
// ---------------------------------------------------------------------------

interface BrowseEntry {
  id: number;
  titre: string;
}

interface DimensionValue {
  value: string;
  entries: BrowseEntry[];
}

async function harvestOuvragesByTitre(): Promise<void> {
  console.log("Browse ouvrages/titre...");
  const html = await get(`${BASE_URL}/view/ouvrage/titre`);
  const doc = parse(html);
  const entries: BrowseEntry[] = [];

  doc.querySelectorAll("a[href*='/view/ouvrage/id/']").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(/\/view\/ouvrage\/id\/(\d+)/);
    if (m) {
      entries.push({ id: parseInt(m[1], 10), titre: textOf(a) });
    }
  });

  writeGolden("browse_ouvrage_titre", { dimension: "titre", entries });
}

async function harvestOuvragesByAuteurs(): Promise<void> {
  console.log("Browse ouvrages/auteurs...");
  const html = await get(`${BASE_URL}/view/ouvrage/auteurs`);
  const doc = parse(html);

  const dimensions: DimensionValue[] = [];
  for (const a of doc.querySelectorAll("a[href*='/view/ouvrage/auteur/']")) {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(/\/view\/ouvrage\/auteur\/(\d+)/);
    if (!m) continue;
    const auteurId = parseInt(m[1], 10);
    const label = textOf(a);

    const inner = await get(`${BASE_URL}/view/ouvrage/auteur/${auteurId}`);
    const idoc = parse(inner);
    const entries: BrowseEntry[] = [];
    idoc.querySelectorAll("a[href*='/view/ouvrage/id/']").forEach((ea) => {
      const h = ea.getAttribute("href") ?? "";
      const mm = h.match(/\/view\/ouvrage\/id\/(\d+)/);
      if (mm) entries.push({ id: parseInt(mm[1], 10), titre: textOf(ea) });
    });

    dimensions.push({ value: label, entries });
  }

  writeGolden("browse_ouvrage_auteurs", { dimension: "auteurs", dimensions });
}

async function harvestOuvragesByDates(): Promise<void> {
  console.log("Browse ouvrages/dates...");
  const html = await get(`${BASE_URL}/view/ouvrage/dates`);
  const doc = parse(html);

  const dimensions: DimensionValue[] = [];
  for (const a of doc.querySelectorAll("a[href*='/view/ouvrage/dates/']")) {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(/\/view\/ouvrage\/dates\/(\d+)/);
    if (!m) continue;
    const year = m[1];
    const label = textOf(a);

    const inner = await get(`${BASE_URL}/view/ouvrage/dates/${year}`);
    const idoc = parse(inner);
    const entries: BrowseEntry[] = [];
    idoc.querySelectorAll("a[href*='/view/ouvrage/id/']").forEach((ea) => {
      const h = ea.getAttribute("href") ?? "";
      const mm = h.match(/\/view\/ouvrage\/id\/(\d+)/);
      if (mm) entries.push({ id: parseInt(mm[1], 10), titre: textOf(ea) });
    });

    dimensions.push({ value: label, entries });
  }

  writeGolden("browse_ouvrage_dates", { dimension: "dates", dimensions });
}

async function harvestOuvragesByGenre(): Promise<void> {
  console.log("Browse ouvrages/genre...");
  const html = await get(`${BASE_URL}/view/ouvrage/genre`);
  const doc = parse(html);

  const dimensions: DimensionValue[] = [];
  for (const a of doc.querySelectorAll("a[href*='/view/ouvrage/genre/']")) {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(/\/view\/ouvrage\/genre\/(\d+)/);
    if (!m) continue;
    const genreId = m[1];
    const label = textOf(a);

    const inner = await get(`${BASE_URL}/view/ouvrage/genre/${genreId}`);
    const idoc = parse(inner);
    const entries: BrowseEntry[] = [];
    idoc.querySelectorAll("a[href*='/view/ouvrage/id/']").forEach((ea) => {
      const h = ea.getAttribute("href") ?? "";
      const mm = h.match(/\/view\/ouvrage\/id\/(\d+)/);
      if (mm) entries.push({ id: parseInt(mm[1], 10), titre: textOf(ea) });
    });

    dimensions.push({ value: label, entries });
  }

  writeGolden("browse_ouvrage_genre", { dimension: "genre", dimensions });
}

async function harvestOuvragesByCategorie(): Promise<void> {
  console.log("Browse ouvrages/categorie...");
  const html = await get(`${BASE_URL}/view/ouvrage/categorie`);
  const doc = parse(html);

  const dimensions: DimensionValue[] = [];
  for (const a of doc.querySelectorAll("a[href*='/view/ouvrage/categorie/']")) {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(/\/view\/ouvrage\/categorie\/(\d+)/);
    if (!m) continue;
    const catId = m[1];
    const label = textOf(a);

    const inner = await get(`${BASE_URL}/view/ouvrage/categorie/${catId}`);
    const idoc = parse(inner);
    const entries: BrowseEntry[] = [];
    idoc.querySelectorAll("a[href*='/view/ouvrage/id/']").forEach((ea) => {
      const h = ea.getAttribute("href") ?? "";
      const mm = h.match(/\/view\/ouvrage\/id\/(\d+)/);
      if (mm) entries.push({ id: parseInt(mm[1], 10), titre: textOf(ea) });
    });

    dimensions.push({ value: label, entries });
  }

  writeGolden("browse_ouvrage_categorie", { dimension: "categorie", dimensions });
}

// ---------------------------------------------------------------------------
// Browse périodiques by titre
// ---------------------------------------------------------------------------

async function harvestPeriodiquesParTitre(): Promise<void> {
  console.log("Browse periodiques/titre...");
  const html = await get(`${BASE_URL}/view/periodique/titre`);
  const doc = parse(html);
  const entries: Array<{ id: number; titre: string }> = [];

  doc.querySelectorAll("a[href*='/view/periodique/id/']").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(/\/view\/periodique\/id\/(\d+)/);
    if (m) entries.push({ id: parseInt(m[1], 10), titre: textOf(a) });
  });

  writeGolden("browse_periodique_titre", { dimension: "titre", entries });
}

// ---------------------------------------------------------------------------
// Detail pages — ouvrages
// ---------------------------------------------------------------------------

interface OuvrageDetail {
  id: number;
  fields: Record<string, string>;
}

function parseOuvrageDetail(id: number, html: string): OuvrageDetail {
  const doc = parse(html);
  const fields: Record<string, string> = {};

  const h1 = doc.querySelector("h1");
  if (h1) {
    const clone = parse(h1.innerHTML);
    clone.querySelectorAll("a").forEach((a: HTMLElement) => a.remove());
    fields["titre"] = clone.text.replace(/\s+/g, " ").trim();
  }

  doc.querySelectorAll(".twocolumn span").forEach((span: HTMLElement) => {
    const raw = textOf(span);
    const colon = raw.indexOf(":");
    if (colon > 0) {
      const key = raw.slice(0, colon).trim();
      const val = raw.slice(colon + 1).trim();
      fields[key] = val;
    }
  });

  return { id, fields };
}

async function harvestOuvrageDetails(ids: number[]): Promise<void> {
  console.log(`Detail pages: ${ids.length} ouvrages...`);
  const details: OuvrageDetail[] = [];

  for (const id of ids) {
    const html = await get(`${BASE_URL}/view/ouvrage/id/${id}`);
    details.push(parseOuvrageDetail(id, html));
  }

  writeGolden("detail_ouvrages", { count: details.length, records: details });
}

// ---------------------------------------------------------------------------
// Detail pages — périodiques
// ---------------------------------------------------------------------------

interface PeriodiqueDetail {
  id: number;
  fields: Record<string, string>;
}

function parsePeriodiqueDetail(id: number, html: string): PeriodiqueDetail {
  const doc = parse(html);
  const fields: Record<string, string> = {};

  const h1 = doc.querySelector("h1");
  if (h1) {
    const clone = parse(h1.innerHTML);
    clone.querySelectorAll("a").forEach((a: HTMLElement) => a.remove());
    fields["titre"] = clone.text.replace(/\s+/g, " ").trim();
  }

  doc.querySelectorAll(".twocolumn span").forEach((span: HTMLElement) => {
    const raw = textOf(span);
    const colon = raw.indexOf(":");
    if (colon > 0) {
      const key = raw.slice(0, colon).trim();
      const val = raw.slice(colon + 1).trim();
      fields[key] = val;
    }
  });

  return { id, fields };
}

async function harvestPeriodiqueDetails(ids: number[]): Promise<void> {
  console.log(`Detail pages: ${ids.length} périodiques...`);
  const details: PeriodiqueDetail[] = [];

  for (const id of ids) {
    const html = await get(`${BASE_URL}/view/periodique/id/${id}`);
    details.push(parsePeriodiqueDetail(id, html));
  }

  writeGolden("detail_periodiques", { count: details.length, records: details });
}

// ---------------------------------------------------------------------------
// Annex
// ---------------------------------------------------------------------------

interface AnnexEntry {
  author: string;
  titre: string;
  pages: string;
  imprimeur: string;
  editeur: string;
  raw: string;
}

interface AnnexGroup {
  year: string;
  entries: AnnexEntry[];
}

function parseAnnexEntry(raw: string): AnnexEntry {
  // Format: "Lastname , Firstname, *Title*, N pages, Imprimeur: X, Éditeur: Y"
  const authorMatch = raw.match(/^(.+?),\s*<em>/);
  const author = authorMatch ? authorMatch[1].trim() : "";
  const titreMatch = raw.match(/<em>(.*?)<\/em>/);
  const titre = titreMatch ? titreMatch[1].trim() : "";
  const pagesMatch = raw.match(/<\/em>,\s*(\d+)\s*pages/);
  const pages = pagesMatch ? pagesMatch[1] : "";
  const imprMatch = raw.match(/Imprimeur:\s*([^,]+?)(?:,|$)/);
  const imprimeur = imprMatch ? imprMatch[1].trim() : "";
  const editeurMatch = raw.match(/Éditeur:\s*(.+?)(?:\s*$)/);
  const editeur = editeurMatch ? editeurMatch[1].trim() : "";
  return { author, titre, pages, imprimeur, editeur, raw: raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() };
}

async function harvestAnnex(): Promise<void> {
  console.log("Annex...");
  const html = await get(`${BASE_URL}/annex`);
  const doc = parse(html);
  const groups: AnnexGroup[] = [];

  const yearLis = doc.querySelectorAll("li:has(h2)");
  for (const yearLi of yearLis) {
    const h2 = yearLi.querySelector("h2");
    const year = textOf(h2);
    const entries: AnnexEntry[] = [];

    yearLi.querySelectorAll("ul li").forEach((li) => {
      const raw = li.innerHTML;
      entries.push(parseAnnexEntry(raw));
    });

    groups.push({ year, entries });
  }

  writeGolden("annex", { groupCount: groups.length, groups });
}

// ---------------------------------------------------------------------------
// Loadchoices (all 7 — verbatim JSON)
// ---------------------------------------------------------------------------

const LOADCHOICES = [
  "auteur",
  "type",
  "categorie",
  "editeur",
  "imprimeur",
  "localisation",
  "frequence",
] as const;

async function harvestLoadchoices(): Promise<void> {
  console.log("Ajax loadchoices...");
  const all: Record<string, unknown> = {};

  for (const name of LOADCHOICES) {
    const data = await getJson(`${BASE_URL}/ajax/loadchoices/${name}`);
    all[name] = data;
    console.log(`  loadchoices/${name}: ${(data as unknown[]).length} items`);
  }

  writeGolden("loadchoices", all);
}

// ---------------------------------------------------------------------------
// Collect all ouvrage + périodique IDs from the titre browse lists
// ---------------------------------------------------------------------------

async function collectIds(): Promise<{ ouvrageIds: number[]; periodiqueIds: number[] }> {
  const oHtml = await get(`${BASE_URL}/view/ouvrage/titre`);
  const oDoc = parse(oHtml);
  const ouvrageIds: number[] = [];
  oDoc.querySelectorAll("a[href*='/view/ouvrage/id/']").forEach((a) => {
    const m = (a.getAttribute("href") ?? "").match(/\/view\/ouvrage\/id\/(\d+)/);
    if (m) ouvrageIds.push(parseInt(m[1], 10));
  });

  const pHtml = await get(`${BASE_URL}/view/periodique/titre`);
  const pDoc = parse(pHtml);
  const periodiqueIds: number[] = [];
  pDoc.querySelectorAll("a[href*='/view/periodique/id/']").forEach((a) => {
    const m = (a.getAttribute("href") ?? "").match(/\/view\/periodique\/id\/(\d+)/);
    if (m) periodiqueIds.push(parseInt(m[1], 10));
  });

  return { ouvrageIds, periodiqueIds };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Harvesting from ${BASE_URL} → ${GOLDEN_DIR}\n`);

  await harvestDashboard();

  const { ouvrageIds, periodiqueIds } = await collectIds();
  console.log(`Found ${ouvrageIds.length} ouvrages, ${periodiqueIds.length} périodiques\n`);

  await harvestOuvragesByTitre();
  await harvestOuvragesByAuteurs();
  await harvestOuvragesByDates();
  await harvestOuvragesByGenre();
  await harvestOuvragesByCategorie();
  await harvestPeriodiquesParTitre();

  await harvestOuvrageDetails(ouvrageIds);
  await harvestPeriodiqueDetails(periodiqueIds);

  await harvestAnnex();
  await harvestLoadchoices();

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
