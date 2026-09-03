#!/usr/bin/env node
/* Builds dist/botiss-CI-Desk-preview.html — one self-contained file that
   runs in any browser, straight from an email attachment, with no Claude
   account and no shared store behind it.

   Generated from index.html plus tools/preview-overrides.js so the preview
   can never drift from the real app.

   Usage: node tools/build-preview.js
*/

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "index.html"), "utf8");
const overrides = fs.readFileSync(path.join(root, "tools/preview-overrides.js"), "utf8");

/* index.html is authored as an artifact body: the platform supplies the
   document shell. Standing alone it needs its own head, so lift the title
   and the font link out of the body and into it. */
const title = (app.match(/<title>[\s\S]*?<\/title>/i) || ["<title>botiss CI Desk</title>"])[0];
const fontLink = (app.match(/<link[^>]*fonts\.googleapis\.com[^>]*>/i) || [""])[0];

const body = app.replace(title, "").replace(fontLink, "").trim();

const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="description" content="Preview copy of the botiss CI Desk, for review.">
${title.replace("</title>", " — preview</title>")}
${fontLink}
<style>
  /* The artifact host normally supplies these few lines. */
  :root{color-scheme:light dark}
  html{-webkit-text-size-adjust:100%}
  img{max-width:100%}
  [hidden]{display:none!important}
</style>
</head>
<body>
${body}

<script>
${overrides}
</script>
</body>
</html>
`;

const dir = path.join(root, "dist");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, "botiss-CI-Desk-preview.html");
fs.writeFileSync(file, out);

console.log("wrote " + path.relative(root, file) +
  "  (" + (Buffer.byteLength(out) / 1024).toFixed(0) + " KB)");
