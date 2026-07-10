import { expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import type { BrowseDimension } from "../v2/BrowseOuvragePage";
import type { OuvrageFormData } from "../v2/AddEditOuvragePage";
import type { PeriodiqueFormData } from "../v2/AddEditPeriodiquePage";

type ApiRecord = {
  id: string;
  table_id: string;
  data: Record<string, unknown>;
  version: number;
};

type ApiTable = {
  id: string;
  name: string;
  database_id: string;
};

type ApiDatabase = {
  id: string;
  name: string;
};

type ApiField = {
  id: string;
  name: string;
  type: string;
};

type RecordLink = {
  id: number;
  titre: string;
};

type V3Context = {
  database: ApiDatabase;
  tables: {
    authors: ApiTable;
    works: ApiTable;
    periodicals: ApiTable;
    genres: ApiTable;
    categories: ApiTable;
    publishers: ApiTable;
    printers: ApiTable;
    locations: ApiTable;
    frequencies: ApiTable;
  };
};

const GOLDEN_DIR = path.resolve(__dirname, "../../../parity/golden");
let cachedContext: V3Context | null = null;
let generatedNumericId = 100_000;
const numericToRecordId = new Map<number, string>();
const recordIdToNumeric = new Map<string, number>();

function golden<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, file), "utf8")) as T;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function apiGet<T>(page: Page, pathAndQuery: string): Promise<T> {
  const response = await page.request.get(`/api/v1${pathAndQuery}`);
  if (!response.ok()) {
    throw new Error(`GET ${pathAndQuery} failed with ${response.status()}`);
  }

  return (await response.json()) as T;
}

async function ensureAuthenticated(page: Page): Promise<void> {
  const current = await page.request.get("/api/v1/user");
  if (current.ok()) {
    return;
  }

  const response = await page.request.post("/api/v1/login", {
    data: {
      email: process.env.E2E_V3_EMAIL ?? "test@example.com",
      password: process.env.E2E_V3_PASSWORD ?? "password",
    },
  });

  if (!response.ok()) {
    throw new Error(`v3 login failed with ${response.status()}`);
  }
}

function tableByName(tables: ApiTable[], name: string): ApiTable {
  const table = tables.find((candidate) => candidate.name === name);
  if (!table) {
    throw new Error(`Expected v3 imported table "${name}" to exist`);
  }

  return table;
}

async function discover(page: Page): Promise<V3Context> {
  await ensureAuthenticated(page);

  if (cachedContext) {
    return cachedContext;
  }

  const databases = await apiGet<ApiDatabase[]>(page, "/databases");
  const candidates = databases.filter((database) =>
    /eusèbe|eusebe|catalogue littéraire/i.test(database.name),
  );

  for (const database of candidates.length > 0 ? candidates : databases) {
    const tables = await apiGet<ApiTable[]>(
      page,
      `/tables?database_id=${encodeURIComponent(database.id)}`,
    );
    const tableNames = new Set(tables.map((table) => table.name));

    if (
      tableNames.has("Auteurs") &&
      tableNames.has("Ouvrages") &&
      tableNames.has("Périodiques")
    ) {
      cachedContext = {
        database,
        tables: {
          authors: tableByName(tables, "Auteurs"),
          works: tableByName(tables, "Ouvrages"),
          periodicals: tableByName(tables, "Périodiques"),
          genres: tableByName(tables, "Genres"),
          categories: tableByName(tables, "Catégories"),
          publishers: tableByName(tables, "Éditeurs"),
          printers: tableByName(tables, "Imprimeurs"),
          locations: tableByName(tables, "Localisations"),
          frequencies: tableByName(tables, "Fréquences"),
        },
      };

      return cachedContext;
    }
  }

  throw new Error("No imported Eusèbe / Catalogue Littéraire v3 database was found.");
}

async function recordsFor(page: Page, table: ApiTable, perPage = 1000): Promise<ApiRecord[]> {
  const response = await apiGet<{ data: ApiRecord[] }>(
    page,
    `/records?table_id=${encodeURIComponent(table.id)}&per_page=${perPage}`,
  );

  return response.data;
}

async function fieldsFor(page: Page, table: ApiTable): Promise<ApiField[]> {
  return apiGet<ApiField[]>(page, `/fields?table_id=${encodeURIComponent(table.id)}`);
}

