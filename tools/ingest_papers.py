#!/usr/bin/env python3
"""Turn a folder of published-paper PDFs into evidence-library entries.

Built for the case where several hundred PDFs arrive at once: far too many
to read in a conversation, and far too many to hand-key.

The split of labour is deliberate, and it is the whole point of this
script:

  MECHANICAL fields are extracted automatically, because they can be
  checked against the page: DOI, PMID, year, journal, title, authors,
  study design, which product was studied.

  The JUDGEMENT field is not. `supports` states narrowly what a reference
  may license in a sales conversation, and inventing that from a title
  would reintroduce exactly the failure mode the science desk exists to
  prevent. So this script quotes the paper's OWN abstract or conclusion
  verbatim and marks the entry as needing a scope statement. Nothing it
  writes is a paraphrase.

Usage:
    python3 tools/ingest_papers.py <pdf-dir> [--out out] [--existing ids.json]

Outputs, under --out:
    entries/<id>.json     one evidence-library record per paper
    batches/batch-N.json  the same ids grouped in 50s, for write_db
    report.md             what was found, by product and design
    review.md            the ones that need a human before they are used
"""

import argparse
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    sys.exit("pypdf is required:  pip install cffi pypdf")

# --------------------------------------------------------------------------
# What we recognise

BOTISS = [
    "cerabone plus", "cerabone", "maxgraft bonebuilder", "maxgraft bonering",
    "maxgraft cortico", "maxgraft", "maxresorb inject", "maxresorb",
    "jason membrane", "collprotect", "permamem", "mucoderm", "collacone",
    "collafleece", "novamag", "botiss",
]

COMPETITORS = [
    "bio-oss", "bio oss", "biooss", "bio-gide", "bio gide", "mucograft",
    "fibro-gide", "geistlich", "cytoplast", "creos", "symbios", "puros",
    "regeneross", "mineross", "grafton", "osseoguard", "mem-lok", "laddec",
    "osteobiol", "gen-os", "cerasorb", "novabone", "osteon", "a-oss",
    "sureoss", "yxoss", "bionnovation",
]

# Brand names that are also ordinary words. Counted only when the text
# marks them as a trade name, otherwise "the graft was placed" would be
# read as a competitor product.
AMBIGUOUS_COMPETITORS = ["the graft", "evolution", "lamina", "apatos", "r.t.r."]

# Journals that recur in this field. Used to recognise a journal line;
# anything unmatched falls through to the pattern heuristic below.
JOURNALS = [
    "Clinical Oral Implants Research", "Clin Oral Implants Res",
    "Clinical Implant Dentistry and Related Research", "Clin Implant Dent Relat Res",
    "Clinical Oral Investigations", "Clin Oral Investig",
    "Journal of Clinical Periodontology", "J Clin Periodontol",
    "Journal of Periodontology", "J Periodontol",
    "Journal of Periodontal Research", "J Periodontal Res",
    "International Journal of Oral and Maxillofacial Implants",
    "Int J Oral Maxillofac Implants", "Int J Oral Maxillofac Surg",
    "International Journal of Implant Dentistry", "Int J Implant Dent",
    "International Journal of Periodontics and Restorative Dentistry",
    "Int J Periodontics Restorative Dent",
    "Journal of Oral and Maxillofacial Surgery", "J Oral Maxillofac Surg",
    "Periodontology 2000", "Periodontol 2000",
    "Journal of Clinical Medicine", "J Clin Med",
    "Journal of Functional Biomaterials", "J Funct Biomater",
    "Journal of Materials Science: Materials in Medicine", "J Mater Sci Mater Med",
    "Materials", "Membranes", "Bioengineering", "Dentistry Journal", "Dent J",
    "Clinical Case Reports", "Clin Case Rep", "BioMed Research International",
    "International Journal of Dentistry", "Int J Dent",
    "Head & Face Medicine", "Journal of Biomedical Materials Research",
    "Journal of Cranio-Maxillofacial Surgery", "J Craniomaxillofac Surg",
    "Implant Dentistry", "Quintessence International", "European Journal of Oral Implantology",
    "Journal of Dental Research", "J Dent Res", "Acta Biomaterialia", "Biomaterials",
    "Scientific Reports", "PLoS One", "Frontiers in Bioengineering and Biotechnology",
]

