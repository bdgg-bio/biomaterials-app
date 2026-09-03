#!/usr/bin/env node
/* Collapses reference/library-export/evidence/*.json (written by
   Artifact action="read_db" with out_dir) into the single flat array that
   tools/ingest_papers.py --existing expects for dedupe.

   Usage: node tools/snapshot-library.js */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dir = path.join(root, "reference/library-export/evidence");
const out = path.join(root, "reference/library-snapshot.json");

if (!fs.existsSync(dir)) {
  console.error("no export at " + dir + "\nRun the Artifact read_db export first:\n" +
    '  Artifact(action="read_db", url=<artifact url>, db_op="list", collection="evidence",\n' +
    '           out_dir="reference/library-export", query={"limit":1000})');
  process.exit(1);
}

const rows = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  /* The export wraps each record as {id, data, version, updatedAt}. */
  const d = raw.data || raw;
  rows.push({
    id: raw.id || f.replace(/\.json$/, ""),
    title: d.title || "",
    identifier: d.identifier || "",
    product: d.product || "",
    studyType: d.studyType || "",
    verifiedBy: d.verifiedBy || "",
  });
}

rows.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(out, JSON.stringify(rows, null, 1));

const withDoi = rows.filter(r => /10\.\d{4,9}\//.test(r.identifier)).length;
console.log("snapshot: " + rows.length + " records -> " + path.relative(root, out));
console.log("  " + withDoi + " carry a DOI (those dedupe exactly; the rest dedupe on title)");
