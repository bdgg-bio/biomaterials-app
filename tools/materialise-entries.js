#!/usr/bin/env node
/* Rebuilds per-entry JSON files and write_db batch manifests from the single
   portable `all-entries.json` that tools/ingest_papers.py emits.

   Why this exists: the ingest can run on a Windows laptop where the PDFs
   live, but the batch manifests need absolute paths valid on the machine
   that actually calls the Artifact tool. So the laptop hands over one small
   portable file, and this regenerates the local paths here.

   Usage:
     node tools/materialise-entries.js <all-entries.json> [--out inbox]

   Then write each batch:
     Artifact(action="write_db", url=<artifact url>, db_op="batch",
              writes=<contents of inbox/batches/batch-1.json>)
*/

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const src = args[0];
const outIdx = args.indexOf("--out");
const outDir = path.resolve(outIdx > -1 ? args[outIdx + 1] : "inbox");

if (!src || !fs.existsSync(src)) {
  console.error("usage: node tools/materialise-entries.js <all-entries.json> [--out inbox]");
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(src, "utf8"));
if (!Array.isArray(rows) || !rows.length) {
  console.error("no entries in " + src);
  process.exit(1);
}

const entriesDir = path.join(outDir, "entries");
const batchesDir = path.join(outDir, "batches");
fs.mkdirSync(entriesDir, { recursive: true });
fs.mkdirSync(batchesDir, { recursive: true });

const ID_OK = /^(?!\.\.?$)[A-Za-z0-9_\-.~:@+]{1,200}$/;
const written = [];
const rejected = [];

for (const row of rows) {
  const id = String(row.doc_id || "");
  if (!ID_OK.test(id)) { rejected.push({ id, why: "id breaks the document-path grammar" }); continue; }
  const data = row.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    rejected.push({ id, why: "data is not an object" });
    continue;
  }
  if (!data.title) { rejected.push({ id, why: "no title" }); continue; }

  /* A document body must be a plain JSON object under 256 KiB. */
  const body = JSON.stringify(data);
  if (Buffer.byteLength(body) > 240 * 1024) { rejected.push({ id, why: "over the document size cap" }); continue; }

  const file = path.join(entriesDir, id + ".json");
  fs.writeFileSync(file, JSON.stringify(data, null, 1));
  written.push({ id, file });
}

const BATCH = 50;
const manifests = [];
for (let i = 0; i < written.length; i += BATCH) {
  const chunk = written.slice(i, i + BATCH);
  const n = i / BATCH + 1;
  const mf = path.join(batchesDir, "batch-" + n + ".json");
  fs.writeFileSync(mf, JSON.stringify(chunk.map(w => ({
    op: "set", collection: "evidence", doc_id: w.id, file_path: w.file,
  })), null, 1));
  manifests.push({ mf, count: chunk.length });
}

console.log("materialised " + written.length + " entries into " + path.relative(process.cwd(), entriesDir));
for (const m of manifests) {
  console.log("  " + path.relative(process.cwd(), m.mf) + "  (" + m.count + " writes)");
}
if (rejected.length) {
  console.log("\nrejected " + rejected.length + ":");
  for (const r of rejected.slice(0, 20)) console.log("  " + (r.id || "(no id)") + " — " + r.why);
  if (rejected.length > 20) console.log("  … and " + (rejected.length - 20) + " more");
}

const unscoped = written.filter(w => {
  const d = JSON.parse(fs.readFileSync(w.file, "utf8"));
  return String(d.supports || "").startsWith("SCOPE NOT YET WRITTEN");
}).length;
console.log("\n" + unscoped + " of " + written.length +
  " still need a scope statement before the science desk will cite them.");
