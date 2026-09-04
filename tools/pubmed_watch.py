#!/usr/bin/env python3
"""Watch PubMed (or Europe PMC) for new literature and turn the hits into
evidence-library entries.

    python3 tools/pubmed_watch.py --out out --existing reference/library-snapshot.json

Why this runs OUTSIDE the app
-----------------------------
The desk is a Claude Artifact. The artifact runtime's CSP blocks every
fetch, XHR and WebSocket the page could make, to any host, so the agents
cannot call PubMed themselves and no amount of in-page code changes that.
The only route from inside the page to anything external is the `mcp`
capability, which reaches the *viewer's* claude.ai connectors — and none of
the connectors on this organisation serves literature. So the feed is a
pipeline: this script runs where there is network access, and a Claude Code
session writes the batches into the shared store with the Artifact tool.

That split is also the safer design. Nothing here asks a language model
what a paper says: identifiers, titles, authors, journals, years and
publication types are read straight out of the structured record, and the
abstract is carried verbatim. A citation this pipeline produces can be
checked against the source, which is the whole point of the library.

What it deliberately does NOT do
--------------------------------
- It does not decide what a paper licenses. Every entry lands with
  `supports` marked NOT REVIEWED, wrapping the abstract verbatim.
- It does not mark anything Medical Affairs approved. Entries carry
  `via: "pubmed"`, which the desk treats as a lead, not a citation, and
  refuses to quote until a person reviews it.
- It does not guess the product. A brand is recorded only where the paper
  names it; otherwise the field says so. Most xenograft literature was run
  on Bio-Oss, and inferring "cerabone" from a query term would manufacture
  exactly the confusion the library exists to prevent.
"""

import argparse
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ingest_papers import BOTISS, COMPETITORS, clean, find_products, slug  # noqa: E402

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
EUROPEPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"

# NCBI asks every caller to identify itself and to stay under 3 requests a
# second without an API key, 10 with one.
TOOL_NAME = "botiss-ci-desk"
SLEEP_NO_KEY = 0.4
SLEEP_WITH_KEY = 0.12

# PubMed's own PublicationType strings, mapped onto the study-design
# wording the app's evidenceRank() already sorts by. Taking the design from
# the indexed record rather than from keywords in the abstract is the one
# place this pipeline is strictly better than reading a PDF.
PUBTYPE_MAP = [
    ("Meta-Analysis", "Systematic review / meta-analysis"),
    ("Systematic Review", "Systematic review / meta-analysis"),
    ("Randomized Controlled Trial", "Randomised controlled trial"),
    ("Controlled Clinical Trial", "Controlled clinical trial"),
    ("Clinical Trial", "Clinical trial"),
    ("Multicenter Study", "Clinical, multicentre"),
    ("Observational Study", "Clinical, observational cohort"),
    ("Comparative Study", "Clinical, comparative"),
    ("Case Reports", "Case report"),
    ("Review", "Narrative review (not primary evidence)"),
    ("Editorial", "Editorial (not evidence)"),
    ("Letter", "Letter (not evidence)"),
    ("Comment", "Comment (not evidence)"),
]

DEFAULT_TERMS = {
    # Our own brands. A hit here is the strongest kind of lead: the paper
    # names the product.
    "products": [b for b in BOTISS if b != "botiss"],
    # Named competitors, for the commercial desk's comparison questions.
    "competitors": COMPETITORS,
    # Indications, so a relevant paper that names no brand still surfaces.
    "indications": [
        "guided bone regeneration dental",
        "alveolar ridge preservation",
        "sinus floor elevation graft",
        "barrier membrane dehiscence dental",
        "socket preservation xenograft",
        "bone block augmentation allograft",
        "soft tissue graft substitute matrix",
        "magnesium membrane bone regeneration",
        "hyaluronic acid bone substitute",
        "peri-implantitis regenerative",
    ],
}


def log(msg):
    print(msg, file=sys.stderr)