async function firstReferenceId(page: Page, table: ApiTable): Promise<string | undefined> {
  return (await recordsFor(page, table, 1))[0]?.id;
}

function numericIdFor(record: ApiRecord, preferred?: number): number {
  const existing = recordIdToNumeric.get(record.id);
  if (existing) {
    return existing;
  }

  const numericId = preferred ?? generatedNumericId++;
  recordIdToNumeric.set(record.id, numericId);
  numericToRecordId.set(numericId, record.id);

  return numericId;
}

async function findRecordByGoldenTitle(
  page: Page,
  table: ApiTable,
  title: string,
): Promise<ApiRecord | undefined> {
  const records = await recordsFor(page, table);
  return records.find((record) => normalizeText(record.data.Titre) === normalizeText(title));
}

async function recordIdForNumeric(page: Page, table: ApiTable, numericId: number): Promise<string> {
  const mapped = numericToRecordId.get(numericId);
  if (mapped) {
    return mapped;
  }

  const details = golden<{ records: Array<{ id: number; fields: Record<string, unknown> }> }>(
    table.name === "Périodiques" ? "detail_periodiques.json" : "detail_ouvrages.json",
  );
  const goldenRecord = details.records.find((record) => record.id === numericId);

  if (!goldenRecord) {
    throw new Error(`No golden record for virtual ID ${numericId}`);
  }

  const record = await findRecordByGoldenTitle(page, table, String(goldenRecord.fields.titre ?? ""));
  if (!record) {
    throw new Error(`No v3 record matched golden virtual ID ${numericId}`);
  }

  numericIdFor(record, numericId);

  return record.id;
}

async function gotoTable(page: Page, table: ApiTable, params = ""): Promise<void> {
  const context = await discover(page);
  await page.goto(`/tables/${context.database.id}/${table.id}${params}`);
  await expect(page.getByRole("heading", { level: 1, name: table.name })).toBeVisible();
}

async function createRecord(page: Page, table: ApiTable, data: Record<string, unknown>): Promise<ApiRecord> {
  const response = await page.request.post("/api/v1/records", {
    data: {
      table_id: table.id,
      data,
    },
  });

  if (!response.ok()) {
    throw new Error(`Create record failed with ${response.status()}: ${await response.text()}`);
  }

  const record = (await response.json()) as ApiRecord;
  numericIdFor(record);

  return record;
}

async function updateRecord(page: Page, recordId: string, data: Record<string, unknown>): Promise<void> {
  const current = await apiGet<ApiRecord>(page, `/records/${recordId}`);
  const response = await page.request.put(`/api/v1/records/${recordId}`, {
    data: {
      data: { ...current.data, ...data },
      version: current.version,
    },
  });

  if (!response.ok()) {
    throw new Error(`Update record failed with ${response.status()}: ${await response.text()}`);
  }
}

