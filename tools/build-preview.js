#!/usr/bin/env node
/* Builds dist/botiss-CI-Desk-preview.html — a standalone review copy that
   needs NO JavaScript.

   Why no JavaScript: a forwarded .html file is usually opened in a preview
   surface, not a full browser. iOS Mail and the Files app render .html
   attachments in Quick Look, which draws HTML and CSS but never runs
   scripts. The app itself paints every pixel from JS, so in those viewers
   it shows a blank page. This build pre-renders the whole thing to flat
   markup instead: one long scrolling document, anchor-link navigation,
   <details> for the battlecards, and inline SVG charts. Nothing here
   depends on a script running, a network call, or a login.

   It is rendered by loading the real app in a headless browser and calling
   the app's own view functions, so the preview cannot drift from the app.

   Usage: node tools/build-preview.js
*/

const fs = require("fs");
const path = require("path");
const pw = require("/opt/node22/lib/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "index.html"), "utf8");

const title = (app.match(/<title>[\s\S]*?<\/title>/i) || ["<title>botiss CI Desk</title>"])[0];
const fontLink = (app.match(/<link[^>]*fonts\.googleapis\.com[^>]*>/i) || [""])[0];
const appCss = (app.match(/<style>([\s\S]*?)<\/style>/i) || ["", ""])[1];

/* Static-preview layout: the app's own tokens and components, re-laid-out
   as a document rather than a tabbed shell. */
const previewCss = `
/* ---------- static preview shell ---------- */
.pv-head{padding:16px 16px 14px; background:var(--surface); border-bottom:1px solid var(--line)}
.pv-head .wordmark{font-size:18px}
.pv-head .sub{font-size:12.5px; color:var(--ink-3); margin-top:5px; max-width:64ch}
.pv-head .badges{display:flex; gap:7px; flex-wrap:wrap; margin-top:11px}

.toc{position:sticky; top:0; z-index:30; display:flex; gap:6px; overflow-x:auto;
  padding:9px 16px; background:var(--ground); border-bottom:1px solid var(--line);
  scrollbar-width:none; -webkit-overflow-scrolling:touch}
.toc::-webkit-scrollbar{display:none}
.toc a{flex:0 0 auto; font-size:12.5px; font-weight:500; color:var(--ink-2);
  text-decoration:none; padding:6px 11px; border-radius:999px; background:var(--surface);
  border:1px solid var(--line); white-space:nowrap}
.toc a:hover{border-color:var(--ink-3)}

.doc{max-width:940px; margin:0 auto; padding:0 16px 72px}
.sec{padding-top:28px; scroll-margin-top:58px}
.sec + .sec{margin-top:32px; border-top:1px solid var(--line)}
.pv-foot{max-width:940px; margin:0 auto; padding:26px 16px 60px; border-top:1px solid var(--line);
  font-size:11.5px; color:var(--ink-3); line-height:1.6}

/* battlecards without script: native disclosure */
details.rival > summary{cursor:pointer; list-style:none; padding:14px 15px; display:flex;
  gap:12px; align-items:flex-start}
details.rival > summary::-webkit-details-marker{display:none}
details.rival > summary::marker{content:""}
details.rival .caret{margin-left:auto; flex-shrink:0; color:var(--ink-3)}
details.rival[open] .caret{transform:rotate(180deg)}
details.rival .caret svg{width:17px; height:17px; stroke:currentColor; fill:none;
  stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round}

/* the sample-data marker, so no figure here is mistaken for a real one */
.exlabel{font-family:var(--f-mono); font-size:9.5px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--warn); background:var(--warn-wash); padding:2px 6px; border-radius:4px;
  white-space:nowrap}
.assume{display:grid; gap:9px; margin-top:4px}
.assume > div{display:flex; justify-content:space-between; gap:14px; padding:9px 0;
  border-bottom:1px solid var(--line-soft); font-size:13.5px}
.assume > div:last-child{border-bottom:none}
.assume .v{font-family:var(--f-mono); font-weight:500; white-space:nowrap}
@media print{.toc{display:none} .sec{break-inside:avoid}}
`;

/* Everything below runs inside the loaded app, where KB and the view
   functions live. It returns the finished document body. */
function buildInPage() {
  const S = (id, inner) => '<section class="sec" id="' + id + '">' + inner + '</section>';

  /* ---- the agent, shown as a worked example ---- */
  const EXAMPLE = [
    ["me", "A perio in Munich says “we always use Bio-Oss, why would I switch?” What do I say?"],
    ["sys", "pulled the Geistlich Pharma profile"],
    ["bot",
"Don't fight the evidence base, move the ground to handling and range. Bio-Oss has ~30 years of data and you will not win that argument in the chair.\n\n" +
"• Concede the point once, then reframe: \"Bio-Oss is the reference, and cerabone is a phase-pure sintered HA with the same volume stability at materially better value per case.\"\n" +
"• Demonstrate +HyA. Sticky-graft handling is something they can feel chairside in two minutes; base Bio-Oss has no equivalent.\n" +
"• Ask what they do when they need human allograft. Geistlich has no answer there — maxgraft means they stop running two suppliers.\n" +
"• Price the whole case, not the granule: graft plus membrane plus fixation. Their Bio-Oss plus Bio-Gide basket is where the gap shows.\n" +
"• If they do complex reconstruction, lead with bonebuilder against Yxoss: milled allograft, no titanium to remove, no second surgery."],
    ["me", "Good. Also — Geistlich quoted 158 for the 0.5 g at Dr Weber last Thursday, cash discount included."],
    ["sys", "logged a price point: Bio-Oss 0.5 g 158"],
    ["bot",
"Saved to the team store as a Geistlich price point for Germany, 0.5 g at 158 EUR, sourced to your visit at Dr Weber, with the cash discount noted.\n\n" +
"That is below the Munich figure already on file, so the local floor is softer than we thought. Two things follow:\n\n" +
"• Your cerabone cost-per-case story is still the stronger one once membrane is in the basket.\n" +
"• Worth flagging to the DACH team — if Geistlich is discounting for cash at practice level, other accounts will have heard the same number."]
  ];

  /* ---- example team intel, clearly marked ---- */
  const EX_PRICES = [
    ["cerabone 1.0 cc", "botiss", "Germany", "1.0 cc", "128 EUR", "rep quote", "Rep · Munich"],
    ["Bio-Oss small granules", "Geistlich", "Germany", "0.5 g", "171 EUR", "distributor quote at account", "Rep · Munich"],
    ["Gen-Os 0.5 g", "OsteoBiol", "Italy", "0.5 g", "74 EUR", "tender", "KAM · Milan"],
    ["Jason membrane 20×30", "botiss", "Spain", "20×30 mm", "115 EUR", "GPO contract", "KAM · Madrid"]
  ];
  const EX_LEARNED = [
    ["Geistlich pushing Bio-Oss Collagen 50 mg for small defects",
     "Being positioned specifically against single-socket cases where our granule packs look oversized. Counter with collacone plus a small cerabone pack.",
     "Rep · Munich"],
    ["MEA accounts asking about bovine origin, not just porcine",
     "Two Gulf accounts asked for animal-free regardless of species. maxresorb answered it; worth leading with synthetic there rather than explaining cerabone processing first.",
     "KAM · Madrid"]
  ];
  const EX_NOTES = [
    ["“Bio-Oss or nothing” at a Munich practice",
     "Periodontist would not consider an alternative xenograft for aesthetic cases. Opened up when we demonstrated +HyA handling chairside. Lost the routine volume, kept the door open for full-arch.",
     "Geistlich"],
    ["Osstem bundling implants plus graft",
     "Clinic quoted a package where the graft was effectively free with implants. Countered on cost per outcome and the soft-tissue range they cannot supply.",
     "Korean value tier"]
  ];

  const banner =
    '<div class="notice info" style="margin-top:22px">' + svg("info") +
      '<div><strong>Preview copy — for review, not for use.</strong> This is one file with no login ' +
      'behind it, so two things are simulated and labelled as such: all intel shown is ' +
      '<strong>example data</strong>, and the agent below is a <strong>worked example</strong> rather ' +
      'than a live answer. Everything else is the real thing. In the working version the agent answers ' +
      'your own questions and the whole team shares one live pool of intel.</div>' +
    '</div>';

  /* ---- 1. Desk ---- */
  const desk = S("desk",
    head("Field desk", "Where botiss stands today",
      "Geistlich leads on legacy and evidence. botiss competes on portfolio breadth, modern handling, human allograft and the Straumann ecosystem — never on being cheapest.") +
    '<div class="stack">' +
      '<div class="figs">' + KB.figures.map(f =>
        '<div class="fig' + (f.tone ? " " + f.tone : "") + '">' +
          '<div class="v">' + esc(f.v) + '</div>' +
          '<div class="k">' + esc(f.k) + '</div>' +
          '<div class="s">' + esc(f.s) + '</div></div>').join("") +
      '</div>' +
      positioningChart() +
      shareChart() +
      '<div class="panel"><div class="panel-head"><h2>The edge, and the pressure</h2></div>' +
        '<div class="swot">' +
          '<div class="s"><h4>botiss edge</h4><ul class="tight">' +
            '<li>Widest single-vendor range: xeno, allograft, synthetic, membranes, soft tissue, custom blocks, magnesium fixation.</li>' +
            '<li>+HyA sticky-graft handling and NOVAMag magnesium are genuinely modern differentiators.</li>' +
            '<li>maxgraft human allograft — a whole category Geistlich does not field.</li>' +
            '<li>Straumann backing: ecosystem bundle plus distribution across Europe and the Americas.</li>' +
          '</ul></div>' +
          '<div class="w"><h4>Pressure points</h4><ul class="tight">' +
            '<li>Geistlich\'s evidence and brand pull keep Bio-Oss the default specification.</li>' +
            '<li>Korean and EU value players compress xenograft and membrane pricing, often implant-bundled.</li>' +
            '<li>Bio-Gide leads resorbable membranes; Cytoplast leads non-resorbable.</li>' +
            '<li>The US market was cautious in 2025, and FDA or Health Canada pathways slow new formats.</li>' +
          '</ul></div>' +
        '</div>' +
      '</div>' +
    '</div>');

  /* ---- 2. Ask ---- */
  const ask = S("ask",
    head("The agent", "Your competitive intelligence, on call",
      "In the working version this answers your own questions from the briefing plus everything the team has logged, and writes new intel back for everyone. It runs on each person's own Claude account.") +
    '<div class="notice">' + svg("info") +
      '<div><strong>The exchange below was written by hand to show the shape of it.</strong> ' +
      'It is an illustration, not a recorded answer — a file like this cannot reach Claude. ' +
      'The two grey lines are the agent using its tools: reading the stored profiles, and writing ' +
      'a new price into the team\'s pool mid-conversation.</div></div>' +
    '<div class="transcript" style="margin-top:14px">' +
      EXAMPLE.map(([who, text]) => who === "sys"
        ? '<div class="msg sys">' + esc(text) + '</div>'
        : '<div class="msg ' + (who === "me" ? "me" : "bot") + '">' + esc(text) + '</div>').join("") +
    '</div>');

  /* ---- 3. Rivals, as native disclosures ---- */
  const rivals = S("rivals",
    head("Battlecards", "Who botiss is up against",
      "Eight profiles: the global leader, the US-strong majors, the membrane specialist, the EU mid-tier, the Korean volume players and the synthetic niche. Tap one to open it.") +
    '<div class="stack">' + KB.rivals.map((r, i) =>
      '<details class="rival' + (r.lead ? " lead" : "") + '"' + (i === 0 ? " open" : "") + '>' +
        '<summary>' +
          '<span class="stripe" style="background:' + KIND_COLOR[r.kind] + '"></span>' +
          '<span style="flex:1;min-width:0">' +
            '<span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
              '<span class="rname">' + esc(r.name) + '</span>' +
              (r.lead ? '<span class="chip threat">Lead threat</span>' : "") +
              '<span class="chip">' + esc(r.tier) + '</span>' +
            '</span>' +
            '<span class="hq" style="display:block;margin-top:3px">' + esc(r.hq) + '</span>' +
            '<span class="oneline" style="display:block">' + esc(r.line) + '</span>' +
          '</span>' +
          '<span class="caret">' + svg("down") + '</span>' +
        '</summary>' +
        '<div class="rival-body">' +
          '<div><div class="label" style="margin-bottom:7px">Key products</div>' +
            '<div class="chiprow">' + r.products.map(p => '<span class="chip">' + esc(p) + '</span>').join("") + '</div></div>' +
          '<div><div class="label" style="margin-bottom:7px">Recent moves</div>' +
            '<ul class="tight">' + r.moves.map(m => '<li>' + esc(m) + '</li>').join("") + '</ul></div>' +
          '<div class="swot">' +
            '<div class="s"><h4>Strengths</h4><ul class="tight">' +
              r.strengths.map(s => '<li>' + esc(s) + '</li>').join("") + '</ul></div>' +
            '<div class="w"><h4>Where to push</h4><ul class="tight">' +
              r.weaknesses.map(s => '<li>' + esc(s) + '</li>').join("") + '</ul></div>' +
          '</div>' +
        '</div>' +
      '</details>').join("") + '</div>');

  /* ---- 4-5. Plays and products, straight from the app ---- */
  const plays = S("plays", viewPlays());
  const products = S("products", viewProducts());

  /* ---- 6. Prices ---- */
  const prices = S("prices",
    head("Price intel", "The prices your team actually verified",
      "Nothing in this market is list-priced — it is quote-based and swings with country, distributor margin, tender and reimbursement. What the team confirms is kept apart from grey-market orientation.") +
    '<div class="stack">' +
      '<div class="panel">' +
        '<div class="panel-head"><h2>Team-verified</h2><span class="exlabel">example data</span></div>' +
        '<div class="scroller"><table>' +
          '<thead><tr><th>Product</th><th>Brand</th><th>Country</th><th>Pack</th><th>Price</th><th>Source</th><th>Logged by</th></tr></thead>' +
          '<tbody>' + EX_PRICES.map(r =>
            '<tr><td style="font-weight:600;min-width:130px">' + esc(r[0]) + '</td>' +
            '<td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td>' +
            '<td class="num">' + esc(r[3]) + '</td>' +
            '<td class="num" style="font-weight:600;white-space:nowrap">' + esc(r[4]) + '</td>' +
            '<td class="mutedcell">' + esc(r[5]) + '</td>' +
            '<td class="mutedcell" style="white-space:nowrap">' + esc(r[6]) + '</td></tr>').join("") +
          '</tbody></table></div>' +
        '<p style="font-size:12px;color:var(--ink-3);margin-top:12px">In the working version anyone ' +
        'adds a row in about fifteen seconds — product, pack, price, who quoted it — and it appears ' +
        'for the whole team at once. It exports to CSV, and the agent reads it before answering any ' +
        'price question.</p>' +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel-head"><h2>Reference anchors</h2><span class="hint">orientation only</span></div>' +
        '<div class="notice">' + svg("info") +
          '<div><strong>Not official prices.</strong> Manufacturers publish no list prices, distributors ' +
          'say "contact for quote", and the public listings that exist are reseller or grey-market — they ' +
          'vary two to threefold by country and margin. Replace them with what your team confirms.</div></div>' +
        '<div class="scroller" style="margin-top:12px"><table>' +
          '<thead><tr><th>Product</th><th>Brand</th><th>Country</th><th>Pack</th><th>Indicative</th><th>Basis</th></tr></thead>' +
          '<tbody>' + KB.anchors.map(a =>
            '<tr><td style="min-width:150px">' + esc(a.product) + '</td>' +
            '<td style="min-width:110px">' + esc(a.brand) + '</td><td>' + esc(a.country) + '</td>' +
            '<td class="num">' + esc(a.pack) + '</td>' +
            '<td class="num" style="white-space:nowrap;color:var(--warn);font-weight:600">' + esc(a.price) + '</td>' +
            '<td class="mutedcell">' + esc(a.source) + '</td></tr>').join("") +
          '</tbody></table></div>' +
      '</div>' +
    '</div>');

  /* ---- 7. Markets ---- */
  const markets = S("markets", viewMarkets());

  /* ---- 8. Deal maths ---- */
  const d = dealNumbers();
  const big = "font-family:var(--f-disp);font-size:21px;font-weight:600;color:var(--invert-fg)";
  const dealSec = S("deal",
    head("Deal maths", "Price the attach rate, not the granule",
      "About half of implant procedures need grafting, yet many accounts graft far less. This is the number that moves a conversation away from cost per cc.") +
    '<div class="stack">' +
      '<div class="panel" style="background:var(--invert-bg);border:none">' +
        '<div class="label" style="color:var(--invert-muted)">Incremental revenue, one account</div>' +
        '<div style="font-family:var(--f-disp);font-size:clamp(34px,10vw,50px);font-weight:600;' +
          'letter-spacing:-.03em;color:var(--invert-fg);line-height:1.05;margin-top:6px">' + fmtInt(d.yearly) + '</div>' +
        '<div style="font-size:13px;color:var(--invert-muted);margin-top:4px">per year, from lifting attach rate alone</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:14px;' +
          'margin-top:18px;padding-top:16px;border-top:1px solid color-mix(in srgb, var(--invert-fg) 18%, transparent)">' +
          [[fmtInt(d.monthly), "per month"],
           ["+" + d.inc.toFixed(1), "extra cases / month"],
           [d.casesNow.toFixed(0), "grafted now"],
           [d.casesTgt.toFixed(0), "grafted at target"]].map(([v, k]) =>
            '<div><div style="' + big + '">' + v + '</div>' +
            '<div style="font-size:11px;color:var(--invert-muted);margin-top:2px">' + k + '</div></div>').join("") +
        '</div>' +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel-head"><h2>Worked on these assumptions</h2><span class="exlabel">example account</span></div>' +
        '<div class="assume">' +
          '<div><span>Implants placed per month</span><span class="v">' + deal.implants + '</span></div>' +
          '<div><span>Graft attach rate now</span><span class="v">' + deal.now + '%</span></div>' +
          '<div><span>Target graft attach rate</span><span class="v">' + deal.target + '%</span></div>' +
          '<div><span>botiss revenue per grafted case</span><span class="v">' + deal.rev + '</span></div>' +
        '</div>' +
        '<p style="font-size:12px;color:var(--ink-3);margin-top:12px">In the working version these are ' +
        'four fields and the figures above rewrite themselves as you type, in front of the customer. ' +
        'Revenue per case means graft plus membrane plus soft tissue plus fixation you would realistically ' +
        'supply, in your own currency.</p>' +
      '</div>' +
      '<div class="notice info">' + svg("info") +
        '<div>Use this against a price objection: a clinician haggling over a few euros per cc is usually ' +
        'leaving far more on the table by under-grafting. Attach rate and full-case supply grow the ' +
        'account; discounting the graft does not.</div></div>' +
    '</div>');

  /* ---- 9. Learned ---- */
  const learned = S("learned",
    head("Learned", "What the desk knows because someone told it",
      "This is the part that gets better with use. Anything logged here is folded into the agent's briefing, so an answer today reflects what a colleague logged this morning.") +
    '<div class="stack">' +
      '<div class="panel">' +
        '<div class="panel-head"><h2>Durable learnings</h2><span class="exlabel">example data</span></div>' +
        EX_LEARNED.map(([t, b, who]) =>
          '<div class="feeditem"><div class="badge chip good">LRN</div><div class="body">' +
            '<div class="t">' + esc(t) + '</div><p>' + esc(b) + '</p>' +
            '<div class="meta">' + esc(who) + ' · saved by the agent</div></div></div>').join("") +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel-head"><h2>Field notes</h2><span class="exlabel">example data</span></div>' +
        EX_NOTES.map(([t, b, c]) =>
          '<div class="feeditem"><div class="badge chip warn">FLD</div><div class="body">' +
            '<div class="t">' + esc(t) + '</div><p>' + esc(b) + '</p>' +
            '<div class="meta">' + esc(c) + '</div></div></div>').join("") +
      '</div>' +
      '<div class="notice info">' + svg("info") +
        '<div>Objections heard, competitor sightings, win and loss reasons, a price someone quoted — ' +
        'either typed in directly or captured by telling the agent in passing. It is the same pool either way.</div></div>' +
    '</div>');

  /* ---- 10. Feedback ---- */
  const feedback = S("feedback",
    head("Feedback", "Tell us what to change",
      "This is a first cut, built to be argued with. The content, the sections and the wording are all cheap to change — the point of sending it round is to find out what is wrong with it.") +
    '<div class="stack">' +
      '<div class="panel">' +
        '<div class="panel-head"><h2>Worth commenting on</h2></div>' +
        '<ul class="tight" style="font-size:13.5px">' +
          '<li>Which section would you actually open in front of a customer?</li>' +
          '<li>What is missing from the battlecards, or plain wrong in them?</li>' +
          '<li>Is anything here out of date or overstated for your market?</li>' +
          '<li>What would you ask the agent first?</li>' +
          '<li>What would stop you using this day to day?</li>' +
          '<li>Which prices do you already know that should be in the pool?</li>' +
        '</ul>' +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel-head"><h2>How to send it</h2></div>' +
        '<p style="font-size:13.5px;color:var(--ink-2)">Just reply to the email this came in, ' +
        'quoting the section name. Blunt is more useful than polite: wrong figures, missing rivals, ' +
        'sections you would never open, wording that would embarrass you in front of a clinician.</p>' +
      '</div>' +
    '</div>');

  /* ---- 11. Method ---- */
  const method = S("method",
    head("Method", "Where this comes from, and what it cannot do",
      "A briefing aid assembled from public sources in " + KB.asOf + ". Verify anything client-facing against the primary source before it leaves your mouth.") +
    '<div class="stack">' +
      '<div class="panel"><div class="panel-head"><h2>How the working version differs from this file</h2></div>' +
        '<ul class="tight" style="font-size:13px">' +
          '<li>The agent answers live, on each person\'s own Claude account — the first question asks their permission, and it counts against their own usage rather than a shared key.</li>' +
          '<li>Intel is one shared live pool: a price logged in Milan is on a phone in Munich immediately.</li>' +
          '<li>It runs at a web address, so an update reaches everyone at once with nothing to reinstall.</li>' +
          '<li>It needs a Claude sign-in and organisation membership, which is exactly why this review copy exists instead.</li>' +
        '</ul>' +
      '</div>' +
      '<div class="panel"><div class="panel-head"><h2>Limits worth stating out loud</h2></div>' +
        '<ul class="tight" style="font-size:13px">' +
          '<li>Market sizes differ between analysts because the definitions differ — graft-only against graft plus membranes plus soft tissue. Ranges beat false precision.</li>' +
          '<li>Share splits here are <strong>synthesised estimates</strong>, not published figures. Brief with them; never quote them to a customer.</li>' +
          '<li>Prices are quote-based. The anchors above are grey-market orientation, not channel prices.</li>' +
          '<li>Every price, note and learning shown in this file is invented example data.</li>' +
          '<li>Nothing here is clinical, regulatory, legal or financial advice, and the agent can be wrong. Check before it reaches a clinician.</li>' +
        '</ul>' +
      '</div>' +
      '<div class="panel"><div class="panel-head"><h2>Sources</h2></div>' +
        KB.sources.map(s =>
          '<div class="feeditem"><div class="body">' +
            '<div class="t" style="font-size:13px">' + esc(s.t) + '</div>' +
            '<p style="margin-top:3px">' + esc(s.d) + '</p>' +
            '<div class="meta">' + esc(s.u) + '</div></div></div>').join("") +
      '</div>' +
    '</div>');

  const TOC = [["desk","Desk"],["ask","The agent"],["rivals","Battlecards"],["plays","Plays"],
    ["products","Products"],["prices","Prices"],["markets","Markets"],["deal","Deal maths"],
    ["learned","Learned"],["feedback","Feedback"],["method","Method"]];

  return '' +
  '<header class="pv-head">' +
    '<div class="wordmark">botiss <span>CI Desk</span></div>' +
    '<div class="sub">Competitive intelligence for the dental regenerative-biomaterials team — ' +
      'a review copy of a working app, sent round for comment.</div>' +
    '<div class="badges"><span class="chip warn">Preview · nothing saved</span>' +
      '<span class="chip">Figures researched ' + esc(KB.asOf) + '</span></div>' +
  '</header>' +
  '<nav class="toc" aria-label="Sections">' +
    TOC.map(([id, label]) => '<a href="#' + id + '">' + esc(label) + '</a>').join("") +
  '</nav>' +
  '<main class="doc">' + banner + desk + ask + rivals + plays + products + prices +
    markets + dealSec + learned + feedback + method + '</main>' +
  '<footer class="pv-foot">' +
    'botiss CI Desk — preview copy. Figures researched ' + esc(KB.asOf) +
    ' from iData Research, Mordor Intelligence and the Straumann Annual Report 2025. ' +
    'Share splits are estimates, not published figures. All prices, notes and learnings shown are ' +
    'example data. Prices in this market are quote-based. A briefing aid, not clinical, regulatory, ' +
    'legal or financial advice.' +
  '</footer>';
}

(async () => {
  const shell = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>[hidden]{display:none!important}</style></head><body>${app}</body></html>`;

  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.setContent(shell, { waitUntil: "load" });
  await page.waitForTimeout(400);
  if (errors.length) {
    console.error("the app threw while rendering:", errors);
    process.exit(1);
  }
  const body = await page.evaluate(buildInPage);
  await browser.close();

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
:root{color-scheme:light dark}
html{-webkit-text-size-adjust:100%}
img{max-width:100%}
[hidden]{display:none!important}
${appCss}
${previewCss}
</style>
</head>
<body>
${body}
</body>
</html>
`;

  const dir = path.join(root, "dist");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "botiss-CI-Desk-preview.html");
  fs.writeFileSync(file, out);

  const hasScript = /<script/i.test(out);
  console.log("wrote " + path.relative(root, file) +
    "  (" + (Buffer.byteLength(out) / 1024).toFixed(0) + " KB)");
  console.log("contains <script>: " + hasScript + (hasScript ? "  <-- must be false" : "  (renders with JS disabled)"));
  if (hasScript) process.exit(1);
})();