def fetch(url, tries=4):
    """GET with backoff. A watcher that dies on one 429 is not a watcher."""
    last = None
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": TOOL_NAME})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            last = e
            code = getattr(e, "code", None)
            if code and code not in (429, 500, 502, 503, 504):
                raise
            wait = 2 ** n
            log("  retrying in %ds (%s)" % (wait, e))
            time.sleep(wait)
    raise SystemExit(
        "gave up on %s\n  last error: %s\n"
        "If this is a blocked-egress error rather than a rate limit, run this "
        "script somewhere with access to the host instead — see the module "
        "docstring." % (url, last))


# --------------------------------------------------------------------------
# PubMed
# --------------------------------------------------------------------------

def pubmed_search(term, since, api_key, retmax):
    q = {
        "db": "pubmed", "term": term, "retmode": "json", "retmax": str(retmax),
        "sort": "date", "tool": TOOL_NAME,
    }
    if since:
        q["mindate"] = since.replace("-", "/")
        q["maxdate"] = "3000/01/01"
        q["datetype"] = "edat"      # when PubMed added it, not the issue date
    if api_key:
        q["api_key"] = api_key
    data = json.loads(fetch(EUTILS + "esearch.fcgi?" + urllib.parse.urlencode(q)))
    res = data.get("esearchresult", {})
    return res.get("idlist", []), int(res.get("count", 0))


def pubmed_fetch(pmids, api_key):
    q = {"db": "pubmed", "id": ",".join(pmids), "retmode": "xml", "tool": TOOL_NAME}
    if api_key:
        q["api_key"] = api_key
    return ET.fromstring(fetch(EUTILS + "efetch.fcgi?" + urllib.parse.urlencode(q)))


def text_of(node):
    """Flatten an element's text, including the italic and sup tags PubMed
    uses inside titles and abstracts."""
    return clean("".join(node.itertext())) if node is not None else ""


def parse_pubmed_article(art):
    cit = art.find("MedlineCitation")
    if cit is None:
        return None
    pmid = text_of(cit.find("PMID"))
    a = cit.find("Article")
    if a is None:
        return None

    title = text_of(a.find("ArticleTitle")).rstrip(".")

    authors = []
    for au in a.findall("./AuthorList/Author"):
        last, init = text_of(au.find("LastName")), text_of(au.find("Initials"))
        coll = text_of(au.find("CollectiveName"))
        if last:
            authors.append((last + " " + init).strip())
        elif coll:
            authors.append(coll)

    journal = (text_of(a.find("./Journal/ISOAbbreviation"))
               or text_of(a.find("./Journal/Title")))

    year = (text_of(a.find("./Journal/JournalIssue/PubDate/Year"))
            or (text_of(a.find("./Journal/JournalIssue/PubDate/MedlineDate"))[:4]))
    if not re.fullmatch(r"(19|20)\d{2}", year or ""):
        year = ""

    # Abstracts come in labelled sections (Background/Methods/Results). Keep
    # the labels: they are how a reviewer finds the endpoint quickly.
    parts = []
    for seg in a.findall("./Abstract/AbstractText"):
        label = seg.get("Label") or seg.get("NlmCategory") or ""
        body = text_of(seg)
        if body:
            parts.append((label.title() + ": " + body) if label else body)
    abstract = clean(" ".join(parts))

    doi = pmcid = ""
    for aid in art.findall("./PubmedData/ArticleIdList/ArticleId"):
        if aid.get("IdType") == "doi":
            doi = text_of(aid).lower()
        elif aid.get("IdType") == "pmc":
            pmcid = text_of(aid)

    pubtypes = [text_of(t) for t in a.findall("./PublicationTypeList/PublicationType")]

    return {
        "pmid": pmid, "doi": doi, "pmcid": pmcid, "title": title,
        "authors": authors, "journal": journal, "year": year,
        "abstract": abstract, "pubtypes": [p for p in pubtypes if p],
    }