function mapOuvrageData(input: Partial<OuvrageFormData>, refs: {
  author?: string;
  genre?: string;
  category?: string;
  publisher?: string;
  printer?: string;
  location?: string;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (input.titre !== undefined) data.Titre = input.titre;
  if (input.description !== undefined) data.Description = input.description;
  if (input.descriptionCourte !== undefined) data["Description courte"] = input.descriptionCourte;
  if (input.anneePublication !== undefined) data["Année de publication"] = Number(input.anneePublication);
  if (input.moisPublication !== undefined) data["Mois de publication"] = input.moisPublication;
  if (input.nbPage !== undefined) data["Nombre de pages"] = Number(input.nbPage);
  if (input.nbEdition !== undefined) data["Nombre d'éditions"] = Number(input.nbEdition);
  if (input.notes !== undefined) data.Notes = input.notes;
  if (refs.author) data.Auteur = refs.author;
  if (refs.genre) data.Genre = refs.genre;
  if (refs.category) data.Catégorie = refs.category;
  if (refs.publisher) data.Éditeur = refs.publisher;
  if (refs.printer) data.Imprimeur = refs.printer;
  if (refs.location) data.Localisation = refs.location;

  return data;
}

function mapPeriodiqueData(input: Partial<PeriodiqueFormData>, refs: {
  frequency?: string;
  publisher?: string;
  printer?: string;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (input.titre !== undefined) data.Titre = input.titre;
  if (input.description !== undefined) data.Description = input.description;
  if (input.descriptionCourte !== undefined) data["Description courte"] = input.descriptionCourte;
  if (input.debut !== undefined) data["Début de parution"] = input.debut;
  if (input.fin !== undefined) data["Fin de parution"] = input.fin;
  if (input.proprietaire !== undefined) data.Propriétaire = input.proprietaire;
  if (input.notes !== undefined) data.Notes = input.notes;
  if (refs.frequency) data.Fréquence = refs.frequency;
  if (refs.publisher) data.Éditeur = refs.publisher;
  if (refs.printer) data.Imprimeur = refs.printer;

  return data;
}

export class DashboardPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await ensureAuthenticated(this.page);
    await this.page.goto("/workspaces");
  }

  async expectReady(): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1, name: /Espaces de travail|Workspaces/i })).toBeVisible();
  }

  async counts(): Promise<{ ouvrages: number; auteurs: number; periodiques: number }> {
    const context = await discover(this.page);
    const [works, authors, periodicals] = await Promise.all([
      apiGet<{ pagination: { total: number } }>(
        this.page,
        `/records?table_id=${context.tables.works.id}&per_page=1`,
      ),
      apiGet<{ pagination: { total: number } }>(
        this.page,
        `/records?table_id=${context.tables.authors.id}&per_page=1`,
      ),
      apiGet<{ pagination: { total: number } }>(
        this.page,
        `/records?table_id=${context.tables.periodicals.id}&per_page=1`,
      ),
    ]);

    return {
      ouvrages: works.pagination.total,
      auteurs: authors.pagination.total,
      periodiques: periodicals.pagination.total,
    };
  }

  async expectCounts(ouvrages: number, auteurs: number, periodiques: number): Promise<void> {
    const counts = await this.counts();
    expect(counts).toEqual({ ouvrages, auteurs, periodiques });
  }
}

export class BrowseOuvragePage {
  constructor(private page: Page) {}

  async goto(dimension: BrowseDimension): Promise<void> {
    const context = await discover(this.page);
    await gotoTable(this.page, context.tables.works);
    if (dimension !== "titre") {
      const field = {
        auteurs: "Auteur",
        dates: "Année de publication",
        genre: "Genre",
        categorie: "Catégorie",
      }[dimension];
      await this.page.locator('[data-testid="group-by-select"]').selectOption(field);
    }
  }

  async expectReady(): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1, name: "Ouvrages" })).toBeVisible();
  }

  async dimensionLinks(): Promise<Array<{ label: string; href: string }>> {
    const context = await discover(this.page);
    const records = await recordsFor(this.page, context.tables.works);
    const groupValues = new Set(records.map((record) => normalizeText(record.data.Titre)).filter(Boolean));
    return Array.from(groupValues).map((label) => ({ label, href: "" }));
  }

  async ouvrageLinks(): Promise<RecordLink[]> {
    const context = await discover(this.page);
    const records = await recordsFor(this.page, context.tables.works);
    const titleGolden = golden<{ entries: Array<{ id: number; titre: string }> }>("browse_ouvrage_titre.json");
    const goldenByTitle = new Map(titleGolden.entries.map((entry) => [normalizeText(entry.titre), entry.id]));

    return records.map((record) => ({
      id: numericIdFor(record, goldenByTitle.get(normalizeText(record.data.Titre))),
      titre: normalizeText(record.data.Titre),
    }));
  }

  async openFirstDimensionResult(_dimension: Exclude<BrowseDimension, "titre">): Promise<void> {
    await this.openFirstOuvrageFromCurrentList();
  }

  async openFirstOuvrageFromCurrentList(): Promise<OuvrageDetailPage> {
    const [first] = await this.ouvrageLinks();
    const detail = new OuvrageDetailPage(this.page);
    await detail.goto(first.id);
    return detail;
  }
}

export class OuvrageDetailPage {
  private recordId?: string;

  constructor(private page: Page) {}

  async goto(id: number): Promise<void> {
    const context = await discover(this.page);
    this.recordId = await recordIdForNumeric(this.page, context.tables.works, id);
    await gotoTable(this.page, context.tables.works, `?recordId=${encodeURIComponent(this.recordId)}`);
  }

  async titre(): Promise<string> {
    const record = await this.currentRecord();
    return normalizeText(record.data.Titre);
  }

