#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const goldenDir = path.join(__dirname, "golden");
const outputDir = path.join(__dirname, "artifacts");
const deltasPath = path.join(repoRoot, "docs/DELTAS.md");

const contracts = [
  {
    id: "dashboard-counts",
    contract: "Dashboard counts",
    v2: ["dashboard.json"],
    v3: ["tests/parity/ParityTest.php", "tests/e2e/specs/01-dashboard.spec.ts"],
  },
  {
    id: "browse-ouvrages-titre",
    contract: "Browse ouvrages by title",
    v2: ["browse_ouvrage_titre.json"],
    v3: ["tests/parity/ParityTest.php", "tests/e2e/specs/02-browse-ouvrages.spec.ts"],
    delta: "docs/DELTAS.md#1-database-collation-sorting-differences",
  },
  {
    id: "browse-ouvrages-auteurs",
    contract: "Browse ouvrages by author",
    v2: ["browse_ouvrage_auteurs.json"],
    v3: ["tests/parity/ParityTest.php", "tests/e2e/specs/02-browse-ouvrages.spec.ts"],
    delta: "docs/DELTAS.md#3-duplicate-display-labels",
  },
  {
    id: "browse-ouvrages-dates",
    contract: "Browse ouvrages by date",
    v2: ["browse_ouvrage_dates.json"],
    v3: ["tests/parity/ParityTest.php", "tests/e2e/specs/02-browse-ouvrages.spec.ts"],
  },
  {
    id: "browse-ouvrages-genre",
    contract: "Browse ouvrages by genre",
    v2: ["browse_ouvrage_genre.json"],
    v3: ["tests/parity/ParityTest.php", "tests/e2e/specs/02-browse-ouvrages.spec.ts"],
  },
  {
    id: "browse-ouvrages-categorie",
    contract: "Browse ouvrages by category",
    v2: ["browse_ouvrage_categorie.json"],
    v3: ["tests/parity/ParityTest.php", "tests/e2e/specs/02-browse-ouvrages.spec.ts"],
  },
  {
    id: "browse-periodiques-titre",
    contract: "Browse periodiques by title",
    v2: ["browse_periodique_titre.json"],
    v3: ["tests/parity/ParityTest.php", "tests/e2e/specs/03-browse-periodiques.spec.ts"],
    delta: "docs/DELTAS.md#3-duplicate-display-labels",
  },
  {
    id: "detail-ouvrages",
    contract: "Ouvrage detail payloads",
    v2: ["detail_ouvrages.json"],
    v3: ["tests/parity/ParityTest.php", "tests/e2e/specs/02-browse-ouvrages.spec.ts"],
  },
  {
    id: "detail-periodiques",
    contract: "Periodique detail payloads",
    v2: ["detail_periodiques.json"],
    v3: ["tests/parity/ParityTest.php", "tests/e2e/specs/03-browse-periodiques.spec.ts"],
    delta: "docs/DELTAS.md#3-duplicate-display-labels",
  },
  {
    id: "annex",
    contract: "Annex year groups",
    v2: ["annex.json"],
    v3: ["tests/parity/ParityTest.php", "tests/e2e/specs/06-annex.spec.ts"],
    delta: "docs/DELTAS.md#4-annex-ordering-and-whitespace",
  },
  {
    id: "loadchoices",
    contract: "Reference loadchoices",
    v2: ["loadchoices.json"],
    v3: ["tests/parity/ParityTest.php"],
    delta: "docs/DELTAS.md#2-dynamic-reference-mappings",
  },
  {
    id: "write-ouvrage-create-edit-delete",
    contract: "Ouvrage create, edit, delete journey",
    v2: ["tests/e2e/specs/04-write-ouvrage.spec.ts"],
    v3: ["tests/e2e/specs/04-write-ouvrage.spec.ts"],
  },
  {
    id: "write-periodique-create-edit",
    contract: "Periodique create and edit journey",
    v2: ["tests/e2e/specs/05-write-periodique.spec.ts"],
    v3: ["tests/e2e/specs/05-write-periodique.spec.ts"],
  },
];

