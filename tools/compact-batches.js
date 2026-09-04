#!/usr/bin/env node
/* Re-keys parsed literature entries onto short, product-prefixed document
   ids and writes them to a short path, so the write_db batch manifests stay
   small. Descriptive slugs are pleasant but a 460-character manifest entry
   times 373 is a lot of payload for no gain: the ids are internal handles,
   and the UI and the agent both cite by title.

   Usage: node tools/compact-batches.js <all-entries.json> [--out reference/lit]
*/

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const src = args[0];
const oi = args.indexOf("--out");
const outDir = path.resolve(oi > -1 ? args[oi + 1] : "reference/lit");

if (!src || !fs.existsSync(src)) {
  console.error("usage: node tools/compact-batches.js <all-entries.json> [--out reference/lit]");
  process.exit(1);
}

const PREFIX = [
  [/^Jason membrane/i, "jas"],
  [/^collprotect/i, "cop"],
  [/^permamem/i, "per"],
  [/^NOVAMag/i, "nov"],
  [/^mucoderm/i, "muc"],
  [/^collacone/i, "coc"],
  [/^cerabone plus/i, "cbp"],
  [/^maxresorb/i, "mxr"],
];
const prefixFor = p => (PREFIX.find(([re]) => re.test(p || "")) || [, "oth"])[1];

const rows = JSON.parse(fs.readFileSync(src, "utf8"));
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "batches"), { recursive: true });

const counters = {};
const written = [];
const idMap = {};

for (const r of rows) {
  const pre = prefixFor(r.data.product);
  counters[pre] = (counters[pre] || 0) + 1;
  const id = pre + String(counters[pre]).padStart(3, "0");
  const file = path.join(outDir, id + ".json");
  fs.writeFileSync(file, JSON.stringify(r.data, null, 1));
  written.push({ id, file });
  idMap[id] = { title: r.data.title, product: r.data.product, was: r.doc_id };
}

fs.writeFileSync(path.join(outDir, "id-map.json"), JSON.stringify(idMap, null, 1));

const BATCH = 50;
for (let i = 0; i < written.length; i += BATCH) {
  const chunk = written.slice(i, i + BATCH);
  fs.writeFileSync(
    path.join(outDir, "batches", "b" + (i / BATCH + 1) + ".json"),
    JSON.stringify(chunk.map(w => ({
      op: "set", collection: "evidence", doc_id: w.id, file_path: w.file,
    })), null, 1));
}

const n = Math.ceil(written.length / BATCH);
console.log("wrote " + written.length + " entries to " + path.relative(process.cwd(), outDir));
console.log("by product prefix: " + Object.entries(counters).map(([k, v]) => k + "=" + v).join(" "));
console.log(n + " batch manifest(s) at " + path.relative(process.cwd(), path.join(outDir, "batches")));
const sample = JSON.parse(fs.readFileSync(path.join(outDir, "batches", "b1.json"), "utf8"))[0];
console.log("manifest entry size: " + JSON.stringify(sample).length + " chars");
