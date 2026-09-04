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
| `tools/pubmed_watch.py` | Watches PubMed (or Europe PMC) for new literature and turns the hits into quarantined evidence entries. |
| `tools/market_watch.py` | Fetches listed product and price pages and reports what changed since the last run. |
| `reference/market-sources.json` | Which pages `market_watch.py` fetches. Empty by design. |
| `reference/evidence-import/` | The 42 literature entries imported from the botiss training decks, as committed JSON. |
| `reference/lit/` | The 526 entries from the ten product literature lists, plus `parse-report.md` and `parse-review.md`. |
| `reference/library-snapshot.json` | Six fields per record for all 597 references. `ingest_papers.py --existing` dedupes against it. |
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
- `product` — which product it was actually run on, written **without** the ®:
  the agent's per-product index counts by this exact string, so "maxgraft®
  cortico" and "maxgraft cortico" would tally as two products and understate
  both. The maxgraft list is the only one divided by variant (granules,
  cortico, blocks, bonebuilder, bonering) and the parser carries the variant
  through, because "maxgraft bonering" is not interchangeable with "maxgraft
  granules". This field matters more than anything else in the record: cerabone evidence and Bio-Oss evidence get
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

On Linux or macOS the same thing, with a virtualenv because recent
distributions refuse a bare `pip install` into the system Python:

```
sudo apt install -y python3-venv git nodejs      # Ubuntu; nodejs only for the JS tools
python3 -m venv .venv && . .venv/bin/activate
pip install pypdf
python3 tools/ingest_papers.py ~/Literature --out out \
        --existing reference/library-snapshot.json
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
total to match exactly. The ten lists reconcile as 397 − 20 = 377 for the
first eight, 112 for cerabone and 52 for maxgraft: 541 parsed, 15 merged into
records already held, 526 imported. A count that is merely *close* is the signature of the
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

## Getting the project onto a machine without GitHub

The repository is small (about 6 MB with its whole history), so it travels as
one file. A **git bundle** carries every commit and branch, and clones like a
remote, which is the version to prefer — the local copy keeps its history and
can still be pointed at GitHub later:

```
git clone botiss-CI-Desk.bundle biomaterials-app
cd biomaterials-app
git remote set-url origin https://github.com/bdgg-bio/biomaterials-app   # optional
```

A plain `.tar.gz` of the working tree is the no-git alternative; it holds the
same files without the history.

What runs on a normal machine and what does not:

- `dist/botiss-CI-Desk-preview.html` opens in any browser, offline. No JS.
- `index.html` opens too, but the two desks will not answer. `claude.use()`
  returns `null` outside the artifact runtime, so there is no `sample` and no
  `db`: the page falls back to `localStorage` and renders the static knowledge
  base. The desks only work at the published artifact URL.
- The Python tools all run locally, and `tools/pubmed_watch.py` and
  `tools/market_watch.py` **only** work somewhere with network access, which
  is the whole reason they are scripts rather than page code.

## Why the agents have no internet, and what to do instead

Worth knowing before anyone tries again. **The page cannot make a network
request.** The artifact runtime's CSP blocks fetch, XHR and WebSocket to every
host, silently — so the desks cannot call PubMed, a shop, or any API, and no
amount of in-page code changes that. The single route out is the `mcp`
capability, which reaches **the viewer's own claude.ai connectors**; the ones
on this organisation are Asana, Atlassian, Box, Canva, Figma, HubSpot,
Intercom, Linear, monday.com, Notion and the Anthropic Economic Index, none of
which serves literature or web search. `sample` asks Claude but grants it no
tools of its own.

So anything from outside arrives as a **pipeline**: a watcher runs where there
is network access, and a Claude Code session writes the result into the store
with the Artifact tool. That is also the safer arrangement — no language model
sits in the citation path, so identifiers come out of the structured record and
can be checked.

Note that **this cloud session cannot run the watchers either**: the egress
policy blocks `eutils.ncbi.nlm.nih.gov`, `www.ebi.ac.uk`, `api.crossref.org`
and `doi.org`. Run them on a machine that can reach those hosts, the same
Route A handoff the paper ingest already uses.

```
python3 tools/pubmed_watch.py --out out-watch --since 2026-08-01 \
        --existing reference/library-snapshot.json
python3 tools/market_watch.py --sources reference/market-sources.json --out out-market
```

### Two quarantines, and why they are not optional

Both watchers write into collections the desks treat as authoritative, so both
land in a tier the desks refuse to use:

- **Evidence.** An entry carries `via: "pubmed"` and an empty `verifiedBy`.
  `isAutoIngested()` routes it out of the briefing's index into an AWAITING
  REVIEW block, and out of `search_evidence`'s `citable` into
  `awaiting_review`. The desk may say the paper exists and offer to draft a
  review request; it may not quote it, cite it, or state what it found.
- **Prices.** A row carries `via: "web"` and `confirmed: false`, and
  `search_price_intel` returns it under `web_candidates`, never `verified`.
  Rows also carry an age, and anything over `PRICE_STALE_DAYS` is flagged
  stale — a two-year-old list price quoted as today's is how a rep gets caught
  out.

The briefing used to open "All are Medical Affairs approved unless an entry
says otherwise". That sentence was true only while every record came from a
deck or a literature list, and the moment a feed writes to the library it
becomes a lie the science desk would act on. If you add another source, add
its `via` value to `AUTO_VIA` **before** the first write, not after.

Reviewing an auto-ingested entry means reading the paper, setting `product` to
what it was actually run on, writing the scope statement into `supports`, and
setting `verifiedBy`. Only then is it citable.

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
- **NOVAMag has 19 references and is the highest risk**: the youngest evidence
  base and the most enthusiastic audience. maxgraft bonering (4), maxgraft
  blocks (5) and maxgraft bonebuilder (9) are thinner still, though they are
  narrower indications; permamem (24) and cerabone plus (31) come next.
- Much of the cerabone list is xenograft literature generally rather than
  cerabone specifically, and the same is true of the allograft literature on
  the maxgraft list. The boilerplate in `supports` says so, but only a written
  scope statement settles what each one licenses.
- Nearly every imported entry still holds `SCOPE NOT YET WRITTEN` in `supports`,
  wrapping the paper's own abstract or conclusion verbatim. The desk can cite
  them, but nothing tells it what each one narrowly licenses until a person
  writes the scope statement. Claim-critical papers first.
- The maxgraft +HyA volumetric-stability numbers are presented in the deck
  without a citation. Get the reference from Medical Affairs before they are
  used externally.
- The watchers are written and tested but have **never run against the live
  services** — this environment's egress is blocked, so the PubMed parser was
  verified against a schema fixture and the price extractor against fixture
  HTML, not against ncbi.nlm.nih.gov or a real shop. Expect the first real run
  to need adjusting, and read `review.md` and `changes.md` before writing any
  batch.
- Nothing schedules the watchers yet. A Routine could wake a session to write
  batches, but it cannot fetch from here, so the fetch step still has to run on
  a machine with access.
