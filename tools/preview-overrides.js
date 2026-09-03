/* =====================================================================
   Preview build overrides.
   Appended after the app's own script in the standalone file. The app is
   untouched; this layer only adapts it to a browser with no Claude
   runtime behind it:
     - labels the copy as a preview, everywhere
     - fills the tables with clearly-marked example intel
     - replaces the live agent with a worked example
     - makes CSV export use a plain browser download
     - adds a Feedback tab so reviewers can send notes back
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- 1. Example intel, so no table is empty --------------- */

  /* Store.connect() finishes on a microtask, i.e. after this script, and
     would reload from localStorage over the top of the examples. Disable
     that read so every open of the preview starts from the same state. */
  Store._loadLocal = function () {};

  const EX = "EXAMPLE ROW — replace with a real quote";

  Store.data.prices = [
    { id:"x1", product:"cerabone 1.0 cc", category:"Xenograft", brand:"botiss",
      country:"Germany", pack:"1.0 cc", price:"128", currency:"EUR",
      source:EX + " (rep quote)", rep:"Rep · Munich", via:"manual", ts:Date.now() - 36e5 * 5 },
    { id:"x2", product:"Bio-Oss small granules", category:"Xenograft", brand:"Geistlich",
      country:"Germany", pack:"0.5 g", price:"171", currency:"EUR",
      source:EX + " (distributor quote seen at account)", rep:"Rep · Munich", via:"manual", ts:Date.now() - 36e5 * 29 },
    { id:"x3", product:"Gen-Os 0.5 g", category:"Xenograft", brand:"OsteoBiol",
      country:"Italy", pack:"0.5 g", price:"74", currency:"EUR",
      source:EX + " (tender)", rep:"KAM · Milan", via:"agent", ts:Date.now() - 36e5 * 50 },
    { id:"x4", product:"Jason membrane 20×30", category:"Membrane", brand:"botiss",
      country:"Spain", pack:"20×30 mm", price:"115", currency:"EUR",
      source:EX + " (GPO contract)", rep:"KAM · Madrid", via:"manual", ts:Date.now() - 36e5 * 76 }
  ];

  Store.data.notes = [
    { id:"n1", topic:"Example: “Bio-Oss or nothing” at a Munich practice",
      body:"Periodontist would not consider an alternative xenograft for aesthetic cases. Opened up when we demonstrated +HyA handling chairside. Lost the routine volume, kept the door open for full-arch.",
      competitor:"Geistlich", rep:"Rep · Munich", via:"manual", ts:Date.now() - 36e5 * 30 },
    { id:"n2", topic:"Example: Osstem bundling implants plus graft",
      body:"Clinic quoted a package where the graft was effectively free with implants. Countered on cost per outcome and the soft-tissue range they cannot supply.",
      competitor:"Korean value tier", rep:"KAM · Milan", via:"agent", ts:Date.now() - 36e5 * 60 }
  ];

  Store.data.learned = [
    { id:"l1", title:"Example: Geistlich pushing Bio-Oss Collagen 50 mg for small defects",
      body:"Being positioned specifically against single-socket cases where our granule packs look oversized. Counter with collacone plus a small cerabone pack.",
      tags:["geistlich","socket"], rep:"Rep · Munich", via:"agent", ts:Date.now() - 36e5 * 8 },
    { id:"l2", title:"Example: MEA accounts asking about bovine origin, not just porcine",
      body:"Two Gulf accounts asked for animal-free regardless of species. maxresorb answered it; worth leading with synthetic there rather than explaining cerabone processing first.",
      tags:["mea","maxresorb"], rep:"KAM · Madrid", via:"manual", ts:Date.now() - 36e5 * 120 }
  ];

  /* ---------- 2. Preview labelling --------------------------------- */

  const origPaintPills = paintPills;
  paintPills = function () {
    origPaintPills();
    const m = document.getElementById("modePill");
    if (m) {
      m.innerHTML = '<span class="led"></span>Preview';
      m.className = "pill solo";
      m.title = "Static preview copy — nothing here is saved or shared";
    }
  };

  function banner() {
    return '' +
    '<div class="notice info" style="margin-bottom:16px">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>' +
        '<path d="M12 11v5.5"/><path d="M12 7.7v.4"/></svg>' +
      '<div><strong>Preview copy — for review, not for use.</strong> ' +
      'This is a single file running on its own in your browser. The intel in the tables is ' +
      '<strong>example data</strong>, the agent tab shows a worked example instead of answering live, ' +
      'and nothing you type is saved or sent anywhere. ' +
      'The real version shares intel across the team and answers for real. ' +
      '<button data-tab="feedback" style="background:none;border:none;padding:0;font:inherit;' +
      'color:inherit;font-weight:600;text-decoration:underline;cursor:pointer">' +
      'Tell us what to change →</button></div>' +
    '</div>';
  }

  const origRender = render;
  render = function (scrollTop) {
    origRender(scrollTop);
    const host = document.getElementById("view");
    if (host) host.insertAdjacentHTML("afterbegin", banner());
  };

  /* ---------- 3. The agent tab becomes a worked example ------------ */

  let picked = "";

  const EXAMPLE = [
    { who:"me", text:"A perio in Munich says “we always use Bio-Oss, why would I switch?” What do I say?" },
    { who:"sys", text:"pulled the Geistlich Pharma profile" },
    { who:"bot", text:
"Don't fight the evidence base, move the ground to handling and range. Bio-Oss has ~30 years of data and you will not win that argument in the chair.\n\n" +
"• Concede the point once, then reframe: \"Bio-Oss is the reference, and cerabone is a phase-pure sintered HA with the same volume stability at materially better value per case.\"\n" +
"• Demonstrate +HyA. Sticky-graft handling is something they can feel chairside in two minutes; base Bio-Oss has no equivalent.\n" +
"• Ask what they do when they need human allograft. Geistlich has no answer there — maxgraft means they stop running two suppliers.\n" +
"• Price the whole case, not the granule: graft plus membrane plus fixation. Their Bio-Oss plus Bio-Gide basket is where the gap shows.\n" +
"• If they do complex reconstruction, lead with bonebuilder against Yxoss: milled allograft, no titanium to remove, no second surgery.\n\n" +
"Worth verifying before you quote: the local Bio-Oss price at this account. The team has one Munich figure logged (171 EUR / 0.5 g) but it is a distributor quote, not channel price." },
    { who:"me", text:"Good. Also — Geistlich quoted 158 for the 0.5g at Dr Weber last Thursday, cash discount included." },
    { who:"sys", text:"logged a price point: Bio-Oss 0.5 g 158" },
    { who:"bot", text:
"Saved to the team store as a Geistlich price point for Germany, 0.5 g at 158 EUR, sourced to your visit at Dr Weber, with the cash discount noted.\n\n" +
"That is 13 EUR below the Munich figure already on file, so the local floor is softer than we thought. Two things follow:\n\n" +
"• Your cerabone 1.0 cc at 128 EUR is still the stronger cost-per-case story once membrane is in the basket.\n" +
"• Worth flagging to the DACH team — if Geistlich is discounting for cash at practice level, other accounts will have heard the same number." }
  ];

  renderChat = function () {
    const host = document.getElementById("chat");
    if (!host) return;

    const bubbles = EXAMPLE.map(m =>
      m.who === "sys"
        ? '<div class="msg sys">' + esc(m.text) + '</div>'
        : '<div class="msg ' + (m.who === "me" ? "me" : "bot") + '">' + esc(m.text) + '</div>'
    ).join("");

    host.innerHTML =
      '<div class="notice">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>' +
          '<path d="M12 11v5.5"/><path d="M12 7.7v.4"/></svg>' +
        '<div><strong>This preview cannot reach Claude.</strong> The exchange below was written by hand to ' +
        'show the shape of what the agent does — it is an illustration, not a recorded answer. ' +
        'In the real version it answers your own questions from the briefing plus whatever the team has ' +
        'logged, and it writes new intel back for everyone (the two grey lines are it using its tools).</div>' +
      '</div>' +
      (picked
        ? '<div class="panel" style="margin-top:12px;background:var(--teal-wash);border-color:var(--teal-line)">' +
            '<div class="label" style="color:var(--teal-deep)">You tapped</div>' +
            '<p style="font-size:14px;color:var(--teal-deep);margin-top:6px">' + esc(picked) + '</p>' +
            '<p style="font-size:12px;color:var(--teal-deep);margin-top:8px;opacity:.85">' +
            'The live app would answer this one. Here is the kind of answer it gives:</p>' +
          '</div>'
        : "") +
      '<div class="transcript" style="margin-top:12px">' + bubbles + '</div>' +
      '<div class="composer">' +
        '<textarea rows="1" placeholder="Asking is disabled in the preview copy" disabled></textarea>' +
        '<button class="btn" disabled title="Live version only">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:15px;height:15px;stroke:currentColor;' +
          'fill:none;stroke-width:1.8"><path d="M4.5 12h15"/><path d="M13.5 6l6 6-6 6"/></svg></button>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end">' +
        '<button class="btn sm" data-tab="feedback">Suggest a change to this</button></div>';
  };

  /* Tapping an example question should not pretend to ask it. */
  document.addEventListener("click", e => {
    const j = e.target.closest("[data-jump],[data-ask]");
    if (!j) return;
    e.preventDefault();
    e.stopPropagation();
    picked = j.dataset.jump || j.dataset.ask || "";
    tabTo("ask");
  }, true);

  /* CSV export without the downloads capability: a plain browser download. */
  document.addEventListener("click", e => {
    const b = e.target.closest("#p_export");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const rows = Store.data.prices;
    const cols = ["product","category","brand","country","pack","price","currency","source","rep","via"];
    const cell = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const csv = [cols.concat("logged").join(",")]
      .concat(rows.map(r => cols.map(c => cell(r[c]))
        .concat(cell(new Date(r.ts || Date.now()).toISOString().slice(0, 10))).join(",")))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type:"text/csv" }));
    a.download = "botiss-price-intel-example.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    flash("p_msg", "Exported the example rows. In the real app this exports what the team logged.", "info");
  }, true);

  /* ---------- 4. Feedback tab -------------------------------------- */

  const PROMPTS = [
    "Which tab would you actually open in front of a customer?",
    "What is missing from the battlecards?",
    "Is anything here wrong, out of date, or overstated?",
    "What would you ask the agent first?",
    "What would stop you using this day to day?"
  ];

  function viewFeedback() {
    return head("Feedback", "Tell us what to change",
      "This is a first cut, built to be argued with. Nothing here is fixed — the content, the tabs and the wording are all cheap to change.") +
    '<div class="stack">' +
      '<div class="panel">' +
        '<div class="panel-head"><h2>Worth commenting on</h2></div>' +
        '<ul class="tight" style="font-size:13.5px">' +
          PROMPTS.map(p => '<li>' + esc(p) + '</li>').join("") +
        '</ul>' +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel-head"><h2>Your notes</h2>' +
          '<span class="hint">stays in your browser until you send it</span></div>' +
        '<div style="display:grid;gap:11px">' +
          '<div><label class="fld" for="fb_who">Your name</label>' +
            '<input id="fb_who" placeholder="so we know whose note this is"></div>' +
          '<div><label class="fld" for="fb_body">What should change</label>' +
            '<textarea id="fb_body" style="min-height:150px" ' +
            'placeholder="Be blunt. Wrong figures, missing rivals, tabs you would never open, wording that would embarrass you in front of a clinician."></textarea></div>' +
        '</div>' +
        '<div style="display:flex;gap:9px;margin-top:13px;flex-wrap:wrap">' +
          '<button class="btn primary" id="fb_mail">Open in email</button>' +
          '<button class="btn" id="fb_copy">Copy my notes</button>' +
        '</div>' +
        '<div id="fb_msg" style="margin-top:10px" hidden></div>' +
      '</div>' +
      '<div class="notice info">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>' +
          '<path d="M12 11v5.5"/><path d="M12 7.7v.4"/></svg>' +
        '<div>This file has no way to send anything by itself. <strong>Open in email</strong> starts a ' +
        'draft in your mail app with your notes already in it — you choose who it goes to. ' +
        '<strong>Copy my notes</strong> puts the text on your clipboard for Teams or WhatsApp.</div>' +
      '</div>' +
    '</div>';
  }

  function notesText() {
    const who = document.getElementById("fb_who")?.value.trim() || "(no name given)";
    const body = document.getElementById("fb_body")?.value.trim() || "";
    return "botiss CI Desk — preview feedback\nFrom: " + who + "\n\n" + body + "\n";
  }

  document.addEventListener("click", async e => {
    const t = e.target.closest("#fb_mail,#fb_copy");
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();

    const body = document.getElementById("fb_body")?.value.trim() || "";
    if (!body) { flash("fb_msg", "Write a note first, then send it.", "bad"); return; }
    const text = notesText();

    if (t.id === "fb_mail") {
      /* No recipient on purpose: your mail app asks who it goes to. */
      const url = "mailto:?subject=" + encodeURIComponent("botiss CI Desk — preview feedback") +
                  "&body=" + encodeURIComponent(text.slice(0, 1600));
      window.location.href = url;
      flash("fb_msg", body.length > 1600
        ? "Draft opened, but long notes get cut by email links — use Copy my notes instead."
        : "Draft opened in your mail app. Add the recipient and send.", "info");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      flash("fb_msg", "Copied. Paste it wherever suits you.", "info");
    } catch {
      const ta = document.getElementById("fb_body");
      ta?.focus(); ta?.select();
      flash("fb_msg", "Your browser blocked the clipboard here — the text is selected, press Ctrl+C (or Cmd+C).", "bad");
    }
  }, true);

  /* ---------- 5. Wire it in ---------------------------------------- */

  NAV.push({ id:"feedback", label:"Feedback", icon:"ask" });
  VIEWS.feedback = viewFeedback;

  /* Kept for the banner link and the example-question handler. */
  function tabTo(id) {
    const btn = document.querySelector('.navbtn[data-tab="' + id + '"]');
    if (btn) btn.click();
  }

  Agent.send = function () {};          /* nothing fake ever gets asked */
  Agent.done = true;
  Store.problem = null;

  paintPills();
  render();
})();