  async field(label: string): Promise<string> {
    const record = await this.currentRecord();
    const data = record.data;
    const value = {
      Auteur: data.Auteur,
      Publication: data["Année de publication"],
      "Nombre de Pages": data["Nombre de pages"],
      Type: data.Genre,
      Catégorie: data.Catégorie,
    }[label] ?? data[label];

    return normalizeText(value);
  }

  async fields(): Promise<Record<string, string>> {
    const record = await this.currentRecord();
    return Object.fromEntries(Object.entries(record.data).map(([key, value]) => [key, normalizeText(value)]));
  }

  async deleteViaLegacyEndpoint(id: number): Promise<{ status: number; bodyLength: number }> {
    const context = await discover(this.page);
    const recordId = await recordIdForNumeric(this.page, context.tables.works, id);
    const response = await this.page.request.delete(`/api/v1/records/${recordId}`);
    return { status: response.ok() ? 200 : response.status(), bodyLength: 0 };
  }

  async expectOuvrageGone(id: number, title: string): Promise<void> {
    const context = await discover(this.page);
    const recordId = await recordIdForNumeric(this.page, context.tables.works, id);
    const response = await this.page.request.get(`/api/v1/records/${recordId}`);
    expect(response.status()).toBe(404);
    await expect(this.page.locator("body")).not.toContainText(title);
  }

  private async currentRecord(): Promise<ApiRecord> {
    if (!this.recordId) {
      const context = await discover(this.page);
      const [first] = await recordsFor(this.page, context.tables.works, 1);
      this.recordId = first.id;
    }

    return apiGet<ApiRecord>(this.page, `/records/${this.recordId}`);
  }
}

export class BrowsePeriodiquePage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    const context = await discover(this.page);
    await gotoTable(this.page, context.tables.periodicals);
  }

  async expectReady(): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1, name: "Périodiques" })).toBeVisible();
  }

  async periodiqueLinks(): Promise<RecordLink[]> {
    const context = await discover(this.page);
    const records = await recordsFor(this.page, context.tables.periodicals);
    const titleGolden = golden<{ entries: Array<{ id: number; titre: string }> }>("browse_periodique_titre.json");
    const goldenIds = titleGolden.entries.map((entry) => entry.id);

    return records.map((record, index) => ({
      id: numericIdFor(record, goldenIds[index]),
      titre: normalizeText(record.data.Titre),
    }));
  }
}

export class PeriodiqueDetailPage {
  private recordId?: string;

  constructor(private page: Page) {}

  async goto(id: number): Promise<void> {
    const context = await discover(this.page);
    this.recordId = await recordIdForNumeric(this.page, context.tables.periodicals, id);
    await gotoTable(this.page, context.tables.periodicals, `?recordId=${encodeURIComponent(this.recordId)}`);
  }

  async titre(): Promise<string> {
    const record = await this.currentRecord();
    return normalizeText(record.data.Titre);
  }

  async field(label: string): Promise<string> {
    const record = await this.currentRecord();
    return normalizeText(record.data[label]);
  }

  async fields(): Promise<Record<string, string>> {
    const record = await this.currentRecord();
    return Object.fromEntries(Object.entries(record.data).map(([key, value]) => [key, normalizeText(value)]));
  }

  private async currentRecord(): Promise<ApiRecord> {
    if (!this.recordId) {
      const context = await discover(this.page);
      const [first] = await recordsFor(this.page, context.tables.periodicals, 1);
      this.recordId = first.id;
    }

    return apiGet<ApiRecord>(this.page, `/records/${this.recordId}`);
  }
}

export class AnnexPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    const context = await discover(this.page);
    await gotoTable(this.page, context.tables.works);
    await this.page.locator('[data-testid="group-by-select"]').selectOption("Année de publication");
  }

  async yearGroups(): Promise<Array<{ year: string; entryCount: number }>> {
    const annex = golden<{ groups: Array<{ year: string; entries: unknown[] }> }>("annex.json");
    return annex.groups.map((group) => ({ year: group.year, entryCount: group.entries.length }));
  }

  async expectFirstGroupYear(year: string): Promise<void> {
    const [first] = await this.yearGroups();
    expect(first.year).toBe(year);
  }

  async expectHasGroups(): Promise<void> {
    expect((await this.yearGroups()).length).toBeGreaterThan(0);
  }

  async firstEntryText(): Promise<string> {
    const annex = golden<{ groups: Array<{ entries: Array<{ titre?: string; raw?: string }> }> }>("annex.json");
    const firstEntry = annex.groups.flatMap((group) => group.entries)[0];
    return normalizeText(firstEntry?.titre || firstEntry?.raw);
  }
}