# --------------------------------------------------------------------------
# Europe PMC — same shape, for networks that allow EBI but not NCBI
# --------------------------------------------------------------------------

def europepmc_search(term, since, retmax):
    query = term
    if since:
        query += ' AND (FIRST_INDEX_DATE:[%s TO 3000-01-01])' % since
    q = {"query": query, "format": "json", "pageSize": str(min(retmax, 100)),
         "resultType": "core", "sort": "P_PDATE_D desc"}
    data = json.loads(fetch(EUROPEPMC + "?" + urllib.parse.urlencode(q)))
    hits = data.get("resultList", {}).get("result", [])
    out = []
    for h in hits:
        out.append({
            "pmid": str(h.get("pmid") or ""),
            "doi": str(h.get("doi") or "").lower(),
            "pmcid": str(h.get("pmcid") or ""),
            "title": clean(str(h.get("title") or "")).rstrip("."),
            # Europe PMC gives one pre-joined string, not a list.
            "authors": [clean(str(h.get("authorString") or "")).rstrip(".")],
            "journal": clean(str(h.get("journalTitle") or "")),
            "year": str(h.get("pubYear") or ""),
            "abstract": clean(str(h.get("abstractText") or "")),
            "pubtypes": [clean(t) for t in (h.get("pubTypeList", {}) or {}).get("pubType", [])],
        })
    return out, int(data.get("hitCount", 0))


# --------------------------------------------------------------------------
# Record building
# --------------------------------------------------------------------------

def study_type(rec):
    for needle, wording in PUBTYPE_MAP:
        if any(needle.lower() == p.lower() for p in rec["pubtypes"]):
            return wording, []
    for needle, wording in PUBTYPE_MAP:
        if any(needle.lower() in p.lower() for p in rec["pubtypes"]):
            return wording, []
    # No indexed publication type worth using. Say so rather than reading a
    # design out of the abstract's wording, which is how a poster became an
    # RCT in the literature-list parser.
    return ("Design not stated in the indexed record"
            + (" (" + "; ".join(rec["pubtypes"][:3]) + ")" if rec["pubtypes"] else ""),
            ["design not indexed — classify by hand"])


def product_field(rec, term, bucket):
    ours, theirs = find_products(rec["title"] + " " + rec["abstract"])
    if ours:
        return ", ".join(ours), []
    if theirs:
        return "competitor product named: " + ", ".join(theirs), []
    if bucket == "products":
        # The query matched the record somewhere PubMed indexes but the
        # title and abstract do not name the brand. Do not promote the
        # query term to a product.
        return ("not named in the title or abstract — found by the query “%s”, "
                "so check the full text before treating this as %s evidence" % (term, term),
                ["product not named in the abstract"])
    return "not determined from the abstract", []


def build_entry(rec, term, bucket, source, today):
    flags = []
    design, f = study_type(rec)
    flags += f
    product, f = product_field(rec, term, bucket)
    flags += f

    ids = []
    if rec["doi"]:
        ids.append("doi:" + rec["doi"])
    if rec["pmid"]:
        ids.append("PMID:" + rec["pmid"])
    if rec["pmcid"]:
        ids.append(rec["pmcid"])
    if not ids:
        flags.append("no DOI and no PMID")

    if rec["abstract"]:
        quote = 'Abstract, verbatim: “' + rec["abstract"][:2400] + '”'
    else:
        quote = "No abstract in the indexed record."
        flags.append("no abstract")

    authors = ", ".join(rec["authors"][:12])
    if len(rec["authors"]) > 12:
        authors += ", et al"

    entry = {
        "title": rec["title"][:260] or "untitled",
        "authors": authors[:300] or "authors not in the indexed record",
        "journal": rec["journal"][:160],
        "year": rec["year"] or "not stated",
        "identifier": " · ".join(ids) or "no identifier in the record",
        "studyType": design[:90],
        "product": product[:200],
        "supports": (
            "NOT REVIEWED — this reference was added automatically by the "
            + source + " watch on " + today + " from the query “" + term + "”. "
            "Nobody at botiss has read it, confirmed which product it was run on, "
            "or decided what it licenses, so it is not citable. " + quote
        )[:3000],
        # Deliberately empty. A feed cannot verify anything.
        "verifiedBy": "",
        "product_bucket": bucket,
        "via": source,
        "retrieved": today,
        "query": term,
        "rep": source + " watch",
        "ts": int(time.time() * 1000),
    }
    return entry, flags


