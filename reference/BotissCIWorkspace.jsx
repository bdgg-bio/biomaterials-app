import React, { useState, useEffect, useMemo } from "react";
import {
  Activity, Target, Layers, Tag, Swords, Globe, Plus, Trash2, Calculator,
  ShieldAlert, Sparkles, ChevronDown, Info, ArrowUpRight,
  Search, BookOpen, Beaker
} from "lucide-react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RTooltip, LabelList,
  BarChart, Bar, Cell
} from "recharts";

/* =========================================================================
   botiss · Competitive Intelligence Desk
   A grounded CI workspace for the dental regenerative-biomaterials market.
   Landscape & figures researched June 2026 (iData, Mordor, Straumann AR2025).
   Pricing is quote-based in this market — see the Price intel methodology.
   ========================================================================= */

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;450;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root{
  --ink:#0E1419; --ink2:#2A3340; --muted:#647082;
  --paper:#F2F5F7; --surface:#FFFFFF; --line:#DCE3E9; --line2:#EAEFF3;
  --teal:#0B7A85; --teal-dk:#075A63; --teal-wash:#E3F0F1;
  --coral:#CF5238; --coral-wash:#FAE8E3;
  --bone:#ECE4D3; --amber:#B8842A; --amber-wash:#F8EFDB;
  --green:#3E7C59;
}
*{box-sizing:border-box}
.cici{font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--paper);
  min-height:100vh;-webkit-font-smoothing:antialiased;line-height:1.45}
.mono{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums}
.disp{font-family:'Space Grotesk',sans-serif}

.shell{display:flex;min-height:100vh}
.rail{width:232px;flex-shrink:0;background:var(--ink);color:#fff;position:sticky;top:0;
  height:100vh;display:flex;flex-direction:column;padding:22px 15px;overflow-y:auto}