# Ordered: the first match wins, so put the most specific designs first.
DESIGNS = [
    ("Systematic review or meta-analysis",
     r"\b(systematic review|meta-?analys[ei]s|prisma)\b"),
    ("Randomised controlled trial",
     r"\b(randomi[sz]ed controlled (clinical )?trial|\brct\b|randomly (assigned|allocated)|"
     r"randomi[sz]ed clinical trial|split-?mouth randomi[sz]ed)\b"),
    ("Prospective cohort / prospective clinical",
     r"\b(prospective(ly)? (cohort|clinical|study|enrolled)|consecutively treated|consecutive patients)\b"),
    ("Retrospective cohort / chart review",
     r"\b(retrospective(ly)?|chart review|records were reviewed)\b"),
    ("Case series",
     r"\b(case series|series of \d+ (patients|cases)|\d+ consecutive cases)\b"),
    ("Case report",
     r"\b(case report|a report of (a|one|two|three|\d+) cases?|this case describes)\b"),
    ("Preclinical or animal",
     r"\b(rat|rats|rabbit|rabbits|beagle|dogs?|sheep|minipig|mini-?pig|swine|"
     r"calvaria|animal model|in vivo model)\b"),
    ("In vitro / cell culture",
     r"\b(in vitro|cell culture|cultured|osteoblast-?like|mg-?63|saos-?2|"
     r"cytotoxicity|cell viability assay)\b"),
    ("Bench or material characterisation",
     r"\b(scanning electron microscop|x-?ray diffraction|\bxrd\b|micro-?ct analysis of the material|"
     r"porosity was measured|physicochemical characteri[sz]ation|wettability|contact angle)\b"),
    ("Histological / histomorphometric analysis",
     r"\b(histomorphometr|histolog)\w*\b"),
    ("Narrative review or consensus",
     r"\b(narrative review|consensus (report|statement|conference)|expert opinion|this review)\b"),
]

# Indications and endpoints worth surfacing on the entry, because they are
# what a rep or the science desk actually searches by. Membrane vocabulary is
# included deliberately: barrier and exposure endpoints are what membrane
# papers are about, and they do not appear in the design keywords above.
TOPICS = [
    ("sinus floor elevation", r"\bsinus (floor )?(elevation|lift|augmentation|grafting)\b|\bschneiderian\b"),
    ("ridge preservation / socket", r"\b(socket|alveolar ridge) preservation\b|\bridge preservation\b|\bextraction socket\b"),
    ("ridge augmentation", r"\b(ridge|alveolar) augmentation\b|\bhorizontal augmentation\b|\bvertical augmentation\b"),
    ("guided bone regeneration", r"\bguided bone regeneration\b|\bgbr\b"),
    ("guided tissue regeneration", r"\bguided tissue regeneration\b|\bgtr\b"),
    ("peri-implantitis", r"\bperi-?implantitis\b|\bperi-?implant (bone )?defect\b"),
    ("periodontal defect", r"\b(intrabony|infrabony|intraosseous) defect\b|\bperiodontal regeneration\b"),
    ("immediate implant placement", r"\bimmediate (implant )?placement\b|\bimmediate implantation\b|\bjumping gap\b"),
    ("soft tissue augmentation", r"\bsoft tissue (augmentation|thickening|graft)\b|\bkeratini[sz]ed (tissue|mucosa)\b|"
                                 r"\bconnective tissue graft\b|\brecession coverage\b"),
    ("implant survival", r"\bimplant (survival|success) rate\b|\bsurvival of implants\b"),
    ("barrier function / membrane degradation",
     r"\bbarrier (function|membrane|effect)\b|\bmembrane degradation\b|\bresorption time\b|"
     r"\bcross-?link(ed|ing)\b|\bdegradation (rate|behaviou?r|time)\b|\bstanding time\b"),
    ("membrane exposure / dehiscence",
     r"\b(membrane|soft tissue|wound) (exposure|dehiscence)\b|\bpremature exposure\b|"
     r"\bwound (dehiscence|breakdown)\b|\bflap dehiscence\b"),
    ("volume / dimensional stability",
     r"\b(volumetric|dimensional|volume) (stability|change|loss|shrinkage)\b|\bgraft resorption\b|"
     r"\bridge width change\b|\bhorizontal bone loss\b"),
    ("new bone formation / histomorphometry",
     r"\b(new(ly)? formed bone|new bone formation|bone-?to-?implant contact|residual graft)\b|"
     r"\bpercentage of (new )?bone\b"),
    ("vascularisation / angiogenesis", r"\b(vasculari[sz]ation|angiogenesis|neovasculari[sz]ation|blood vessel formation)\b"),
    ("patient-reported outcomes / morbidity",
     r"\b(patient-?reported|morbidity|donor site|post-?operative pain|quality of life|\bvas\b)\b"),
]

