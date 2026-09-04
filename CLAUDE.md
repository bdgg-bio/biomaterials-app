# botiss CI Desk — working notes

Competitive intelligence app for the botiss / Straumann dental
regenerative-biomaterials sales team, with two Claude agents in it.

Everything ships as **one file**: [`index.html`](index.html). No build step, no
dependencies, no server. It runs as a Claude Artifact, which is what grants it
the runtime capabilities below.

**Live artifact:** https://claude.ai/code/artifact/08aa4715-7d48-4a95-8312-bbf839ad6c1c

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole app. `KB` near the top of the script is the static knowledge base; both the UI and the agent briefings render from it, so they cannot drift. |
| `tools/build-preview.js` | Builds `dist/botiss-CI-Desk-preview.html`, a no-JavaScript static copy for forwarding by email. |
| `tools/ingest_papers.py` | Turns a folder of published-paper PDFs into evidence-library entries. |
| `tools/parse_literature_lists.py` | Turns the botiss "Most Relevant Publications" list PDFs into evidence-library entries. |
| `tools/compact-batches.js` | Re-keys parsed entries onto short product-prefixed ids and writes the `write_db` batch manifests. |
| `reference/evidence-import/` | The 42 literature entries imported from the botiss training decks, as committed JSON. |
| `reference/lit/` | The 372 entries from the eight product literature lists, plus `parse-report.md` and `parse-review.md`. |
| `reference/library-snapshot.json` | Six fields per record for all 443 references. `ingest_papers.py --existing` dedupes against it. |
| `reference/BotissCIWorkspace.jsx` | The original React workspace. Superseded, kept for provenance. |

## The two desks

One `sample` connection, two agents over it (`AgentRuntime`, then `SALES` and
`SCIENCE` built by `makeAgent`). Both run on **the viewer's own Claude
account** — first question asks their permission, usage counts against their
plan, no shared key in the page.

- **Ask** (commercial): positioning, objections, price, attach rate. Tools:
  `search_price_intel`, `log_price_point`, `log_field_note`, `ask_science`,
  `attach_rate_math`, `competitor_profile`, `save_learning`.
- **Science** (evidence): grades claims, gives safe and unsafe wording, cites
  only from the library. Tools: `search_evidence`, `add_evidence`,
  `list_escalations`, `resolve_escalation`, `save_learning`.

They hand work to each other through the store: `ask_science` files an
escalation, `resolve_escalation` answers it and writes the answer into
`learned`, which both briefings read.

## Rules that must not be relaxed

**The science desk never invents a citation.** No author, journal, year, DOI,
PMID, patient number or percentage unless it appears verbatim in the evidence
library. Its instructions say so explicitly, including when a rep insists or
says a customer is waiting. The page has no web access and Claude inside it
cannot search, so any citation it produced from memory would be fabricated —
and a fabricated study quoted to a clinician is both a real harm and a claims
exposure for botiss. If it ever produces an unlisted reference, that is a bug,
not a feature to build on.

**Claim tiers** (`KB.claimTiers`) — every science answer names one:

1. Portfolio fact — IFU and technical file. Say it freely.
2. Mechanism or preclinical — "designed to", never a patient outcome.
3. Clinical outcome for our product — needs a library reference and sign-off.
4. Better than a named competitor — assume it cannot be said.

**`KB.evidenceAreas`** is deliberately written with no authors, years or
numbers. Specifics belong in the library where they can be verified. Keep it
that way.

## The evidence library

Shared `db` collection `evidence`. Field conventions:

- `title`, `authors`, `journal`, `year`, `identifier` — as printed. Never
  reconstructed from memory.
- `studyType` — drives `evidenceRank()`, which orders both the agent's index
  and search results by strength of design. Use the wording already in use so
  the ranking keeps working.
- `product` — which product it was actually run on. This matters more than
  anything else in the record: cerabone evidence and Bio-Oss evidence get
  conflated constantly, and most of the classic xenograft literature was
  generated on Bio-Oss.
- `supports` — **the judgement field.** What the reference licenses, stated
  narrowly. If the endpoint was radiographic ridge width at six months, say
  that, not "volume stability". Never auto-generate this.
- `verifiedBy` — who confirmed the reference says what it is cited for. Empty
  means unverified, and the desk flags it on every citation.

Entries that are **not** clinical evidence are kept and labelled as such
(a customer survey, a validation report, uncited data on file, trade-journal
articles, deck case documentation). Approval makes a citation usable; it does
not change what the source is.

### Scale

The library is built for several hundred references:

- `briefEvidence()` gives the agent a **ranked index only** (60 one-liners plus
  per-product counts), not the full records. Verified at 350 references: a
  28 KB briefing against the 64 KiB input cap, leaving ~37 KB for the
  conversation.
- Full records reach the agent only through `search_evidence`, which returns
  the strongest 15 matches by design and reports the total match count.
- The store subscribes to up to 1000 evidence rows; the UI filters and windows
  to 25.

