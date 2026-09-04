#!/usr/bin/env python3
"""Parse botiss "Most Relevant Publications" literature lists into
evidence-library entries.

These lists are Medical Affairs curated and far richer than a bare
bibliography: each numbered entry carries the title, the full citation, a
DOI or PubMed link, and the paper's own abstract — usually structured, with
a Conclusions section. They are also already sorted into "Pre-clinical
(in vitro & in vivo) studies" and "Clinical studies and case series", which
is botiss's own design classification and better than guessing.

So `supports` here records the authors' conclusion VERBATIM. It is still not
a sales scope statement: what a rep may say has to pass the claim tiers, and
the field says so. Nothing is paraphrased.

Usage:
    python3 tools/parse_literature_lists.py <txt-dir> --out out
      where <txt-dir> holds one .txt per list, named lit_<product>.txt

Outputs:
    entries/<id>.json     one record per publication
    all-entries.json      portable, for tools/materialise-entries.js
    report.md             counts by product, section and design
    review.md             entries the parser is unsure about
"""

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

# Map the file stem to the product string recorded on every entry.
PRODUCTS = {
    "lit_jason": "Jason membrane (porcine pericardium)",
    "lit_collprotect": "collprotect (porcine dermis)",
    "lit_permamem": "permamem (dense PTFE)",
    "lit_novamag": "NOVAMag (magnesium membrane, screw, SHIELD)",
    "lit_mucoderm": "mucoderm (porcine collagen soft-tissue matrix)",
    "lit_collacone": "collacone / collafleece (collagen cone and fleece)",
    "lit_ceraboneplus": "cerabone plus (bovine bone with hyaluronate)",
    "lit_maxresorb": "maxresorb / maxresorb inject (biphasic CaP)",
}

SECTION_RE = re.compile(
    r"^\s*\d?\.?\s*((?:Pre-?clinical\s*\(in vitro (?:&|and) in vivo\)\s*studies)"
    r"|(?:Clinical studies and case series))\s*$", re.I)
PAGEREF_RE = re.compile(r"\(p\.\s*\d+", re.I)
HEADER_RE = re.compile(r"^\s*Most Relevant Publications", re.I)
ENTRY_RE = re.compile(r"^\s*(\d{1,3})\.\s+(?=\S)")
URL_RE = re.compile(r"https?://\S+")

# Where the author list begins. The title runs up to this point, and the
# citation from it. Author lists in these lists take three shapes:
#   "Surname, I., Surname, I." · "Surname AB, Surname C" · "Firstname Surname,"
AUTHOR_START_RE = re.compile(
    r"(?:[A-ZÀ-Ý][A-Za-zÀ-ÿ'’’\-]{1,24},\s*[A-Z]\.)"          # Surname, I.
    r"|(?:[A-ZÀ-Ý][A-Za-zÀ-ÿ'’’\-]{1,24}\s+[A-Z]{1,4}\s*[,;.](?=\s))"  # Surname AB,
    r"|(?:[A-ZÀ-Ý][a-zà-ÿ'’’\-]{2,20}\s+[A-ZÀ-Ý][A-Za-zà-ÿ'’’\-]{2,24},\s*[A-ZÀ-Ý])"  # Firstname Surname,
)

# A line that reads like a citation rather than a title.
CITE_RE = re.compile(
    r"(\(\s*(?:19|20)\d{2}\s*\))"          # APA: (2026).
    r"|(\b(?:19|20)\d{2}\s+[A-Z][a-z]{2}\b)"   # PubMed: 2025 Nov
    r"|(\b(?:19|20)\d{2}\s*;\s*\d+)"           # 2025;15(1)
    r"|(\bdoi:\s*10\.)"
    r"|(\b\d+\s*\(\s*\d+\s*\)\s*(?::|,)\s*[A-Za-z]?\d)"  # 27(4):e70075
)
YEAR_RE = re.compile(r"\b((?:19|20)\d{2})\b")
DOI_RE = re.compile(r"\b10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", re.I)
PMID_URL_RE = re.compile(r"pubmed\.ncbi\.nlm\.nih\.gov/(\d+)")
PMC_RE = re.compile(r"(PMC\d{6,9})")

CONCLUSION_RE = re.compile(
    r"\bconclusions?\b\s*[:.\-]?\s*(.{60,1400}?)"
    r"(?=\s*(?:keywords?|clinical relevance|clinical significance|trial registration|"
    r"acknowledge?ments|conflicts? of interest|funding|references)\b|\Z)",
    re.I | re.S)