DOI_RE = re.compile(r"\b10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", re.I)
PMID_RE = re.compile(r"PMID:?\s*(\d{6,8})", re.I)
YEAR_RE = re.compile(r"\b(19[89]\d|20[0-4]\d)\b")

ABSTRACT_RE = re.compile(
    r"\b(abstract|summary)\b[\s:.\-]*(.{200,2600}?)(?=\b(keywords?|introduction|"
    r"1\.\s*introduction|background and aim|materials and methods)\b)",
    re.I | re.S)
CONCLUSION_RE = re.compile(
    r"\bconclusions?\b[\s:.\-]*(.{80,1200}?)(?=\b(keywords?|references|"
    r"acknowledge?ments|conflicts? of interest|funding)\b|$)",
    re.I | re.S)


# --------------------------------------------------------------------------
# Helpers

def clean(s, limit=None):
    """Collapse the whitespace damage that PDF text extraction leaves."""
    s = unicodedata.normalize("NFKC", s or "")
    s = s.replace("­", "").replace("-\n", "")
    s = re.sub(r"\s+", " ", s).strip()
    return s[:limit] if limit else s


def slug(s, n=60):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return (s[:n].rstrip("-") or "untitled")


def read_pdf(path):
    """Return (front_matter_text, full_text). Front matter carries the
    citation; the full text is only used for classification."""
    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    return "\n".join(pages[:3]), "\n".join(pages), len(reader.pages)


def guess_title(front, filename):
    """The title is usually the first substantial line above the authors.
    Falls back to the filename, which is often the citation anyway."""
    for raw in front.split("\n"):
        line = clean(raw)
        low = line.lower()
        if len(line) < 25 or len(line) > 300:
            continue
        if any(w in low for w in (
                "doi", "http", "copyright", "©", "licensee", "creative commons",
                "received", "accepted", "published", "citation:", "issn",
                "www.", "@", "all rights reserved", "open access")):
            continue
        if sum(c.isdigit() for c in line) > len(line) * 0.25:
            continue
        return line
    stem = re.sub(r"^[0-9a-f]{6,}[-_]", "", Path(filename).stem)
    return clean(stem.replace("_", " ").replace("-", " "), 300)


def guess_authors(front, title):
    """Look just below the title for a line that reads like an author list."""
    lines = [clean(l) for l in front.split("\n")]
    start = 0
    for i, l in enumerate(lines):
        if l and title[:40].lower() in l.lower():
            start = i + 1
            break
    for l in lines[start:start + 8]:
        if not l or len(l) > 320:
            continue
        if re.search(r"\b(university|department|clinic|institute|hospital|faculty)\b", l, re.I):
            continue
        commas = l.count(",")
        initials = len(re.findall(r"\b[A-Z]\.", l))
        superscripts = len(re.findall(r"\d", l))
        if (commas >= 1 or initials >= 1) and superscripts <= 12 and re.search(r"[A-Za-z]{3}", l):
            return re.sub(r"\s*\d+\s*", " ", l).strip(" ,;*")
    return ""


def guess_journal(front):
    low = front.lower()
    for j in sorted(JOURNALS, key=len, reverse=True):
        if j.lower() in low:
            return j
    m = re.search(
        r"\b((?:International |European |American )?(?:Journal|Zeitschrift|Revue)"
        r"(?: of)?[A-Za-z&\s,]{3,60})", front)
    return clean(m.group(1), 120) if m else ""


def guess_year(front, full):
    for text in (front, full[:6000]):
        m = re.search(r"(?:©|copyright|published[:\s]+|\(\s*)((?:19[89]|20[0-4])\d)", text, re.I)
        if m:
            return m.group(1)
        years = YEAR_RE.findall(text)
        if years:
            # the latest plausible year in the front matter is usually publication
            return max(years)
    return ""


def guess_designs(full):
    low = clean(full).lower()
    hits = [name for name, pat in DESIGNS if re.search(pat, low, re.I)]
    return hits


def guess_topics(full):
    """Indications and endpoints, so the library is searchable the way a rep
    asks: by procedure and by what was measured."""
    low = clean(full).lower()
    return [name for name, pat in TOPICS if re.search(pat, low, re.I)]


