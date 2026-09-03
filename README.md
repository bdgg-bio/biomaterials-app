# botiss CI Desk

A phone-first competitive intelligence app for the botiss / Straumann dental
regenerative-biomaterials sales team, with a Claude agent built into it.

The whole app is one file: [`index.html`](index.html). No build step, no
dependencies, no server. It is published as a Claude Artifact, which is what
gives it the runtime capabilities described below.

## What it does

| Tab | Purpose |
|---|---|
| **Desk** | Market figures, the positioning map, share estimates, and a live feed of what the team has logged |
| **Ask** | The agent. Answers from the built-in briefing plus everything the team has logged, and can log new intel back |
| **Rivals** | Eight battlecards: products, recent moves, strengths, and where to push |
| **Plays** | The playbook, by rival type |
| **Products** | Every botiss line mapped against its competing products |
| **Prices** | Team-verified price intel (shared, live) kept separate from indicative grey-market anchors |
| **Markets** | Regional dynamics and the angle that works locally |
| **Deal** | Attach-rate maths — the number that reframes a price objection |
| **Learned** | What the desk knows because someone told it. Fed back into every agent answer |
| **Method** | Sources, how the agent works, and the limits worth stating out loud |

## How the three moving parts work

**The agent** runs on the `sample` capability. Each question is answered by
Claude **on the viewer's own account** — the first question in a session asks
their permission, and the usage counts against their plan. There is no shared
API key in the page. Claude sees only what the page sends it: a briefing
assembled from `KB` plus the team's logged intel, and the current conversation.
It has no memory of its own and cannot browse.

It is given six tools it can call in the page: search the price intel, log a
price, log a field note, save a learning, run the attach-rate maths, and pull a
full competitor profile. Anything it writes is marked `via agent` and can be
deleted.

**Shared team intel** uses the `db` capability: a realtime store scoped to this
artifact. Prices, notes and learnings appear for every colleague the moment they
are saved. If that store is unavailable in a given view, the app falls back to
the browser's local storage and says so in the header — it never breaks.

**CSV export** uses the `downloads` capability. The viewer confirms before
anything is saved.

## Bulk-importing published papers

`tools/ingest_papers.py` turns a folder of paper PDFs into evidence-library
entries, for the case where several hundred arrive at once:

```
pip install cffi pypdf
node tools/snapshot-library.js                    # after exporting the library with read_db
python3 tools/ingest_papers.py <pdf-dir> --out out \
        --existing reference/library-snapshot.json
```

Bibliographic fields, study design and the product studied are extracted
mechanically. The `supports` field — what the reference may actually license
in a sales conversation — is **not** generated: each entry lands holding the
paper's own abstract or conclusion verbatim, marked `SCOPE NOT YET WRITTEN`,
for a human to scope. See [CLAUDE.md](CLAUDE.md) for the full workflow and the
library's field conventions.

## Constraints that are real, not bugs

- **Declaring `db` makes the artifact organization-internal.** It cannot be
  shared by public link. Colleagues must be signed-in members of the same Claude
  organization, and the artifact has to be shared with them.
- **A colleague without Claude access can still use every tab except Ask.**
- **There is no verified identity.** No viewer-identity capability is available
  to the page, so the name attached to logged intel is self-declared per device.
- **Share splits are synthesised estimates**, not published figures. Brief with
  them; do not quote them.
- **Prices are quote-based** in this market. The anchors on the Prices tab are
  grey-market orientation, not channel prices.
- Market figures were researched in June 2026 and will drift.

## Updating it

Edit `index.html` and republish to the **same URL** so everyone gets the update
without reinstalling anything:

```
Artifact(file_path="index.html", url="<the artifact URL>")
```

The knowledge base is the `KB` object near the top of the script. The UI renders
from it and the agent is briefed from it, so editing one place updates both and
they cannot drift apart.

## Forwarding a preview to colleagues

For review by people who have no Claude account and are not in the
organisation, build a standalone file:

```
node tools/build-preview.js     # -> dist/botiss-CI-Desk-preview.html
```

That is one self-contained file (~80 KB) containing **no JavaScript at
all** — verified at build time, which fails the build if a `<script>` tag
ever appears in the output.

**Why no JavaScript.** A forwarded `.html` file is usually opened in a
preview surface rather than a full browser. iOS Mail and the Files app
render `.html` attachments in Quick Look, which draws HTML and CSS but
never runs scripts. The app paints every pixel from JS, so in those viewers
it showed a blank page. The preview therefore pre-renders everything to
flat markup: one scrolling document, anchor-link navigation, `<details>`
for the battlecards, and inline SVG for the charts.

It is built by loading the real `index.html` in headless Chromium and
calling the app's own view functions and `KB`, so the preview cannot drift
from the app. Building requires Playwright.

What the preview changes, and says on screen that it changes:

- A banner stating it is a review copy where nothing is saved, and that two
  things are simulated.
- All intel is **example data**, marked with an `example data` label on
  every table and list that carries it.
- The agent section shows a hand-written worked exchange, explicitly
  labelled as an illustration rather than a recorded answer.
- The deal calculator shows its worked figures plus the four assumptions as
  a static list, noting that the live version recalculates as you type.
- A **Feedback** section listing what to comment on, asking reviewers to
  reply to the email they got it in.

Fonts come from Google Fonts over the network. Online, colleagues get
Archivo and IBM Plex; offline, behind a blocking proxy, or in a previewer
that does not fetch remote CSS, it falls back to system faces and still
holds together.

## Design notes

- Chart colours were validated for colour-vision deficiency separation in both
  light and dark themes rather than picked by eye. The identity hues are
  `#0091A0` / `#C1502E` / `#3F6FB5` in light, re-stepped for dark, with a
  recessive neutral reserved for "other".
- Semantic colours (good / warning / critical) are kept separate from the
  accent and are never reused as a series colour.
- Every colour is a token defined on bare `:root`, redefined for
  `prefers-color-scheme: dark` and for an explicit `data-theme="dark"`, so the
  page holds up in all three viewer theme states.

## Reference

[`reference/BotissCIWorkspace.jsx`](reference/BotissCIWorkspace.jsx) is the
earlier React version of this workspace, kept for provenance. It is superseded
by `index.html` and is not built or deployed.