# Design refinement inside a section. First match wins.
DESIGNS = [
    # Posters and congress abstracts are not peer-reviewed papers, and the
    # distinction matters more than the study type printed in their title.
    ("Poster or congress abstract (not peer reviewed)",
     r"\bposter\b|osteology (barcelona|monaco|congress)|\bcongress abstract\b|"
     r"\bconference abstract\b|\beao congress\b"),
    ("Systematic review or meta-analysis", r"systematic review|meta-?analys[ei]s|prisma"),
    ("Randomised controlled trial", r"randomi[sz]ed controlled|randomi[sz]ed clinical trial|"
                                    r"\brct\b|randomly (assigned|allocated)|split-?mouth randomi"),
    ("Controlled clinical trial", r"controlled (clinical )?(trial|study)|comparative (clinical )?study"),
    ("Prospective clinical study", r"prospective"),
    ("Retrospective clinical study", r"retrospective|chart review"),
    ("Case series", r"case series|series of \d+|consecutive (patients|cases)"),
    ("Case report", r"case report|report of (a|one|two|three|four|five|\d+) cases?"),
    ("Animal / in vivo preclinical", r"\brats?\b|\brabbits?\b|beagle|\bdogs?\b|sheep|minipig|mini-?pig|"
                                     r"swine|calvaria|animal model|in vivo model|\bmice\b|\bmouse\b"),
    ("In vitro / cell culture", r"in vitro|cell culture|cultured|osteoblast-?like|saos-?2|\bu2os\b|"
                                r"cytotoxic|cell viability|fibroblast"),
    ("Material characterisation", r"scanning electron|surface roughness|contact angle|"
                                  r"surface free energy|tensile|x-?ray diffraction|physicochemical"),
    ("Histological / histomorphometric", r"histomorphometr|histolog"),
    ("Narrative review", r"\bthis review\b|narrative review|consensus"),
]


def clean(s):
    """Undo the worst of the PDF text-layer damage, without inventing text."""
    s = unicodedata.normalize("NFKC", s or "")
    s = s.replace("­", "")
    s = re.sub(r"(?<=[A-Za-z])\s+-\s+(?=[a-z])", "-", s)   # "Osteoblast -like"
    s = re.sub(r"(?<=[A-Za-z])-\s+(?=[a-z])", "-", s)      # "differ - ences"
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def squeeze(s):
    """Space-free copy, so keyword matching survives 'randomi zed'."""
    return re.sub(r"\s+", "", s).lower()


def slug(s, n=54):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return (s[:n].rstrip("-") or "untitled")


def strip_page_footers(lines):
    """Drop the PDF page number that sits beside each running header.

    It is a line of nothing but digits, and it lands directly against the
    end of the previous sentence once the block is collapsed to one line —
    so an abstract quoted verbatim ends "...confirmed histomorphometrically.
    61". The quotes are presented as the authors' own words, so a stray
    folio in one is a defect, not a cosmetic issue.

    A bare number is only treated as a folio when the nearest non-blank
    line on one side is the running header; a page range that happens to
    wrap onto its own line keeps its digits.
    """
    def neighbour(i, step):
        j = i + step
        while 0 <= j < len(lines) and not lines[j].strip():
            j += step
        return lines[j] if 0 <= j < len(lines) else ""

    out = []
    for i, line in enumerate(lines):
        if re.fullmatch(r"\s*\d{1,4}\s*", line) and (
                HEADER_RE.match(neighbour(i, -1)) or HEADER_RE.match(neighbour(i, 1))):
            continue
        out.append(line)
    return out


def split_entries(text):
    """Yield (section, entry_text). Section tracks the list's own headings.

    The hard part is telling an entry number from a citation that wraps
    mid-page-range — "...173-" then "178. doi: 10.xxx" on the next line —
    which reads as the start of entry 178 and silently cuts the real entry
    in half, stripping its DOI and abstract onto a bogus fragment. See the
    discriminator below.
    """
    lines = strip_page_footers(text.split("\n"))
    section, buf, num, expected = "", [], None, 1
    out = []

    def flush():
        if buf and num is not None:
            out.append((section, "\n".join(buf)))

    for raw in lines:
        line = raw.rstrip()
        if HEADER_RE.match(line):
            continue
        m = SECTION_RE.match(line)
        if m and not PAGEREF_RE.search(line):
            flush()
            buf.clear()
            num, expected = None, 1
            section = ("Pre-clinical" if re.match(r"pre-?clinical", m.group(1), re.I)
                       else "Clinical")
            continue
        em = ENTRY_RE.match(line)
        if em and not SECTION_RE.match(line):
            n = int(em.group(1))
            rest = line[em.end():].lstrip()
            # The discriminator is what FOLLOWS the number, not the number
            # itself: a real entry is followed by a title, a wrapped citation
            # by "doi:", a URL, or more of the citation. Requiring the numbers
            # to run in sequence was tried and is worse — one number lost to a
            # page break desynchronises the counter and swallows the rest of
            # the list as body text.
            #
            # Rejecting every rest that starts with a digit was also tried and
            # is wrong: "3D-Printed Soft Membrane" and "2-year follow-up" are
            # titles. A digit only continues a citation when punctuation or
            # another number follows it ("178. doi:", "173- 178", "16(4)"),
            # never when a letter does.
            plausible = not re.match(
                r"(?:doi:|https?://|pp?\.\s"   # DOI, URL, explicit page marker
                r"|\d+\s*[-–]\s*\d"           # "173- 178"  page range
                r"|\d+\s*[.,;:()]"             # "178."  "16(4)"  volume/pages
                r"|\d+\s*$)",                  # a bare number, alone on a line
                rest, re.I)
            if plausible:
                flush()
                buf = [rest]
                num, expected = n, n + 1
                continue
            # otherwise it is a wrapped page range or volume: body text
        if num is not None:
            buf.append(line)

    flush()
    return out