def find_products(full):
    """Whole-word matching only, so 'maxgraft' does not match inside a
    longer token and ordinary words are not read as brands."""
    text = clean(full)
    low = text.lower()

    def present(name):
        return re.search(r"(?<![A-Za-z0-9])" + re.escape(name) + r"(?![A-Za-z0-9])", low) is not None

    def trademarked(name):
        # the word followed by ®, ™ or (R) within a couple of characters
        return re.search(re.escape(name) + r"\s*(?:®|™|\(r\))", low, re.I) is not None

    ours, theirs = [], []
    for name in BOTISS:
        if present(name) and not any(name in o for o in ours):
            ours.append(name)
    for name in COMPETITORS:
        if present(name) and not any(name in o for o in theirs):
            theirs.append(name)
    for name in AMBIGUOUS_COMPETITORS:
        if trademarked(name) and name not in theirs:
            theirs.append(name)
    return ours, theirs


def find_quote(full):
    """Prefer the authors' own conclusion, else the abstract. Verbatim."""
    text = clean(full)
    m = CONCLUSION_RE.search(text)
    if m and len(clean(m.group(1))) > 80:
        return "Conclusion (verbatim): " + clean(m.group(1), 900)
    m = ABSTRACT_RE.search(text)
    if m:
        return "Abstract (verbatim): " + clean(m.group(2), 1200)
    return ""


# --------------------------------------------------------------------------

NEEDS_SCOPE = ("SCOPE NOT YET WRITTEN — do not cite until a human states what this "
               "reference may support. Bibliographic data was extracted mechanically "
               "from the PDF; the text below is the paper's own words, not a summary. ")