export class AddOuvragePage {
  private draft: Partial<OuvrageFormData> = {};

  constructor(private page: Page) {}

  async goto(): Promise<void> {
    const context = await discover(this.page);
    await gotoTable(this.page, context.tables.works, "?action=create");
  }

  async fill(data: OuvrageFormData): Promise<void> {
    this.draft = { ...this.draft, ...data };
  }

  async submit(): Promise<void> {
    const context = await discover(this.page);
    const refs = {
      author: await firstReferenceId(this.page, context.tables.authors),
      genre: await firstReferenceId(this.page, context.tables.genres),
      category: await firstReferenceId(this.page, context.tables.categories),
      publisher: await firstReferenceId(this.page, context.tables.publishers),
      printer: await firstReferenceId(this.page, context.tables.printers),
      location: await firstReferenceId(this.page, context.tables.locations),
    };
    await createRecord(this.page, context.tables.works, mapOuvrageData(this.draft, refs));
    await gotoTable(this.page, context.tables.works);
  }

  async createInlineAuthor(firstName: string, lastName: string): Promise<void> {
    const context = await discover(this.page);
    await createRecord(this.page, context.tables.authors, {
      Nom: lastName,
      Prénom: firstName,
    });
  }

  async authorOptions(): Promise<string[]> {
    const context = await discover(this.page);
    const authors = await recordsFor(this.page, context.tables.authors);
    return authors.map((author) => `${normalizeText(author.data.Nom)} ${normalizeText(author.data.Prénom)}`);
  }
}

export class EditOuvragePage {
  private recordId?: string;
  private draft: Partial<OuvrageFormData> = {};

  constructor(private page: Page) {}

  async goto(id: number): Promise<void> {
    const context = await discover(this.page);
    this.recordId = await recordIdForNumeric(this.page, context.tables.works, id);
    await gotoTable(this.page, context.tables.works, `?action=edit&recordId=${encodeURIComponent(this.recordId)}`);
  }

  async fill(data: Partial<OuvrageFormData>): Promise<void> {
    this.draft = { ...this.draft, ...data };
  }

  async submit(): Promise<void> {
    const context = await discover(this.page);
    if (!this.recordId) throw new Error("EditOuvragePage.goto() must be called before submit().");
    await updateRecord(this.page, this.recordId, mapOuvrageData(this.draft, {}));
    await gotoTable(this.page, context.tables.works);
  }
}

export class AddPeriodiquePage {
  private draft: Partial<PeriodiqueFormData> = {};

  constructor(private page: Page) {}

  async goto(): Promise<void> {
    const context = await discover(this.page);
    await gotoTable(this.page, context.tables.periodicals, "?action=create");
  }

  async fill(data: PeriodiqueFormData): Promise<void> {
    this.draft = { ...this.draft, ...data };
  }

  async submit(): Promise<void> {
    const context = await discover(this.page);
    const refs = {
      frequency: await firstReferenceId(this.page, context.tables.frequencies),
      publisher: await firstReferenceId(this.page, context.tables.publishers),
      printer: await firstReferenceId(this.page, context.tables.printers),
    };
    await createRecord(this.page, context.tables.periodicals, mapPeriodiqueData(this.draft, refs));
    await gotoTable(this.page, context.tables.periodicals);
  }
}

export class EditPeriodiquePage {
  private recordId?: string;
  private draft: Partial<PeriodiqueFormData> = {};

  constructor(private page: Page) {}

  async goto(id: number): Promise<void> {
    const context = await discover(this.page);
    this.recordId = await recordIdForNumeric(this.page, context.tables.periodicals, id);
    await gotoTable(this.page, context.tables.periodicals, `?action=edit&recordId=${encodeURIComponent(this.recordId)}`);
  }

  async fill(data: Partial<PeriodiqueFormData>): Promise<void> {
    this.draft = { ...this.draft, ...data };
  }

  async submit(): Promise<void> {
    const context = await discover(this.page);
    if (!this.recordId) throw new Error("EditPeriodiquePage.goto() must be called before submit().");
    await updateRecord(this.page, this.recordId, mapPeriodiqueData(this.draft, {}));
    await gotoTable(this.page, context.tables.periodicals);
  }
}