# --------------------------------------------------------------------------

def norm_title(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def load_existing(path):
    dois, pmids, titles = set(), set(), set()
    if not path or not Path(path).exists():
        return dois, pmids, titles
    for r in json.loads(io.open(path, encoding="utf-8").read()):
        ident = str(r.get("identifier") or "")
        for m in re.finditer(r"10\.\d{4,9}/[^\s·]+", ident.lower()):
            dois.add(m.group(0).rstrip(".,;)"))
        for m in re.finditer(r"pmid[:\s]*(\d{6,9})", ident, re.I):
            pmids.add(m.group(1))
        t = norm_title(r.get("title"))
        if t:
            titles.add(t)
    return dois, pmids, titles


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="out-watch")
    ap.add_argument("--existing", help="reference/library-snapshot.json, to dedupe against")
    ap.add_argument("--terms", help="JSON file of {bucket: [term, ...]}; default is built in")
    ap.add_argument("--since", help="YYYY-MM-DD; default is the last run recorded in --out")
    ap.add_argument("--source", choices=["pubmed", "europepmc"], default="pubmed")
    ap.add_argument("--api-key", default=os.environ.get("NCBI_API_KEY", ""),
                    help="NCBI API key; raises the rate limit from 3/s to 10/s")
    ap.add_argument("--retmax", type=int, default=50, help="hits per term (default 50)")
    ap.add_argument("--buckets", help="comma-separated subset, e.g. products,competitors")
    args = ap.parse_args()

    out = Path(args.out)
    (out / "entries").mkdir(parents=True, exist_ok=True)
    state_path = out / "state.json"

    terms = (json.loads(io.open(args.terms, encoding="utf-8").read())
             if args.terms else DEFAULT_TERMS)
    if args.buckets:
        keep = {b.strip() for b in args.buckets.split(",")}
        terms = {k: v for k, v in terms.items() if k in keep}
        if not terms:
            raise SystemExit("no bucket matched --buckets")

    state = json.loads(io.open(state_path, encoding="utf-8").read()) if state_path.exists() else {}
    since = args.since or state.get("last_run")
    today = date.today().isoformat()
    if since:
        log("watching %s for records indexed since %s" % (args.source, since))
    else:
        log("no --since and no previous run recorded: this first pass will return "
            "the whole back catalogue for each term, which is a lot. Consider "
            "--since %s to start from recent records only." % today)

    dois, pmids, titles = load_existing(args.existing)
    log("deduping against %d DOIs, %d PMIDs and %d titles already in the library"
        % (len(dois), len(pmids), len(titles)))

    sleep = SLEEP_WITH_KEY if args.api_key else SLEEP_NO_KEY
    all_entries, review, used = [], [], set()
    seen_this_run = set()
    per_bucket, per_term_counts = {}, {}
    skipped_known = 0

    for bucket, term_list in terms.items():
        for term in term_list:
            try:
                if args.source == "pubmed":
                    ids, total = pubmed_search(term, since, args.api_key, args.retmax)
                    time.sleep(sleep)
                    recs = []
                    for i in range(0, len(ids), 100):
                        root = pubmed_fetch(ids[i:i + 100], args.api_key)
                        for art in root.findall(".//PubmedArticle"):
                            r = parse_pubmed_article(art)
                            if r:
                                recs.append(r)
                        time.sleep(sleep)
                else:
                    recs, total = europepmc_search(term, since, args.retmax)
                    time.sleep(sleep)
            except SystemExit:
                raise
            except Exception as e:                       # noqa: BLE001
                log("  %-44s FAILED (%s)" % (term, e))
                review.append({"product": term, "id": None,
                               "issues": ["query failed: %s" % e], "snippet": ""})
                continue

            kept = 0
            for rec in recs:
                key = rec["doi"] or ("pmid:" + rec["pmid"]) or norm_title(rec["title"])
                if not key or key in seen_this_run:
                    continue
                if (rec["doi"] and rec["doi"] in dois) or \
                   (rec["pmid"] and rec["pmid"] in pmids) or \
                   (norm_title(rec["title"]) in titles):
                    skipped_known += 1
                    seen_this_run.add(key)
                    continue
                seen_this_run.add(key)

                entry, flags = build_entry(rec, term, bucket, args.source, today)
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
                if flags:
                    review.append({"product": entry["product"][:60], "id": eid,
                                   "issues": flags, "snippet": entry["title"][:110]})

            per_bucket[bucket] = per_bucket.get(bucket, 0) + kept
            per_term_counts[term] = (kept, total)
            log("  %-44s %3d new  (%d indexed in total)" % (term[:44], kept, total))

    (out / "all-entries.json").write_text(
        json.dumps(all_entries, indent=1, ensure_ascii=False), encoding="utf-8")

    BATCH = 50
    (out / "batches").mkdir(exist_ok=True)
    for i in range(0, len(all_entries), BATCH):
        chunk = all_entries[i:i + BATCH]
        (out / "batches" / ("batch-%d.json" % (i // BATCH + 1))).write_text(
            json.dumps([{
                "op": "set", "collection": "evidence", "doc_id": e["doc_id"],
                "file_path": str((out / "entries" / (e["doc_id"] + ".json")).resolve()),
            } for e in chunk], indent=1), encoding="utf-8")

    report = [
        "# %s watch — %s" % (args.source, today), "",
        "Records indexed since: %s" % (since or "(no lower bound — full back catalogue)"),
        "",
        "New entries: **%d**. Already in the library, skipped: %d." % (len(all_entries), skipped_known),
        "",
        "Every entry lands as `via: \"%s\"` with an empty `verifiedBy` and "
        "`supports` marked NOT REVIEWED. The desk shows these as awaiting review "
        "and refuses to cite them. Reviewing one means reading the paper, setting "
        "`product` to what it was actually run on, writing the scope statement, "
        "and setting `verifiedBy`." % args.source,
        "", "## By bucket", "",
    ]
    for k, v in sorted(per_bucket.items(), key=lambda kv: -kv[1]):
        report.append("- %s: %d" % (k, v))
    report += ["", "## By term", "", "| term | new | indexed in total |", "|---|---:|---:|"]
    for t, (kept, total) in sorted(per_term_counts.items(), key=lambda kv: -kv[1][0]):
        report.append("| %s | %d | %d |" % (t, kept, total))
    (out / "report.md").write_text("\n".join(report) + "\n", encoding="utf-8")

    lines = ["# Needs a human before review can finish", ""]
    for r in review:
        lines.append("- **%s** — %s  " % (r["id"] or "(query)", "; ".join(r["issues"])))
        if r["snippet"]:
            lines.append("  `%s`" % r["snippet"])
    (out / "review.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    state_path.write_text(json.dumps({
        "last_run": today, "source": args.source,
        "previous_run": state.get("last_run"),
        "new_entries": len(all_entries), "skipped_known": skipped_known,
    }, indent=1), encoding="utf-8")

    n = (len(all_entries) + BATCH - 1) // BATCH
    log("")
    log("%d new entries, %d already known" % (len(all_entries), skipped_known))
    log("%d batch manifest(s) in %s" % (n, out / "batches"))
    log("read %s before writing anything" % (out / "review.md"))


if __name__ == "__main__":
    main()