def build_entry(path, existing_dois, existing_titles):
    front, full, pages = read_pdf(path)
    if len(clean(full)) < 400:
        return None, {"file": path.name, "issue": "almost no extractable text — likely a scan, needs OCR"}

    title = guess_title(front, path.name)
    doi = ""
    m = DOI_RE.search(front) or DOI_RE.search(full[:20000])
    if m:
        doi = m.group(0).rstrip(".,;)")
    pmid = ""
    m = PMID_RE.search(full[:20000])
    if m:
        pmid = "PMID:" + m.group(1)

    ident = " · ".join(x for x in (("doi:" + doi) if doi else "", pmid) if x)
    designs = guess_designs(full)
    topics = guess_topics(full)
    ours, theirs = find_products(full)
    quote = find_quote(full)
    year = guess_year(front, full)
    journal = guess_journal(front)
    authors = guess_authors(front, title)

    dup = None
    if doi and doi.lower() in existing_dois:
        dup = "DOI already in the library"
    elif slug(title) in existing_titles:
        dup = "a very similar title is already in the library"

    ident_or_none = ident or "no DOI or PMID found in the PDF"
    entry = {
        "title": title,
        "authors": authors or "not extracted — check the PDF",
        "journal": journal or "not extracted — check the PDF",
        "year": year or "not extracted",
        "identifier": ident_or_none,
        "studyType": designs[0] if designs else "not classified — read the PDF",
        "product": ", ".join(ours) if ours else "no botiss product named in the text",
        "supports": NEEDS_SCOPE + (quote or "No abstract or conclusion could be extracted."),
        "verifiedBy": "",
        "rep": "bulk import from published PDFs",
        "via": "import",
        "sourceFile": path.name,
        "pages": pages,
        "designsDetected": designs,
        "topics": topics,
        "competitorsNamed": theirs,
    }

    flags = []
    if not authors:
        flags.append("authors not extracted")
    if not journal:
        flags.append("journal not extracted")
    if not year:
        flags.append("year not extracted")
    if not ident:
        flags.append("no DOI or PMID")
    if not designs:
        flags.append("design not classified")
    if not ours:
        flags.append("no botiss product named")
    if not quote:
        flags.append("no abstract or conclusion extracted")
    if len(designs) > 2:
        flags.append("several designs matched (%s) — pick the right one" % ", ".join(designs[:4]))
    if dup:
        flags.append(dup)

    return entry, ({"file": path.name, "id": None, "issues": flags} if flags else None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf_dir")
    ap.add_argument("--out", default="out")
    ap.add_argument("--existing", help="JSON array of the records already in the library")
    args = ap.parse_args()

    pdfs = sorted(Path(args.pdf_dir).rglob("*.pdf"))
    if not pdfs:
        sys.exit("no PDFs under " + args.pdf_dir)

    existing_dois, existing_titles = set(), set()
    if args.existing and os.path.exists(args.existing):
        for r in json.load(open(args.existing)):
            ident = (r.get("identifier") or "").lower()
            m = DOI_RE.search(ident)
            if m:
                existing_dois.add(m.group(0))
            existing_titles.add(slug(r.get("title", "")))

    out = Path(args.out)
    (out / "entries").mkdir(parents=True, exist_ok=True)
    (out / "batches").mkdir(parents=True, exist_ok=True)

    entries, review, failed, used = [], [], [], set()
    for path in pdfs:
        try:
            entry, issue = build_entry(path, existing_dois, existing_titles)
        except Exception as e:
            failed.append({"file": path.name, "issue": "extraction failed: %s" % e})
            continue
        if entry is None:
            failed.append(issue)
            continue

        base = slug(entry["title"], 50)
        year = entry["year"] if entry["year"].isdigit() else "nd"
        eid, n = "%s-%s" % (base, year), 2
        while eid in used:
            eid, n = "%s-%s-%d" % (base, year, n), n + 1
        used.add(eid)

        (out / "entries" / (eid + ".json")).write_text(json.dumps(entry, indent=1, ensure_ascii=False))
        entries.append((eid, entry))
        if issue:
            issue["id"] = eid
            review.append(issue)

    # write_db takes at most 50 writes per batch
    for i in range(0, len(entries), 50):
        chunk = entries[i:i + 50]
        (out / "batches" / ("batch-%d.json" % (i // 50 + 1))).write_text(json.dumps([{
            "op": "set", "collection": "evidence", "doc_id": eid,
            "file_path": str((out / "entries" / (eid + ".json")).resolve()),
        } for eid, _ in chunk], indent=1))

    by_design, by_product, by_topic = {}, {}, {}
    for _, e in entries:
        by_design[e["studyType"]] = by_design.get(e["studyType"], 0) + 1
        by_product[e["product"]] = by_product.get(e["product"], 0) + 1
        for t in e.get("topics", []):
            by_topic[t] = by_topic.get(t, 0) + 1

    lines = ["# Paper ingestion report", "",
             "PDFs found: **%d**  ·  entries built: **%d**  ·  unreadable: **%d**  ·  needing review: **%d**"
             % (len(pdfs), len(entries), len(failed), len(review)), "",
             "Every entry carries `supports` marked SCOPE NOT YET WRITTEN, holding the paper's own",
             "abstract or conclusion verbatim. That is deliberate: the scope statement is a judgement",
             "call and is not auto-generated. Write scope for the claim-critical papers first.", "",
             "## By study design", ""]
    for k, v in sorted(by_design.items(), key=lambda kv: -kv[1]):
        lines.append("- %s — **%d**" % (k, v))
    lines += ["", "## By botiss product named", ""]
    for k, v in sorted(by_product.items(), key=lambda kv: -kv[1]):
        lines.append("- %s — **%d**" % (k, v))
    lines += ["", "## By indication and endpoint", "",
              "Use this to see where the library is thin. A product with no papers under",
              "an indication is a claim the science desk will refuse to support.", ""]
    for k, v in sorted(by_topic.items(), key=lambda kv: -kv[1]):
        lines.append("- %s — **%d**" % (k, v))
    lines += ["", "## Batches to write", ""]
    for p in sorted((out / "batches").glob("*.json")):
        lines.append("- `%s` (%d writes)" % (p.name, len(json.load(open(p)))))
    (out / "report.md").write_text("\n".join(lines) + "\n")

    rl = ["# Needs a human before use", ""]
    if failed:
        rl += ["## Could not be read", ""]
        rl += ["- **%s** — %s" % (f["file"], f["issue"]) for f in failed] + [""]
    if review:
        rl += ["## Extracted, but with gaps", ""]
        for r in review:
            rl.append("- **%s** (`%s`) — %s" % (r["file"], r["id"], "; ".join(r["issues"])))
    (out / "review.md").write_text("\n".join(rl) + "\n")

    print("entries: %d   unreadable: %d   need review: %d" % (len(entries), len(failed), len(review)))
    print("wrote %s/report.md, %s/review.md, %d batch file(s)"
          % (out, out, len(list((out / "batches").glob("*.json")))))


if __name__ == "__main__":
    main()