## Ingesting a batch of paper PDFs

A Claude Code session in the cloud cannot see a local disk — no drive letters,
no mounts. For a folder of PDFs on someone's machine there are two routes.

**Route A, run it where the PDFs are** (best for hundreds of files; the PDFs
never leave the machine, only the extracted metadata does):

```
git clone https://github.com/bdgg-bio/biomaterials-app
cd biomaterials-app
pip install pypdf
python tools\ingest_papers.py "C:\path\to\Literature" --out out --existing reference\library-snapshot.json
```

Then hand over `out/all-entries.json` — one portable file, roughly 400 KB for
300 papers, carrying no absolute paths. In the session that has the Artifact
tool:

```
node tools/materialise-entries.js all-entries.json --out inbox
Artifact(action="write_db", url=<artifact url>, db_op="batch",
         writes=<contents of inbox/batches/batch-1.json>)
```

All file I/O in the Python script is explicitly UTF-8, because Windows
defaults to cp1252 and dies on umlauts and degree signs.

**Route B, upload the PDFs** to a session that has the Artifact tool and run
it there:

```
pip install cffi pypdf                     # cffi first: this container's system cryptography is broken without it
python3 tools/ingest_papers.py <pdf-dir> --out out --existing reference/library-snapshot.json
```

It writes `out/entries/*.json`, `out/batches/batch-N.json` (50 writes each,
the `write_db` limit), `out/report.md` and `out/review.md`.

The split of labour is the point: **mechanical fields are extracted
automatically** (DOI, PMID, year, journal, title, authors, design, product,
because each can be checked against the page), while **`supports` is not**.
Each entry lands with `supports` marked `SCOPE NOT YET WRITTEN` holding the
paper's **own abstract or conclusion verbatim** — never a paraphrase. Write
scope statements by hand, claim-critical papers first.

Then write the batches with the Artifact tool:

```
Artifact(action="write_db", url=<artifact url>, db_op="batch",
         writes=<contents of out/batches/batch-1.json>)
```

Check `out/review.md` before writing: scanned PDFs need OCR, and entries with
no DOI, no design or several designs matched need a human.

## Ingesting a botiss literature list

The "Most Relevant Publications" list PDFs are a different shape from papers —
one numbered entry per reference, each with the citation and the paper's own
abstract:

```
python3 tools/parse_literature_lists.py <dir-of-txt> --out out
node tools/compact-batches.js out/all-entries-deduped.json --out reference/lit
```

**Always reconcile before writing.** Count the numbered lines in the source,
subtract the table-of-contents and section headings, and require the parsed
total to match exactly. The eight lists reconcile as 397 numbered lines − 20
headings = 377 entries. A count that is merely *close* is the signature of the
two bugs this parser has already had: a citation wrapping mid-page-range splits
one entry into two, and a title starting with a digit ("3D-Printed…",
"2-year…") gets swallowed by the entry above it — which then carries the
swallowed paper's DOI and PMID. Both put a real reference under the wrong
identifier, which is the failure the desk's no-invented-citations rule exists
to prevent.

Two smaller things the extractor gets wrong if left alone: the page folio
beside each running header lands inside the verbatim quote, and the merge will
overwrite a `verifiedBy` set by a person with the weaker "product literature
list". Both are handled now; both are worth re-checking after any change to
the parser, with:

```
grep -ho '[a-z]\{4,\}[.,] [0-9]\{1,3\}”' reference/lit/*.json | wc -l   # want 0
```

## Publishing

```
Artifact(file_path="index.html", url="<artifact url>")   # same URL, everyone gets it on next open
node tools/build-preview.js                              # then re-send the static preview
```

Declaring `db` makes the artifact **organisation-internal** — it cannot be
shared by public link, and colleagues must be signed-in members of the same
Claude organisation. That is why the no-JavaScript preview exists.

## Verifying a change

No test suite; verify in a headless browser. `pw = require('/opt/node22/lib/node_modules/playwright')`.
Check: no `pageerror`, no horizontal overflow at 393px, every tab renders, and
both briefings stay well inside 64 KiB. The preview build fails on its own if a
`<script>` tag ever appears in the output.

## Known gaps

- No viewer-identity capability, so the name on logged intel is self-declared
  per device and unverified.
- No literature list yet for **cerabone** or **maxgraft** — the two products
  the team sells hardest are the two whose lists have not been imported.
- **NOVAMag has 19 references and is the highest risk**: the youngest evidence
  base and the most enthusiastic audience. permamem (24) and cerabone plus (21)
  are the next thinnest.
- Nearly every imported entry still holds `SCOPE NOT YET WRITTEN` in `supports`,
  wrapping the paper's own abstract or conclusion verbatim. The desk can cite
  them, but nothing tells it what each one narrowly licenses until a person
  writes the scope statement. Claim-critical papers first.
- The maxgraft +HyA volumetric-stability numbers are presented in the deck
  without a citation. Get the reference from Medical Affairs before they are
  used externally.