.brandmark{display:flex;align-items:baseline;gap:8px;padding:6px 8px 8px}
.brandmark .b{font-family:'Space Grotesk';font-weight:700;font-size:21px;letter-spacing:-.02em}
.brandmark .sub{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#7F8C9B}
.railnote{font-size:10.5px;color:#67727F;padding:2px 8px 16px;line-height:1.5}
.navbtn{display:flex;align-items:center;gap:11px;width:100%;text-align:left;background:none;
  border:none;color:#9DA9B6;padding:9px 11px;border-radius:8px;cursor:pointer;font-size:13.5px;
  font-weight:500;transition:.15s;font-family:inherit;margin-bottom:2px}
.navbtn:hover{background:#1A222C;color:#E6ECF1}
.navbtn:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
.navbtn.on{background:var(--teal);color:#fff}
.navbtn.on svg{color:#fff}
.railfoot{margin-top:auto;font-size:10px;color:#5C6773;padding:14px 8px 4px;line-height:1.55;border-top:1px solid #232C36}

.main{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{padding:20px 34px 15px;border-bottom:1px solid var(--line);background:var(--surface);
  position:sticky;top:0;z-index:20}
.eyebrow{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--teal);font-weight:600}
.h1{font-family:'Space Grotesk';font-size:25px;font-weight:600;letter-spacing:-.02em;margin:3px 0 3px}
.lead{font-size:13px;color:var(--muted);max-width:720px}
.body{padding:26px 34px 80px;max-width:1200px}

.grid{display:grid;gap:14px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:18px}
.kicker{font-size:10.5px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:9px}
.stat{font-family:'Space Grotesk';font-weight:600;letter-spacing:-.02em}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:500;padding:3px 9px;
  border-radius:99px;border:1px solid var(--line);background:var(--surface)}
.chip.us{background:var(--teal-wash);border-color:#BFE0E2;color:var(--teal-dk)}
.chip.threat{background:var(--coral-wash);border-color:#F0CDC3;color:var(--coral)}
.chip.bone{background:var(--bone);border-color:#DECfB0;color:#6B5A2E}
.tag{font-size:10.5px;font-weight:500;color:var(--muted);background:var(--line2);padding:2px 7px;border-radius:5px;white-space:nowrap}
.divider{height:1px;background:var(--line);margin:16px 0}
.btn{font-family:inherit;font-size:13px;font-weight:550;border-radius:9px;cursor:pointer;
  border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:9px 14px;transition:.15s;
  display:inline-flex;align-items:center;gap:7px}
.btn:hover{border-color:#C2CDD6}
.btn:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
.btn.pri{background:var(--teal);border-color:var(--teal);color:#fff}
.btn.pri:hover{background:var(--teal-dk)}
.btn.ghost{background:none;border:none;color:var(--muted);padding:6px}
.btn.ghost:hover{color:var(--coral)}
input,select,textarea{font-family:inherit;font-size:13px;color:var(--ink);background:var(--surface);
  border:1px solid var(--line);border-radius:8px;padding:9px 11px;width:100%}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 3px var(--teal-wash)}
label.fld{display:block;font-size:11px;font-weight:600;color:var(--ink2);margin-bottom:5px}

.legendrow{display:flex;gap:16px;flex-wrap:wrap;font-size:11.5px;color:var(--muted);margin-top:8px}
.dot{width:9px;height:9px;border-radius:99px;display:inline-block;margin-right:6px;vertical-align:middle}

.compcard{background:var(--surface);border:1px solid var(--line);border-radius:13px;overflow:hidden}
.comphead{padding:16px 18px;display:flex;align-items:flex-start;gap:14px;cursor:pointer}
.comphead:focus-visible{outline:2px solid var(--teal);outline-offset:-2px}
.flagbar{width:4px;align-self:stretch;border-radius:99px;flex-shrink:0}
.compbody{padding:0 18px 18px;border-top:1px solid var(--line2)}
.swot{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
.swot h5{font-size:11px;letter-spacing:.07em;text-transform:uppercase;margin:0 0 6px;font-weight:600}
.swot ul{margin:0;padding-left:16px;font-size:12.3px;color:var(--ink2)}
.swot li{margin-bottom:4px}

.mtx{width:100%;border-collapse:collapse;font-size:12.5px}
.mtx th{text-align:left;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
  font-weight:600;padding:9px 12px;border-bottom:2px solid var(--line)}
.mtx td{padding:11px 12px;border-bottom:1px solid var(--line2);vertical-align:top}
.mtx tr:hover td{background:#FAFCFD}
.usprod{font-weight:600;color:var(--teal-dk)}

.ptable{width:100%;border-collapse:collapse;font-size:12.5px}
.ptable th{text-align:left;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);
  font-weight:600;padding:8px 10px;border-bottom:2px solid var(--line);white-space:nowrap}
.ptable td{padding:9px 10px;border-bottom:1px solid var(--line2);vertical-align:middle}

.note{background:#FFFBEF;border:1px solid #F0E4C0;border-radius:11px;padding:14px 16px;font-size:12.5px;color:#5E4F2A;display:flex;gap:11px;line-height:1.55}

.bc{border:1px solid var(--line);border-radius:13px;overflow:hidden;background:var(--surface)}
.bchead{padding:15px 18px;display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--line2)}
.move{display:flex;gap:11px;padding:11px 18px;border-bottom:1px solid var(--line2);font-size:13px}
.move:last-child{border-bottom:none}
.movenum{font-family:'Space Grotesk';font-weight:600;color:var(--teal);font-size:13px;flex-shrink:0;width:20px}

.srcitem{display:flex;gap:11px;padding:10px 0;border-bottom:1px solid var(--line2);font-size:12.5px}
.srcitem:last-child{border-bottom:none}

.mobtabs{display:none}
@media (max-width:880px){
  .rail{display:none}
  .mobtabs{display:flex;gap:4px;overflow-x:auto;padding:10px 14px;background:var(--ink);position:sticky;top:0;z-index:30}
  .mobtab{flex-shrink:0;color:#9DA9B6;background:none;border:none;font-family:inherit;font-size:12.5px;
    font-weight:550;padding:8px 12px;border-radius:8px;cursor:pointer;white-space:nowrap}
  .mobtab.on{background:var(--teal);color:#fff}
  .topbar{padding:16px 18px 12px} .body{padding:18px 18px 60px}
  .swot{grid-template-columns:1fr} .h1{font-size:20px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

/* ============================ DATA ============================ */

const NAV = [
  { id: "landscape", label: "Landscape", icon: Activity },
  { id: "competitors", label: "Competitors", icon: Target },
  { id: "products", label: "Product map", icon: Layers },
  { id: "prices", label: "Price intel", icon: Tag },
  { id: "playbook", label: "Sell-better playbook", icon: Swords },
  { id: "markets", label: "Markets", icon: Globe },
  { id: "calculator", label: "Deal calculator", icon: Calculator },
  { id: "sources", label: "Sources & method", icon: BookOpen },
];

// Positioning: x = relative price premium (1 low → 10 high), y = portfolio breadth (1→10), z ≈ share weight
const POSITION = [
  { name: "botiss / Straumann", x: 6.4, y: 9.4, z: 360, kind: "us" },
  { name: "Geistlich", x: 9.0, y: 7.6, z: 480, kind: "threat" },
  { name: "BioHorizons", x: 6.3, y: 7.2, z: 300, kind: "comp" },
  { name: "ZimVie", x: 6.5, y: 6.8, z: 260, kind: "comp" },
  { name: "Envista / Osteogenics", x: 6.9, y: 6.2, z: 250, kind: "comp" },
  { name: "Dentsply Symbios", x: 6.2, y: 6.4, z: 220, kind: "comp" },
  { name: "OsteoBiol (Tecnoss)", x: 4.6, y: 6.6, z: 190, kind: "comp" },
  { name: "Korea value (Dentium/Genoss)", x: 2.6, y: 5.6, z: 230, kind: "value" },
  { name: "Synthetics (Curasan/NovaBone)", x: 3.4, y: 4.4, z: 150, kind: "value" },
];

const SHARE = [
  { name: "Geistlich", v: 28, kind: "threat" },
  { name: "BioHorizons", v: 12, kind: "comp" },
  { name: "ZimVie", v: 10, kind: "comp" },
  { name: "Envista", v: 9, kind: "comp" },
  { name: "botiss/Straumann", v: 8, kind: "us" },
  { name: "Dentsply", v: 7, kind: "comp" },
  { name: "Korea value", v: 9, kind: "value" },
  { name: "Others / regional", v: 17, kind: "other" },
];

const COMPETITORS = [
  {
    name: "Geistlich Pharma", hq: "Wolhusen, Switzerland", tier: "Global market leader",
    color: "var(--coral)", threat: true,
    line: "The brand to beat. Bio-Oss is the de-facto clinical reference standard for xenografts; Bio-Gide leads collagen membranes. ~30 yrs of data and 1,000+ publications.",
    products: ["Bio-Oss (bovine xenograft)", "Bio-Oss Pen", "Bio-Oss Collagen (incl. new 50 mg)", "Bio-Gide / Compressed / Perio / Shape / Forte", "Mucograft / Mucograft Seal", "Fibro-Gide (volume-stable matrix)", "vallos / vallomix", "Yxoss CBR (custom Ti scaffold, via ReOss)"],
    moves: ["Acquired Bionnovation (Brazil) in 2024 — local manufacturing + a value tier", "Invested in ReOss in 2025 — patient-specific / custom regeneration (Yxoss)", "New membrane technology signalled for ~2026", "Expanding Bio-Oss Collagen formats for smaller defects"],
    str: ["~30 yrs of clinical data, 1,000+ publications — the evidence moat", "Brand equity: clinicians specify 'Bio-Oss' by name", "Strong KOL + education engine", "Now spans value (Bionnovation) and custom (ReOss)"],
    weak: ["Premium pricing — exposed where budgets tighten", "Historically xeno + membrane centric; no human allograft line", "Innovation is incremental, not disruptive", "Not an implant-ecosystem bundle like Straumann"],
  },
  {
    name: "Henry Schein / BioHorizons", hq: "USA (BioHorizons Camlog)", tier: "#2 in bone graft substitutes",
    color: "var(--ink2)",
    line: "Distribution scale via Henry Schein plus an implant-attached regenerative line. Strong in human allograft for US tastes.",
    products: ["MinerOss / MinerOss XP (allograft)", "Grafton DBM", "LADDEC (bovine)", "Mem-Lok (collagen membrane)", "MinerOss Cortico"],
    moves: ["Leverages Henry Schein's distribution reach", "Bundles regeneration with BioHorizons & Camlog implants"],
    str: ["Enormous distribution footprint (Henry Schein)", "Credible allograft portfolio for US preferences", "One-stop implant + graft purchasing"],
    weak: ["Less premium brand pull than Geistlich", "Soft-tissue range weaker than botiss", "Identity diluted inside a huge distributor catalog"],
  },
  {
    name: "ZimVie", hq: "USA — acquired by ARCHIMED, 2025", tier: "North America strong",
    color: "var(--ink2)",
    line: "Allograft heritage (Puros) and established membranes; refocusing on dental under new PE ownership.",
    products: ["Puros (cortico-cancellous allograft)", "RegenerOss / RegenerOss Plus", "CopiOs", "OsseoGuard / OsseoGuard Flex (membranes)"],
    moves: ["Acquired by ARCHIMED in 2025 — expansion capital, dental-only focus", "RegenerOss Plus with low-dose growth factor (US)", "TSX implant launches feeding the cross-sell"],
    str: ["Trusted Puros allograft brand in the US", "Implant + biomaterial cross-sell", "Fresh PE investment runway"],
    weak: ["Ownership transition = focus & continuity risk", "Limited footprint outside North America", "Thin soft-tissue offering"],
  },
  {
    name: "Envista — Nobel Biocare / Osteogenics", hq: "USA", tier: "Membrane category leader",
    color: "var(--ink2)",
    line: "Owns the non-resorbable membrane category through Cytoplast; creos is the Nobel-attached regenerative line.",
    products: ["Cytoplast (dPTFE non-resorbable membranes)", "creos xenogain (xeno)", "creos allo.gain (allo)", "creos syntogain (synthetic)", "creos mucogain (soft tissue)", "creos resorbable membranes"],
    moves: ["Acquired Osteogenics Biomedical in 2022 — Cytoplast leadership", "Pulls regeneration through Nobel / Implant Direct channel"],
    str: ["Category leader in non-resorbable (dPTFE) membranes", "Nobel Biocare implant ecosystem", "Full creos material spread across graft types"],
    weak: ["Xenograft brand weaker than Bio-Oss / cerabone", "creos still building clinical reputation", "Lighter DACH / EU regenerative presence"],
  },
  {
    name: "Dentsply Sirona — Symbios", hq: "USA / Germany", tier: "Broad-line challenger",
    color: "var(--ink2)",
    line: "Full Symbios regenerative range attached to a large implant + equipment + CAD/CAM ecosystem.",
    products: ["Symbios xenograft", "Symbios allograft", "Symbios synthetic (biphasic CaP)", "Symbios collagen membranes", "Symbios OsteoGraft"],
    moves: ["Multi-tier implant strategy + integrated digital ecosystem", "Cross-sells biomaterials through equipment installed base"],
    str: ["Massive installed base & sales force", "Cross-sell across CAD/CAM + implants", "Multi-material coverage under one brand"],
    weak: ["Regeneration is not the brand's hero category", "Lower KOL pull in pure biomaterials", "Focus diffused across a very large catalog"],
  },
  {
    name: "OsteoBiol (Tecnoss)", hq: "Italy", tier: "EU value/mid challenger",
    color: "var(--amber)",
    line: "Collagenated heat-deproteinised xenografts with strong adoption in Italy, France and Southern Europe; gel/putty handling formats.",
    products: ["Gen-Os / mp3 (collagenated xeno)", "Apatos", "Putty / Gel 40", "Evolution (collagen membrane)", "Lamina (cortical plate)", "Duo-Teck"],
    moves: ["Format innovation (pre-mixed gels, putties, syringes)", "Aggressive mid-tier pricing across EU and emerging markets"],
    str: ["Differentiated collagenated / putty handling", "Strong Southern-Europe distribution and loyalty", "Attractive price-to-evidence ratio"],
    weak: ["Thinner long-term evidence vs Bio-Oss", "Limited human-allograft and custom-block range", "Smaller global reach than the majors"],
  },
  {
    name: "Korean value tier", hq: "South Korea", tier: "Volume & price pressure",
    color: "var(--amber)",
    line: "Genoss (Dentium), Osstem, Hans Biomed/Bioland, Purgo — bundled with the world's highest-volume implant makers and priced 40–70% below premium.",
    products: ["Genoss OSTEON (synthetic biphasic)", "Osstem A-Oss / SureOss / collagen membranes", "Hans Biomed allograft & xenograft", "Purgo / The Graft xenograft", "OSTEOGUIDE membranes"],
    moves: ["Bundled with Osstem/Dentium/Hiossen implants", "Osstem developing LCA-R / LCA-N synthetics toward 2026", "Rapid global distribution expansion"],
    str: ["Aggressive pricing + implant bundling", "Huge home-market volume funding R&D", "Good-enough results for routine cases"],
    weak: ["Thinner evidence base in Western markets", "Limited soft-tissue & custom range", "Variable regulatory robustness across regions"],
  },
  {
    name: "Synthetic specialists", hq: "Germany · USA · France", tier: "Niche / animal-free",
    color: "var(--green)",
    line: "Curasan (CERASORB), NovaBone (bioactive glass), Septodont (R.T.R.), Bioteck, SigmaGraft — chosen where animal-free / fully synthetic is required.",
    products: ["Curasan CERASORB M / β-TCP", "NovaBone bioactive glass putty", "Septodont R.T.R.", "SigmaGraft / Bioteck synthetics"],
    moves: ["3D-printing & customisation partnerships (Curasan)", "Bioactive-glass putty handling formats (NovaBone)"],
    str: ["Fully synthetic — no origin/religious barriers", "Often FDA/CE cleared with predictable supply", "Lower regulatory friction than tissue-derived"],
    weak: ["Synthetics resorb/perform differently vs xeno gold standard", "Narrow portfolios — not full-line", "Limited KOL & education muscle"],
  },
];

const PRODUCT_MAP = [
  { cat: "Bovine xenograft", us: "cerabone · cerabone +HyA · cerabone plus", note: "Phase-pure sintered HA at 1200°C, organic-free, high volume stability. +HyA/plus add hyaluronate for sticky-graft handling.",
    rivals: "Geistlich Bio-Oss (reference) · creos xenogain · Symbios xeno · OsteoBiol Gen-Os · Korean xeno · LADDEC" },
  { cat: "Human allograft", us: "maxgraft (granules · cortico · blocks · bonering) · maxgraft +HyA", note: "Processed allograft via Cells+Tissuebank Austria (Allotec). A category Geistlich does not field. +HyA added 2025.",
    rivals: "BioHorizons MinerOss · ZimVie Puros · Dentsply Symbios allo · creos allo.gain · Hans Biomed" },
  { cat: "Custom CAD/CAM block", us: "maxgraft bonebuilder", note: "Patient-specific allograft block milled from CT/CBCT — competes on the custom-regeneration frontier; no donor-site morbidity.",
    rivals: "Geistlich Yxoss CBR (Ti mesh via ReOss) · ReOss · in-house Ti-mesh / 3D-printed scaffolds" },
  { cat: "Synthetic (alloplast)", us: "maxresorb · maxresorb inject", note: "Biphasic CaP (~60% HA / 40% β-TCP). Animal-free — key where porcine/bovine origin is a barrier. inject = flowable.",
    rivals: "Curasan CERASORB · NovaBone · Septodont R.T.R. · Genoss OSTEON · creos syntogain · Symbios synthetic" },
  { cat: "Resorbable collagen membrane", us: "Jason membrane (pericardium) · collprotect (dermis)", note: "Jason = long barrier function, multi-directional strength; collprotect = native, shorter, good wound adhesion.",
    rivals: "Geistlich Bio-Gide (category leader) · BioHorizons Mem-Lok · OsseoGuard · creos · OsteoBiol Evolution" },
  { cat: "Non-resorbable membrane", us: "permamem (dense PTFE)", note: "dPTFE barrier for GBR where a non-resorbable, cell-occlusive membrane is indicated.",
    rivals: "Cytoplast (Osteogenics/Envista — leader) · OsseoGuard · NeoGen PTFE · Korean PTFE" },
  { cat: "Resorbable magnesium", us: "NOVAMag membrane · screw · SHIELD", note: "Magnesium-based resorbable fixation & membranes — a differentiated niche. NOVAMag SHIELD (buccal wall) added 2025.",
    rivals: "Titanium fixation & mesh · resorbable pins · (few direct Mg competitors)" },
  { cat: "Soft-tissue matrix", us: "mucoderm (porcine collagen)", note: "Replaces palatal connective-tissue harvesting; supports revascularization. A genuine portfolio strength.",
    rivals: "Geistlich Mucograft / Fibro-Gide · creos mucogain · Symbios soft tissue" },
  { cat: "Collagen / haemostasis", us: "collacone (cone) · collafleece (fleece)", note: "Socket cones and haemostatic fleeces — cost-effective wound-management adjuncts, useful for anticoagulated patients.",
    rivals: "Geistlich socket products · various collagen plugs/fleeces" },
  { cat: "Application & point-of-care", us: "botiss grafter · botissCARE", note: "Applicator for hydration/delivery of sticky grafts; botissCARE point-of-care line rounds out the chairside system.",
    rivals: "Bio-Oss Pen (applicator) · syringe-format rivals" },
];

// Indicative reseller anchors — clearly labelled as orientation, not official prices.
const PRICE_SEED = [
  { id: "s1", product: "Bovine xenograft, small granules", category: "Xenograft", competitor: "Bio-Oss (ref.)", country: "USA", pack: "0.5 g / ~1 cc", price: "150", currency: "USD", source: "Indicative reseller / eBay grey-market range $120–180", date: "ref" },
  { id: "s2", product: "Bovine xenograft", category: "Xenograft", competitor: "botiss cerabone (ours)", country: "Germany", pack: "0.5 cc", price: "95", currency: "EUR", source: "Indicative — typically ~20–30% below Bio-Oss", date: "ref" },
  { id: "s3", product: "Collagen membrane 13×25", category: "Membrane", competitor: "Bio-Gide (ref.)", country: "USA", pack: "13×25 mm", price: "165", currency: "USD", source: "Indicative reseller range $130–185", date: "ref" },
  { id: "s4", product: "Pericardium membrane 20×30", category: "Membrane", competitor: "botiss Jason (ours)", country: "Germany", pack: "20×30 mm", price: "120", currency: "EUR", source: "Indicative — at/below Bio-Gide", date: "ref" },
  { id: "s5", product: "Collagenated xenograft", category: "Xenograft", competitor: "OsteoBiol Gen-Os", country: "Italy", pack: "0.5 g", price: "70", currency: "EUR", source: "Indicative — EU mid-tier", date: "ref" },
  { id: "s6", product: "Synthetic biphasic CaP", category: "Synthetic", competitor: "Genoss OSTEON (KR)", country: "South Korea", pack: "0.5 cc", price: "35", currency: "USD", source: "Indicative — value tier, often implant-bundled", date: "ref" },
];

const PLAYBOOK = [
  {
    head: "vs Geistlich — the main fight", color: "var(--coral)", icon: ShieldAlert,
    moves: [
      "Don't try to out-legacy Bio-Oss on 30 years of evidence — you won't win there. Move the conversation to portfolio breadth, modern handling, and total value per case.",
      "Lead with +HyA / cerabone plus. Hyaluronate sticky-graft handling is a tangible, demonstrable upgrade you can show chairside; classic Bio-Oss has no equivalent in the base product.",
      "Sell the full stack from one supplier: cerabone (xeno) + maxgraft (allo) + maxresorb (synthetic) + full membrane, soft-tissue and custom-block range. Geistlich forces a second vendor for human allograft.",
      "Use maxgraft as the wedge wherever allograft is preferred (notably the US) — Geistlich simply has no human-allograft answer.",
      "Frame cerabone as clinically proven and volume-stable at materially better value than premium Bio-Oss; anchor on cost-per-case, including membrane + fixation.",
      "Counter the ReOss/Yxoss custom story with maxgraft bonebuilder — a milled allograft block with no titanium to remove and no second surgery.",
    ],
  },
  {
    head: "vs value & regional players (OsteoBiol, Korea, synthetics)", color: "var(--amber)", icon: Tag,
    moves: [
      "Never race to the bottom on price — you'll surrender margin and brand. Compete on evidence, regulatory robustness, and the soft-tissue + custom range they can't match.",
      "Anchor on cost-per-outcome, not cost-per-cc: a failed graft and re-do dwarfs any material saving.",
      "Where implants are bundled (Korea), bring the Straumann/Neodent ecosystem to the table so the graft discount isn't the only lever in the room.",
      "Use botiss campus cases, webinars and KOLs as proof that routine-case savings aren't worth the risk on complex or aesthetic cases.",
    ],
  },
  {
    head: "vs Envista / Osteogenics on membranes", color: "var(--ink2)", icon: Layers,
    moves: [
      "Where Cytoplast (dPTFE) is specified, position permamem head-to-head as the non-resorbable option inside a single botiss order — no second vendor.",
      "For resorbable cases, contrast Jason (long barrier, pericardium, multi-directional strength) vs collprotect (native, wound-adhesive) to show indication-matched choice, not one-size-fits-all.",
      "Bring NOVAMag (resorbable magnesium) where the clinician wants to avoid a removal surgery — a story creos/OsseoGuard can't tell.",
    ],
  },
  {
    head: "Cross-cutting growth plays", color: "var(--teal)", icon: Sparkles,
    moves: [
      "Sell through the implant channel — ~half of implant procedures need grafting. Co-sell with Straumann / Neodent to lift the graft attach-rate per implant (model it in the Deal calculator).",
      "Win full-arch and complex reconstruction first — portfolio breadth and bonebuilder custom blocks are decisive there; routine volume follows the relationship.",
      "Make botiss campus a lead engine: case library, webinars, and hands-on +HyA / sticky-bone workshops convert clinicians better than brochures.",
      "Match the material to the market's beliefs: push maxresorb (animal-free synthetic) where porcine/bovine origin is a barrier; lead with maxgraft (allograft) in the US.",
      "Push the 2025 launches as proof of innovation cadence: NOVAMag SHIELD, maxgraft +HyA, and the seven-product white-label line for DSOs and partners.",
    ],
  },
];

const MARKETS = [
  { region: "DACH (DE · AT · CH)", tone: "Home turf · premium", color: "var(--teal)",
    notes: "Straumann distributes botiss directly here and the brand is well established. Geistlich is strong (Swiss home market). Allograft is accepted (maxgraft processed in Austria). Defend share; push +HyA, NOVAMag and custom blocks as the premium innovation edge." },
  { region: "Rest of Europe", tone: "Mixed · fragmented · MDR friction", color: "var(--ink2)",
    notes: "OsteoBiol is strong in Italy/France; EU MDR raises the regulatory bar (favouring well-documented, well-funded suppliers); reimbursement varies by country and implant work is largely private-pay. Win with the full soft-tissue range and indication-matched membranes vs single-line rivals." },
  { region: "North America (US · CA)", tone: "Allograft-led · high opportunity · soft demand", color: "var(--teal)",
    notes: "Allograft-preferring culture → maxgraft is a real differentiator vs Geistlich. But BioHorizons (Henry Schein), ZimVie (Puros) and Envista (Cytoplast) are entrenched and FDA pathways add friction. Straumann reported a cautious US market in 2025 (out-of-pocket treatments under pressure). Enter on the Straumann channel + the allograft story; Canada approvals can lag (cerabone awaited Health Canada)." },
  { region: "Latin America (BR-led)", tone: "Price-sensitive · ecosystem play", color: "var(--amber)",
    notes: "botiss launched via Straumann; Neodent (Straumann) is huge in Brazil — bundle grafts with implants. Geistlich is strong and bought Bionnovation (BR) for local manufacturing + a value tier. Compete on the implant-ecosystem bundle and education, not raw price. LATAM was a strong Straumann growth region in 2025." },
  { region: "APAC", tone: "Value-dominant · high volume", color: "var(--amber)",
    notes: "Korea (Osstem, Dentium/Genoss, Hans Biomed, Purgo) sets aggressive value pricing and bundles with the world's highest implant volumes; Japan is conservative with strict regulation (slow, premium-friendly once in); China is large and growing with strong local players — Straumann's Shanghai campus localises supply. Lead with evidence and Straumann backing; avoid a price war." },
  { region: "Middle East & Africa", tone: "Synthetic-friendly · premium private", color: "var(--ink2)",
    notes: "Religious/cultural concerns can disfavour porcine and sometimes bovine origin → lead with maxresorb (synthetic) and educate on cerabone's high-temperature processing. Gulf private clinics are premium and brand-receptive; distribution is partner-led." },
];

const SOURCES = [
  { t: "iData Research — Global Dental Bone Graft Substitute & Biomaterials Market (2025–2032)", d: "Market sized at $2.33B (2025) → ~$3.8B (2032), ~7.2% CAGR. Geistlich leads; BioHorizons #2; ZimVie acquired by ARCHIMED 2025; competitive landscape by region.", u: "idataresearch.com" },
  { t: "Mordor Intelligence — Dental Bone Graft Substitutes Market", d: "Narrower DBGS definition: $0.87B (2025) → $1.28B (2030), 7.81% CAGR. Notes Bio-Oss as best-selling xenograft; Straumann divested DrSmile 2024 to focus on implants & regeneration.", u: "mordorintelligence.com" },
  { t: "Straumann Group Annual Report 2025 / FY2025 release", d: "Revised regenerative market up to ~CHF 1.3B (from CHF 0.7B). New botiss launches: NOVAMag SHIELD, maxgraft +HyA, seven-product white-label line. H1 2025 group revenue CHF 1.3B, +10.2% organic; cautious US market.", u: "straumann.com" },
  { t: "botiss biomaterials product site & campus", d: "Full current catalogue: cerabone/+HyA/plus, maxgraft (granules/cortico/blocks/bonering/bonebuilder/+HyA), maxresorb/inject, Jason, collprotect, permamem, mucoderm, collacone, collafleece, NOVAMag (membrane/screw/SHIELD).", u: "botiss.com" },
  { t: "Geistlich product portfolio (geistlich.com / geistlich-na.com)", d: "Bio-Oss (+Pen, +Collagen), Bio-Gide (Compressed/Perio/Shape/Forte), Mucograft/Seal, Fibro-Gide, vallos. Bionnovation 2024 + ReOss 2025 (Yxoss) confirm value + custom expansion.", u: "geistlich.com" },
  { t: "iData regional reports (South Korea, Brazil, US, barrier membranes)", d: "Korea: Genoss (Dentium) #2, Hans Biomed, Osstem; synthetics lead locally. Brazil: Geistlich + Bionnovation. US membranes: Geistlich led, Zimmer Biomet #2, Envista #3 (Cytoplast in non-resorbable).", u: "idataresearch.com" },
  { t: "Reseller / distributor webshops (Puredent, DentalMiles, Benco, Meisinger, eBay)", d: "Used only to confirm pricing opacity and rough grey-market anchors. Most list 'contact for quote'; published listings are reseller/grey-market, not official channel prices.", u: "various" },
];

/* ============================ APP ============================ */

export default function App() {
  const [tab, setTab] = useState("landscape");
  return (
    <div className="cici">
      <style>{STYLE}</style>
      <div className="mobtabs">
        {NAV.map(n => (
          <button key={n.id} className={"mobtab" + (tab === n.id ? " on" : "")} aria-current={tab === n.id ? "page" : undefined} onClick={() => setTab(n.id)}>{n.label}</button>
        ))}
      </div>
      <div className="shell">
        <nav className="rail">
          <div className="brandmark">
            <span className="b">botiss</span><span className="sub">CI desk</span>
          </div>
          <div className="railnote">Dental regenerative-biomaterials competitive intelligence</div>
          {NAV.map(n => {
            const I = n.icon;
            return (
              <button key={n.id} className={"navbtn" + (tab === n.id ? " on" : "")} aria-current={tab === n.id ? "page" : undefined} onClick={() => setTab(n.id)}>
                <I size={16} /> {n.label}
              </button>
            );
          })}
          <div className="railfoot">
            Figures: iData / Mordor / Straumann AR2025 (researched Jun 2026). Prices are quote-based — see Price intel. Orientation only, not legal or financial advice.
          </div>
        </nav>
        <div className="main">
          {tab === "landscape" && <Landscape go={setTab} />}
          {tab === "competitors" && <Competitors />}
          {tab === "products" && <Products />}
          {tab === "prices" && <Prices />}
          {tab === "playbook" && <Playbook />}
          {tab === "markets" && <Markets />}
          {tab === "calculator" && <DealCalc />}
          {tab === "sources" && <Sources />}
        </div>
      </div>
    </div>
  );
}

function Header({ eyebrow, title, lead }) {
  return (
    <div className="topbar">
      <div className="eyebrow">{eyebrow}</div>
      <div className="h1">{title}</div>
      <div className="lead">{lead}</div>
    </div>
  );
}

function Stat({ big, label, sub, accent, threat }) {
  const c = threat ? "var(--coral)" : accent ? "var(--teal)" : "var(--ink)";
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="stat" style={{ fontSize: 27, color: c }}>{big}</div>
      <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

/* ----- LANDSCAPE ----- */
const KIND_COLOR = { us: "var(--teal)", threat: "var(--coral)", value: "var(--amber)", other: "#B6C0CA", comp: "#647082" };
const barColor = (k) => KIND_COLOR[k] || KIND_COLOR.comp;

function Landscape({ go }) {
  return (
    <>
      <Header eyebrow="Market landscape" title="Where botiss sits in dental regeneration"
        lead="The dental bone-graft & biomaterials market is led by Geistlich. botiss competes on portfolio breadth, modern handling (+HyA, magnesium), human allograft, and the Straumann ecosystem — not on legacy brand or lowest price." />
      <div className="body">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: 18 }}>
          <Stat big="$2.33B" label="Global bone-graft + biomaterials, 2025" sub="iData Research" />
          <Stat big="≈$3.8B" label="Projected market, 2032" sub="~7.2% CAGR" accent />
          <Stat big="~CHF 1.3B" label="Regenerative market — Straumann's own view" sub="revised up from CHF 0.7B (AR2025)" />
          <Stat big="~50%" label="Implant cases needing a graft / membrane" sub="the attach-rate to chase" />
          <Stat big="#1" label="Geistlich — the brand to beat" sub="Bio-Oss / Bio-Gide" threat />
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1.25fr 1fr", marginBottom: 18 }}>
          <div className="card">
            <div className="kicker">Positioning — price premium vs portfolio breadth</div>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 16, right: 22, bottom: 32, left: 4 }}>
                  <CartesianGrid stroke="#EAEFF3" />
                  <XAxis type="number" dataKey="x" domain={[1, 10]} tick={{ fontSize: 10.5, fill: "#647082" }}
                    label={{ value: "Relative price premium →", position: "bottom", fontSize: 10.5, fill: "#647082" }} />
                  <YAxis type="number" dataKey="y" domain={[3, 10]} tick={{ fontSize: 10.5, fill: "#647082" }}
                    label={{ value: "Portfolio breadth ↑", angle: -90, position: "insideLeft", fontSize: 10.5, fill: "#647082" }} />
                  <ZAxis type="number" dataKey="z" range={[110, 560]} />
                  <RTooltip cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #DCE3E9" }}
                    formatter={(v, n) => {
                      if (n === "x") return [v, "price premium"];
                      if (n === "y") return [v, "portfolio breadth"];
                      return [v, "share weight"];
                    }}
                    labelFormatter={() => ""} />
                  <Scatter data={POSITION} fill="#647082">
                    {POSITION.map((p, i) => <Cell key={i} fill={barColor(p.kind)} />)}
                    <LabelList dataKey="name" position="top" style={{ fontSize: 9.5, fontWeight: 600, fill: "#2A3340" }} />
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="legendrow">
              <span><span className="dot" style={{ background: "var(--teal)" }} />botiss</span>
              <span><span className="dot" style={{ background: "var(--coral)" }} />Geistlich</span>
              <span><span className="dot" style={{ background: "#647082" }} />other majors</span>
              <span><span className="dot" style={{ background: "var(--amber)" }} />value tier</span>
            </div>
          </div>

          <div className="card">
            <div className="kicker">Approx. share of voice — global DBGS</div>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SHARE} layout="vertical" margin={{ top: 4, right: 30, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke="#EAEFF3" horizontal={false} />
                  <XAxis type="number" domain={[0, 30]} tick={{ fontSize: 10, fill: "#647082" }} unit="%" />
                  <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 10, fill: "#2A3340" }} />
                  <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #DCE3E9" }} formatter={(v) => [v + "%", "share (est.)"]} />
                  <Bar dataKey="v" radius={[0, 4, 4, 0]}>
                    {SHARE.map((s, i) => <Cell key={i} fill={barColor(s.kind)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 0" }}>
              Illustrative estimates synthesised from analyst commentary — exact shares aren't published. Use to brief, not to quote.
            </p>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="card">
            <div className="kicker">botiss edge</div>
            <ul style={{ margin: 0, paddingLeft: 17, fontSize: 13, color: "var(--ink2)" }}>
              <li style={{ marginBottom: 6 }}>Widest single-vendor range: xenograft + allograft + synthetic + membranes + soft tissue + custom blocks + magnesium fixation.</li>
              <li style={{ marginBottom: 6 }}>+HyA / cerabone plus sticky-graft handling and NOVAMag magnesium are genuinely modern differentiators.</li>
              <li style={{ marginBottom: 6 }}>maxgraft human allograft — a whole category Geistlich doesn't field.</li>
              <li>Straumann backing: ecosystem bundle + distribution across Europe and the Americas; new 2025 launches show innovation cadence.</li>
            </ul>
          </div>
          <div className="card">
            <div className="kicker">Pressure points</div>
            <ul style={{ margin: 0, paddingLeft: 17, fontSize: 13, color: "var(--ink2)" }}>
              <li style={{ marginBottom: 6 }}>Geistlich's evidence + brand pull keeps Bio-Oss the default specification.</li>
              <li style={{ marginBottom: 6 }}>Korean and EU value players compress xenograft & membrane pricing, often implant-bundled.</li>
              <li style={{ marginBottom: 6 }}>Bio-Gide leads resorbable membranes; Cytoplast leads non-resorbable.</li>
              <li>US market was cautious in 2025; FDA/Health-Canada pathways slow new-format entry.</li>
            </ul>
          </div>
        </div>

        <button className="btn pri" style={{ marginTop: 18 }} onClick={() => go("playbook")}>
          Go to the sell-better playbook <ArrowUpRight size={15} />
        </button>
      </div>
    </>
  );
}

/* ----- COMPETITORS ----- */
function Competitors() {
  const [open, setOpen] = useState("Geistlich Pharma");
  return (
    <>
      <Header eyebrow="Competitor profiles" title="Who botiss is up against"
        lead="Eight profiles spanning the global leader, the US-strong majors, the membrane specialists, the EU mid-tier, the Korean volume players, and the synthetic niche. Expand any card for products, recent moves, and a strengths / weaknesses read." />
      <div className="body">
        <div className="grid">
          {COMPETITORS.map(c => {
            const isOpen = open === c.name;
            const panelId = "panel-" + c.name.replace(/\s+/g, "-");
            return (
              <div className="compcard" key={c.name}>
                <div
                  className="comphead"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? "" : c.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpen(isOpen ? "" : c.name);
                    }
                  }}
                >
                  <div className="flagbar" style={{ background: c.color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <span className="disp" style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</span>
                      {c.threat && <span className="chip threat"><ShieldAlert size={12} /> Lead threat</span>}
                      <span className="tag">{c.tier}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>{c.hq}</div>
                    <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 7 }}>{c.line}</div>
                  </div>
                  <ChevronDown size={18} style={{ color: "var(--muted)", transform: isOpen ? "rotate(180deg)" : "none", transition: ".2s", flexShrink: 0 }} />
                </div>
                {isOpen && (
                  <div className="compbody" id={panelId}>
                    <div style={{ marginTop: 14 }}>
                      <div className="kicker">Key products</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {c.products.map(p => <span className="chip" key={p}>{p}</span>)}
                      </div>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <div className="kicker">Recent moves</div>
                      <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, color: "var(--ink2)" }}>
                        {c.moves.map(m => <li key={m} style={{ marginBottom: 4 }}>{m}</li>)}
                      </ul>
                    </div>
                    <div className="swot">
                      <div style={{ background: "#F4FAF9", borderRadius: 9, padding: "10px 12px" }}>
                        <h5 style={{ color: "var(--teal-dk)" }}>Strengths</h5>
                        <ul>{c.str.map(s => <li key={s}>{s}</li>)}</ul>
                      </div>
                      <div style={{ background: "var(--coral-wash)", borderRadius: 9, padding: "10px 12px" }}>
                        <h5 style={{ color: "var(--coral)" }}>Weaknesses to exploit</h5>
                        <ul>{c.weak.map(s => <li key={s}>{s}</li>)}</ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ----- PRODUCTS ----- */
function Products() {
  return (
    <>
      <Header eyebrow="Product map" title="Every botiss line, mapped to its rivals"
        lead="The full current botiss catalogue by category, matched to the competing products. Use it to brief reps fast and to anchor head-to-head comparisons in the room." />
      <div className="body">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="mtx">
              <thead>
                <tr><th>Category</th><th>botiss product</th><th>Why it matters</th><th>Competing products</th></tr>
              </thead>
              <tbody>
                {PRODUCT_MAP.map(r => (
                  <tr key={r.cat}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.cat}</td>
                    <td className="usprod">{r.us}</td>
                    <td style={{ color: "var(--ink2)" }}>{r.note}</td>
                    <td style={{ color: "var(--muted)" }}>{r.rivals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="note" style={{ marginTop: 16 }}>
          <Beaker size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div><strong>New in 2025 (per Straumann AR2025):</strong> NOVAMag SHIELD (resorbable magnesium membrane for the buccal wall, no removal surgery), maxgraft +HyA (sticky allograft granules), and a seven-product white-label botiss line for DSOs and partners. Lead with these to counter the "incremental innovation" knock against larger rivals.</div>
        </div>
      </div>
    </>
  );
}

/* ----- PRICES ----- */
const PRICE_STORAGE_KEY = "botiss_price_intel_v2";

function newRowId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through to timestamp-based id */ }
  return "u" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function blankDraft() {
  return { product: "", category: "Xenograft", competitor: "", country: "", pack: "", price: "", currency: "EUR", source: "", date: new Date().toISOString().slice(0, 10) };
}

function Prices() {
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState(blankDraft);
  const [q, setQ] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRICE_STORAGE_KEY);
      setRows(raw ? JSON.parse(raw) : PRICE_SEED);
    } catch {
      setRows(PRICE_SEED);
    }
  }, []);

  function persist(next) {
    setRows(next);
    try { localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }
  function add() {
    if (!draft.product.trim()) return;
    persist([{ ...draft, id: newRowId() }, ...rows]);
    setDraft(blankDraft());
  }
  function del(id) { persist(rows.filter(r => r.id !== id)); }

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => [r.product, r.competitor, r.country, r.category, r.pack, r.source].join(" ").toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <>
      <Header eyebrow="Price intelligence" title="A tracker for the prices you actually verify"
        lead="Biomaterial prices aren't published — they're quote-based and swing with country, distributor margin, tenders and reimbursement. This logs the verified figures your team gathers and saves them across sessions on this device." />
      <div className="body">
        <div className="note" style={{ marginBottom: 18 }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Why there's no live global price scrape.</strong> Manufacturers don't publish list prices; distributor sites mostly say "contact for quote", and the public listings that do exist (eBay, grey-market resellers) aren't the official channel and aren't what a clinic actually pays — they also vary 2–3× by country and margin. So the seed rows below are <em>indicative orientation only</em>. Replace them with real figures from reps, distributor quotes, tenders and GPO/DSO contracts. That field-verified data is the asset.
          </div>
        </div>
        <div className="note" style={{ marginBottom: 18, background: "#F4FAF9", borderColor: "#CFE8E5", color: "var(--teal-dk)" }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>Saved rows live only in this browser's local storage — they won't sync between devices or teammates. Export anything worth keeping into your team's shared price sheet.</div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="kicker">Add a verified price point</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))" }}>
            <div><label className="fld">Product</label><input value={draft.product} onChange={e => setDraft({ ...draft, product: e.target.value })} placeholder="e.g. cerabone 1.0 cc" /></div>
            <div><label className="fld">Category</label>
              <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                {["Xenograft", "Allograft", "Synthetic", "Membrane", "Non-resorbable", "Magnesium", "Soft tissue", "Collagen", "Custom block"].map(c => <option key={c}>{c}</option>)}
              </select></div>
            <div><label className="fld">Brand / competitor</label><input value={draft.competitor} onChange={e => setDraft({ ...draft, competitor: e.target.value })} placeholder="botiss (ours) or rival" /></div>
            <div><label className="fld">Country</label><input value={draft.country} onChange={e => setDraft({ ...draft, country: e.target.value })} placeholder="e.g. Germany" /></div>
            <div><label className="fld">Pack size</label><input value={draft.pack} onChange={e => setDraft({ ...draft, pack: e.target.value })} placeholder="e.g. 0.5 g" /></div>
            <div><label className="fld">Price</label><input type="number" min="0" step="0.01" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} placeholder="120" /></div>
            <div><label className="fld">Currency</label>
              <select value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value })}>
                {["EUR", "USD", "GBP", "CHF", "BRL", "JPY", "KRW", "AED"].map(c => <option key={c}>{c}</option>)}
              </select></div>
            <div><label className="fld">Source</label><input value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="rep quote / tender / GPO" /></div>
            <div><label className="fld">Date</label><input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></div>
          </div>
          <button className="btn pri" style={{ marginTop: 13 }} onClick={add} disabled={!draft.product.trim()}><Plus size={15} /> Add price point</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: "var(--muted)" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by product, brand, country…" aria-label="Filter price rows" style={{ paddingLeft: 32 }} />
          </div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{filtered.length} {filtered.length === 1 ? "row" : "rows"}</span>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="ptable">
              <thead>
                <tr><th>Product</th><th>Category</th><th>Brand</th><th>Country</th><th>Pack</th><th>Price</th><th>Source</th><th>Date</th><th><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span></th></tr>
              </thead>
              <tbody>
                {rows === null && <tr><td colSpan={9} style={{ color: "var(--muted)", textAlign: "center", padding: 22 }}>Loading saved intel…</td></tr>}
                {rows !== null && filtered.length === 0 && <tr><td colSpan={9} style={{ color: "var(--muted)", textAlign: "center", padding: 22 }}>No rows yet. Add the first verified price above.</td></tr>}
                {filtered.map(r => {
                  const ours = (r.competitor || "").toLowerCase().includes("our") || (r.competitor || "").toLowerCase().includes("botiss");
                  const ref = r.date === "ref";
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.product}</td>
                      <td><span className="tag">{r.category}</span></td>
                      <td>{ours ? <span className="chip us">{r.competitor}</span> : (r.competitor || "—")}</td>
                      <td>{r.country || "—"}</td>
                      <td className="mono">{r.pack || "—"}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{r.price ? r.price + " " + r.currency : "—"}</td>
                      <td style={{ color: "var(--muted)", fontSize: 11.5, maxWidth: 220 }}>{r.source || "—"}</td>
                      <td style={{ color: ref ? "var(--amber)" : "var(--muted)", fontSize: 11.5 }}>{ref ? "indicative" : r.date}</td>
                      <td><button className="btn ghost" onClick={() => del(r.id)} title="Delete" aria-label={`Delete ${r.product}`}><Trash2 size={15} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

/* ----- PLAYBOOK ----- */
function Playbook() {
  return (
    <>
      <Header eyebrow="Sell-better playbook" title="How to win the conversation"
        lead="Battlecards built from the landscape: how to position botiss against each rival type, plus the cross-cutting growth plays. Concrete moves, not slogans." />
      <div className="body">
        <div className="grid">
          {PLAYBOOK.map(bc => {
            const I = bc.icon;
            return (
              <div className="bc" key={bc.head}>
                <div className="bchead">
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: bc.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <I size={16} color="#fff" />
                  </div>
                  <span className="disp" style={{ fontWeight: 600, fontSize: 15.5 }}>{bc.head}</span>
                </div>
                {bc.moves.map((m, i) => (
                  <div className="move" key={i}>
                    <span className="movenum">{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ color: "var(--ink2)" }}>{m}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ----- MARKETS ----- */
function Markets() {
  return (
    <>
      <Header eyebrow="Markets" title="Country & regional dynamics"
        lead="What drives the buying decision region by region — material preference, who's entrenched, regulatory friction, and the angle that works locally." />
      <div className="body">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          {MARKETS.map(m => (
            <div className="card" key={m.region}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                <div className="flagbar" style={{ background: m.color, width: 4, height: 18, borderRadius: 99 }} />
                <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>{m.region}</span>
              </div>
              <span className="tag" style={{ marginBottom: 9, display: "inline-block" }}>{m.tone}</span>
              <p style={{ fontSize: 12.8, color: "var(--ink2)", margin: "4px 0 0", lineHeight: 1.55 }}>{m.notes}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ----- DEAL CALCULATOR ----- */
function DealCalc() {
  const [implants, setImplants] = useState(60);
  const [attachNow, setAttachNow] = useState(40);
  const [attachTarget, setAttachTarget] = useState(60);
  const [revPerCase, setRevPerCase] = useState(180);

  const n = (v) => {
    const f = parseFloat(v);
    return Number.isNaN(f) ? 0 : f;
  };
  const casesNow = n(implants) * n(attachNow) / 100;
  const casesTarget = n(implants) * n(attachTarget) / 100;
  const incCases = Math.max(0, casesTarget - casesNow);
  const monthly = incCases * n(revPerCase);
  const annual = monthly * 12;
  const fmt = (x) => x.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <>
      <Header eyebrow="Deal calculator" title="Quantify the graft attach-rate opportunity"
        lead="Roughly half of implant procedures need grafting, yet many accounts graft far less. Model the incremental revenue from lifting the attach-rate on an account — the number that actually moves a sales conversation." />
      <div className="body">
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
          <div className="card">
            <div className="kicker">Account inputs</div>
            <div style={{ display: "grid", gap: 13 }}>
              <div><label className="fld">Implants placed / month</label><input type="number" min="0" value={implants} onChange={e => setImplants(e.target.value)} /></div>
              <div><label className="fld">Current graft attach-rate (%)</label><input type="number" min="0" max="100" value={attachNow} onChange={e => setAttachNow(e.target.value)} /></div>
              <div><label className="fld">Target graft attach-rate (%)</label><input type="number" min="0" max="100" value={attachTarget} onChange={e => setAttachTarget(e.target.value)} /></div>
              <div><label className="fld">Avg botiss revenue / grafted case ({"€"}/$/local)</label><input type="number" min="0" value={revPerCase} onChange={e => setRevPerCase(e.target.value)} /></div>
              <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>"Revenue / case" = graft + membrane + soft-tissue + fixation you'd realistically supply per grafted procedure. Use your own quoted figures.</p>
            </div>
          </div>

          <div className="card" style={{ background: "var(--ink)", color: "#fff", border: "none" }}>
            <div className="kicker" style={{ color: "#8B97A4" }}>The opportunity</div>
            <div className="stat" style={{ fontSize: 40, color: "#fff", lineHeight: 1.05 }}>{fmt(annual)}</div>
            <div style={{ fontSize: 13, color: "#B6C0CA", marginTop: 4 }}>incremental revenue / year from this one account</div>
            <div className="divider" style={{ background: "#232C36", margin: "16px 0" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div><div className="stat" style={{ fontSize: 22, color: "#fff" }}>{fmt(monthly)}</div><div style={{ fontSize: 11.5, color: "#8B97A4" }}>per month</div></div>
              <div><div className="stat" style={{ fontSize: 22, color: "#fff" }}>+{incCases.toFixed(1)}</div><div style={{ fontSize: 11.5, color: "#8B97A4" }}>extra grafted cases / month</div></div>
              <div><div className="stat" style={{ fontSize: 22, color: "#fff" }}>{casesNow.toFixed(0)}</div><div style={{ fontSize: 11.5, color: "#8B97A4" }}>grafted cases now / month</div></div>
              <div><div className="stat" style={{ fontSize: 22, color: "#fff" }}>{casesTarget.toFixed(0)}</div><div style={{ fontSize: 11.5, color: "#8B97A4" }}>grafted cases at target</div></div>
            </div>
          </div>
        </div>
        <div className="note" style={{ marginTop: 16 }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>Use this to reframe a price objection: a clinician haggling over a few euros per cc is often leaving far more on the table by under-grafting. The lever that grows your business is attach-rate and full-case supply, not discounting the graft.</div>
        </div>
      </div>
    </>
  );
}

/* ----- SOURCES ----- */
function Sources() {
  return (
    <>
      <Header eyebrow="Sources & method" title="Where this intelligence comes from"
        lead="This workspace summarises publicly available information gathered in June 2026 and the strategic logic that follows from it. It's a briefing aid — verify anything client-facing against the primary source." />
      <div className="body">
        <div className="card">
          {SOURCES.map((s, i) => (
            <div className="srcitem" key={i}>
              <BookOpen size={16} style={{ color: "var(--teal)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.t}</div>
                <div style={{ color: "var(--ink2)", margin: "3px 0 4px" }}>{s.d}</div>
                <span className="tag">{s.u}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="note" style={{ marginTop: 16 }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div><strong>Method & limits.</strong> Market sizes differ across analysts because of differing definitions (bone-graft-only vs bone-graft + membranes + soft tissue); ranges are given rather than false precision. Share-of-voice figures are illustrative estimates, not published numbers. Prices in this market are quote-based and not officially listed. Nothing here is legal, regulatory or financial advice.</div>
        </div>
      </div>
    </>
  );
}