def parse_entry(section, block, product):
    urls = URL_RE.findall(block)
    pre = URL_RE.split(block)[0]
    post = block[len(pre):] if len(block) > len(pre) else ""
    post = URL_RE.sub(" ", post)

    # Split title from citation where the AUTHOR LIST starts, not at a line
    # break: extraction wraps titles and author lists onto shared lines, so a
    # line-based split drags author names into the title and truncates the
    # citation.
    flat = clean(pre)
    title, citation = flat, ""
    best = None
    for m in AUTHOR_START_RE.finditer(flat):
        if m.start() < 25:          # too early to be past the title
            continue
        best = m
        break
    if best:
        title = flat[:best.start()]
        citation = flat[best.start():]
    else:
        m = CITE_RE.search(flat)
        if m:
            back = flat.rfind(". ", 0, m.start())
            title = flat[:back + 1] if back > 25 else flat[:m.start()]
            citation = flat[len(title):]

    title = title.strip().rstrip(" .;,")
    citation = citation.strip()
    abstract = clean(post)

    ident = []
    m = DOI_RE.search(block)
    if m:
        ident.append("doi:" + m.group(0).rstrip(".,;)"))
    m = PMID_URL_RE.search(block)
    if m:
        ident.append("PMID:" + m.group(1))
    m = PMC_RE.search(block)
    if m and not ident:
        ident.append(m.group(1))
    if not ident and urls:
        ident.append(urls[0].rstrip(".,);"))

    # A volume or page number can look like a year, so only accept plausible
    # publication years and prefer the one nearest the front of the citation.
    cands = [int(y) for y in (YEAR_RE.findall(citation) or YEAR_RE.findall(pre))]
    cands = [y for y in cands if 1980 <= y <= 2027]
    year = str(cands[0]) if cands else ""

    # "more randomized trials are needed" is a call for future work, not a
    # description of this study. Left in, it promotes posters and case series
    # to RCTs, which is precisely how a rep ends up overclaiming.
    hay = clean(citation + " " + title + " " + abstract).lower()
    hay = re.sub(
        r"(randomi[sz]ed[^.;]{0,40}|controlled[^.;]{0,30}|prospective[^.;]{0,30}|"
        r"systematic review[^.;]{0,30})\b(are|is|were|would be|will be)\s+"
        r"(needed|warranted|required|necessary|desirable|recommended|encouraged)", " ", hay)
    hay = re.sub(r"(further|future|additional|more)\s+(randomi[sz]ed|controlled|prospective|"
                 r"clinical|comparative|long-?term)[^.;]{0,60}", " ", hay)
    sq = squeeze(citation + " " + title + " " + abstract)
    design = ""
    for name, pat in DESIGNS:
        if re.search(pat, hay, re.I) or re.search(re.sub(r"[\\\s]|\\b", "", pat), sq, re.I):
            design = name
            break
    if not design:
        design = ("Preclinical, design not stated" if section == "Pre-clinical"
                  else "Clinical, design not stated")
    if section == "Pre-clinical" and design in (
            "Randomised controlled trial", "Controlled clinical trial",
            "Prospective clinical study", "Retrospective clinical study"):
        # the list's own section wins over a keyword in an abstract
        design = "Animal / in vivo preclinical" if re.search(
            r"\brats?\b|\brabbits?\b|\bdogs?\b|sheep|minipig|swine|\bmice\b", hay, re.I) \
            else "In vitro / cell culture"

    m = CONCLUSION_RE.search(abstract)
    if m:
        quote = "Authors' conclusion, verbatim: “" + clean(m.group(1)).rstrip(" .") + "”"
    elif abstract:
        quote = "Abstract, verbatim (no separate conclusion section): “" + abstract[:900].rstrip() + "”"
    else:
        quote = "No abstract text was included in the list for this entry."

    supports = (
        section + " study from the botiss " + product + " literature list — the product featured "
        "in it, which is not the same as the study being about the product, so check the design and "
        "the comparator before citing it as product evidence. " + quote +
        " This records what the paper says, not what a rep may say: the sales wording still has to "
        "pass the claim tiers, and a study in one indication licenses nothing in another.")

    flags = []
    if len(title) < 20:
        flags.append("title looks wrong or truncated")
    if not citation:
        flags.append("no citation line found")
    if not year:
        flags.append("no year found")
    if not ident:
        flags.append("no DOI, PMID or link")
    if not abstract:
        flags.append("no abstract text")

    return {
        "title": title,
        "authors": citation or "citation not parsed — check the list",
        "journal": "",           # the citation string carries it as printed
        "year": year or "not stated",
        "identifier": " · ".join(ident) or "no identifier in the list",
        "studyType": design,
        "product": product,
        "supports": supports,
        "verifiedBy": "botiss Medical Affairs (product literature list)",
        "rep": "Branko T. · botiss literature lists",
        "via": "import",
    }, flags


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("txt_dir")
    ap.add_argument("--out", default="out-lit")
    args = ap.parse_args()

    out = Path(args.out)
    (out / "entries").mkdir(parents=True, exist_ok=True)

    all_entries, review, used = [], [], set()
    per_product, per_design, per_section = {}, {}, {}

    for f in sorted(Path(args.txt_dir).glob("*.txt")):
        product = PRODUCTS.get(f.stem)
        if not product:
            print("skipping (unknown product): " + f.name, file=sys.stderr)
            continue
        text = f.read_text(encoding="utf-8")
        blocks = split_entries(text)
        kept = 0
        for section, block in blocks:
            if len(clean(block)) < 120:
                continue
            entry, flags = parse_entry(section or "Unclassified", block, product)
            if len(entry["title"]) < 12:
                review.append({"product": product, "id": None,
                               "issues": ["discarded: no usable title"],
                               "snippet": clean(block)[:120]})
                continue

            base = slug(entry["title"])
            yr = entry["year"] if entry["year"].isdigit() else "nd"
            eid, n = base + "-" + yr, 2
            while eid in used:
                eid, n = "%s-%s-%d" % (base, yr, n), n + 1
            used.add(eid)

            (out / "entries" / (eid + ".json")).write_text(
                json.dumps(entry, indent=1, ensure_ascii=False), encoding="utf-8")
            all_entries.append({"doc_id": eid, "data": entry})
            kept += 1
            per_product[product] = per_product.get(product, 0) + 1
            per_design[entry["studyType"]] = per_design.get(entry["studyType"], 0) + 1
            per_section[section] = per_section.get(section, 0) + 1
            if flags:
                review.append({"product": product, "id": eid, "issues": flags,
                               "snippet": entry["title"][:90]})
        print("%-52s %3d entries" % (product, kept))

    (out / "all-entries.json").write_text(
        json.dumps(all_entries, indent=1, ensure_ascii=False), encoding="utf-8")

    L = ["# botiss literature lists — parsed", "",
         "Publications parsed: **%d**  ·  flagged for review: **%d**" % (len(all_entries), len(review)), "",
         "Every entry is Medical Affairs curated (it came from an official product literature list),",
         "and `supports` holds the authors' own conclusion verbatim. Nothing is paraphrased.", "",
         "## By product", ""]
    for k, v in sorted(per_product.items(), key=lambda kv: -kv[1]):
        L.append("- %s — **%d**" % (k, v))
    L += ["", "## By section (the list's own classification)", ""]
    for k, v in sorted(per_section.items(), key=lambda kv: -kv[1]):
        L.append("- %s — **%d**" % (k, v))
    L += ["", "## By refined study design", ""]
    for k, v in sorted(per_design.items(), key=lambda kv: -kv[1]):
        L.append("- %s — **%d**" % (k, v))
    (out / "report.md").write_text("\n".join(L) + "\n", encoding="utf-8")

    R = ["# Parsed, but worth a check", ""]
    for r in review:
        R.append("- **%s** — %s%s" % (r.get("id") or "(discarded)", "; ".join(r["issues"]),
                                      "  \n  `" + r["snippet"] + "`" if r.get("snippet") else ""))
    (out / "review.md").write_text("\n".join(R) + "\n", encoding="utf-8")

    print("\ntotal %d entries, %d flagged" % (len(all_entries), len(review)))


if __name__ == "__main__":
    main()