function existsRelative(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function goldenExists(file) {
  return fs.existsSync(path.join(goldenDir, file));
}

function sourceExists(source) {
  return source.endsWith(".json") ? goldenExists(source) : existsRelative(source);
}

function cellStatus(sources) {
  const missing = sources.filter((source) => !sourceExists(source));
  return {
    ok: missing.length === 0,
    missing,
  };
}

function link(source) {
  const label = source.replace(/^tests\/parity\/golden\//, "");
  if (source.endsWith(".json")) {
    return `[${label}](../golden/${source})`;
  }

  return `[${label}](../../../${source})`;
}

function deltaLink(source) {
  return source.replace(/^docs\//, "../../../docs/");
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markdown() {
  const generatedAt = new Date().toISOString();
  const rows = contracts.map((contract) => {
    const v2 = cellStatus(contract.v2);
    const v3 = cellStatus(contract.v3);
    const deltaExists = contract.delta ? existsRelative(contract.delta.split("#")[0]) : true;
    const ok = v2.ok && v3.ok && deltaExists;
    const delta = contract.delta ? `[accepted](${deltaLink(contract.delta)})` : "";

    return [
      ok ? "green" : "red",
      contract.id,
      contract.contract,
      contract.v2.map(link).join("<br>"),
      contract.v3.map(link).join("<br>"),
      delta,
      [...v2.missing, ...v3.missing, ...(deltaExists ? [] : [contract.delta])].join("<br>"),
    ];
  });

  return [
    "# R1-F2 Parity Matrix",
    "",
    `Generated: ${generatedAt}`,
    "",
    "A green row means the v2 baseline source exists, the v3 adapter/journey coverage exists, and any accepted deviation is linked to `docs/DELTAS.md`.",
    "",
    "| Status | Contract | Scope | v2 golden baseline | v3 result / coverage | Accepted delta | Missing |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
  ].join("\n");
}

function html(markdownText) {
  const rows = contracts.map((contract) => {
    const v2 = cellStatus(contract.v2);
    const v3 = cellStatus(contract.v3);
    const deltaExists = contract.delta ? existsRelative(contract.delta.split("#")[0]) : true;
    const ok = v2.ok && v3.ok && deltaExists;
    const missing = [...v2.missing, ...v3.missing, ...(deltaExists ? [] : [contract.delta])];

    return `<tr class="${ok ? "ok" : "bad"}">
      <td>${ok ? "green" : "red"}</td>
      <td>${htmlEscape(contract.id)}</td>
      <td>${htmlEscape(contract.contract)}</td>
      <td>${contract.v2.map(htmlEscape).join("<br>")}</td>
      <td>${contract.v3.map(htmlEscape).join("<br>")}</td>
      <td>${contract.delta ? htmlEscape(contract.delta) : ""}</td>
      <td>${missing.map(htmlEscape).join("<br>")}</td>
    </tr>`;
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>R1-F2 Parity Matrix</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1f2937; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 0.55rem; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; }
    tr.ok td:first-child { color: #166534; font-weight: 700; }
    tr.bad td:first-child { color: #991b1b; font-weight: 700; }
    code { background: #f3f4f6; padding: 0.1rem 0.25rem; border-radius: 0.2rem; }
  </style>
</head>
<body>
  <h1>R1-F2 Parity Matrix</h1>
  <p>Generated: <code>${htmlEscape(new Date().toISOString())}</code></p>
  <p>A green row means the v2 baseline source exists, the v3 adapter/journey coverage exists, and any accepted deviation is linked to <code>docs/DELTAS.md</code>.</p>
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Contract</th>
        <th>Scope</th>
        <th>v2 golden baseline</th>
        <th>v3 result / coverage</th>
        <th>Accepted delta</th>
        <th>Missing</th>
      </tr>
    </thead>
    <tbody>
      ${rows.join("\n")}
    </tbody>
  </table>
</body>
</html>
`;
}

fs.mkdirSync(outputDir, { recursive: true });
const markdownText = markdown();
fs.writeFileSync(path.join(outputDir, "parity-matrix.md"), markdownText);
fs.writeFileSync(path.join(outputDir, "parity-matrix.html"), html(markdownText));

const redRows = contracts.filter((contract) => {
  const v2 = cellStatus(contract.v2);
  const v3 = cellStatus(contract.v3);
  const deltaExists = contract.delta ? existsRelative(contract.delta.split("#")[0]) : true;
  return !v2.ok || !v3.ok || !deltaExists;
});

console.log(`Generated ${path.relative(repoRoot, outputDir)}/parity-matrix.md`);
console.log(`Generated ${path.relative(repoRoot, outputDir)}/parity-matrix.html`);

if (redRows.length > 0) {
  console.error(`Parity matrix contains ${redRows.length} red row(s).`);
  process.exit(1);
}
