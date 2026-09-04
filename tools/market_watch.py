#!/usr/bin/env python3
"""Watch public product and price pages, and report what CHANGED.

    python3 tools/market_watch.py --sources reference/market-sources.json --out out-market

Same reason as the literature watch for living outside the app: the
artifact runtime blocks the page from making any network request, so this
runs where there is access and a Claude Code session writes the results
into the shared store.

What it produces
----------------
Two things, and neither is an answer:

1. `prices/*.json` — price CANDIDATES. Each one carries the URL, the
   fetch date, the HTTP status, and the surrounding sentence the number was
   read out of, so a person can confirm or reject it in seconds. They land
   with `via: "web"` and `confirmed: false`, and the commercial desk keeps
   them out of its verified layer and refuses to build a discount case on
   one.

2. `changes.md` — a diff against the previous run: pages whose price
   figures moved, product names that appeared or disappeared, pages that
   started returning an error. This is the part worth reading weekly. A
   competitor adding a product or moving a list price is the signal; the
   raw scrape is just how it is detected.

What it will not do
-------------------
- It will not invent a price. A number is reported only where it appears
  on the page, with the text around it.
- It will not fetch a path the site's robots.txt disallows for us, and it
  will not fetch a source that is not in the sources file. There is no
  crawl: it fetches exactly the URLs a person listed, once each.
- It will not log in, bypass a paywall, or fetch anything behind
  authentication.

Before you point this at a competitor's shop, that is a decision for
whoever owns commercial compliance at botiss, not for this script. Public
list prices are ordinary competitive intelligence, but automated
collection touches the site's terms of use. The sources file is empty by
design so nothing is fetched until someone puts a URL in it.
"""

import argparse
import hashlib
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

UA = "botiss-CI-Desk-market-watch/1.0 (+internal competitive intelligence; contact your botiss admin)"

# A currency amount: symbol-then-number or number-then-code, with the
# thousands and decimal separators used in the markets the team sells in.
PRICE_RE = re.compile(
    r"(?:(?P<sym>[€$£]|CHF|PLN|CZK|SEK|NOK|DKK|HUF|RON|GBP|EUR|USD)\s*"
    r"(?P<amt1>\d{1,3}(?:[.,   ]\d{3})*(?:[.,]\d{1,2})?)"
    r"|(?P<amt2>\d{1,3}(?:[.,   ]\d{3})*(?:[.,]\d{1,2})?)\s*"
    r"(?P<sym2>[€$£]|CHF|PLN|CZK|SEK|NOK|DKK|HUF|RON|GBP|EUR|USD))",
    re.I)

SYMBOL_TO_CODE = {"€": "EUR", "$": "USD", "£": "GBP"}

# Amounts on the page that are not a product price. Only what comes BEFORE
# the number is diagnostic: "Shipping $5.99" is not a product price, while
# "€68,50 incl. 19% VAT" is — a tax note after a price qualifies it rather
# than making it something else, and testing for VAT at all flagged every
# price on a German shop. Flagged rather than dropped, so a page printing
# "free delivery over €300" beside real prices keeps the real ones.
INCIDENTAL_BEFORE_RE = re.compile(
    r"(?:shipping|postage|delivery|versand(?:kosten)?|porto|frais de port"
    r"|voucher|coupon|gift ?card|geschenk"
    r"|min(?:imum)?[- ]?order|mindestbestell\w*"
    r"|free (?:over|above|from)|kostenlos ab|gratis ab"
    r"|save|sparen|you save)"
    r"[^0-9€$£]{0,24}$", re.I)


class Text(HTMLParser):
    """Visible text only. script/style contents are dropped, because a
    price-shaped number inside a JSON blob or a CSS rule is not a price on
    the page."""

    SKIP = {"script", "style", "noscript", "template", "svg"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.skip, self.title, self._in_title = [], 0, "", False

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self.skip:
            return
        if self._in_title:
            self.title += data
        self.parts.append(data)

    def text(self):
        return re.sub(r"[ \t  ]+", " ",
                      re.sub(r"\s*\n\s*", "\n", "".join(self.parts))).strip()


def robots_allows(url, cache):
    """Ask the site. A watcher that ignores robots.txt is a scraper."""
    parts = urllib.parse.urlsplit(url)
    root = parts.scheme + "://" + parts.netloc
    if root not in cache:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(root + "/robots.txt")
        try:
            rp.read()
        except Exception:                                  # noqa: BLE001
            # No reachable robots.txt is not permission. Treat it as a
            # refusal and let the operator decide.
            cache[root] = None
        else:
            cache[root] = rp
    rp = cache[root]
    if rp is None:
        return None
    return rp.can_fetch(UA, url)


def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en,de;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read(4_000_000)
        charset = r.headers.get_content_charset() or "utf-8"
        return r.status, raw.decode(charset, errors="replace")


def normalise_amount(a):
    """"1.234,50" and "1,234.50" both mean the same thing. Whichever
    separator comes last is the decimal one."""
    a = a.replace(" ", "").replace(" ", "").replace(" ", "")
    last_dot, last_comma = a.rfind("."), a.rfind(",")
    if last_dot == -1 and last_comma == -1:
        return a
    if last_comma > last_dot:
        return a.replace(".", "").replace(",", ".")
    return a.replace(",", "")


def match_text(text):
    """Text prepared for product-name matching: trademark symbols removed,
    whitespace flattened. A page writes "Jason® membrane", the sources file
    says "Jason membrane", and without this they never match."""
    return re.sub(r"\s+", " ", text.replace("®", "").replace("™", "").replace("©", "")).lower()


def nearest_term(text, terms, at, back=200, fwd=80):
    """The watched product name closest to a price, preferring one that
    comes BEFORE it, because that is how a listing page is laid out.

    The window is deliberately tight. A wide one makes every price on a
    dense shop page "near" every product, and the first name in the list
    then gets attached to somebody else's number — which is worse than
    reporting nothing, because it reads like an answer.
    """
    hay = match_text(text)
    # match_text collapses whitespace, so offsets can shift; re-locate the
    # price by searching a short signature around it rather than trusting `at`.
    probe = match_text(text[max(0, at - 24):at + 24]).strip()
    pos = hay.find(probe) + (at - max(0, at - 24) if probe else 0) if probe else at
    if pos < 0:
        pos = at

    best = None
    for t in terms:
        needle = match_text(t).strip()
        if not needle:
            continue
        start = 0
        while True:
            i = hay.find(needle, start)
            if i == -1:
                break
            start = i + 1
            if i < pos and pos - (i + len(needle)) <= back:
                d = pos - (i + len(needle))
                where = "before"
            elif i >= pos and i - pos <= fwd:
                d = i - pos
                where = "after"
            else:
                continue
            # A name before the price beats a nearer one after it.
            rank = (0 if where == "before" else 1, d)
            if best is None or rank < best[0]:
                best = (rank, t, d, where)
    return (best[1], best[2], best[3]) if best else (None, None, None)


def find_prices(text, want_terms, window=120):
    """Every currency amount, with the sentence around it and the single
    nearest watched product name. The context is the point: it is what lets
    a person confirm or reject the figure without opening the page."""
    out = []
    for m in PRICE_RE.finditer(text):
        sym = (m.group("sym") or m.group("sym2") or "").upper()
        amt = m.group("amt1") or m.group("amt2")
        if not amt:
            continue
        start, end = max(0, m.start() - window), min(len(text), m.end() + window)
        context = re.sub(r"\s+", " ", text[start:end]).strip()
        term, dist, where = nearest_term(text, want_terms, m.start())
        before = re.sub(r"\s+", " ", text[max(0, m.start() - 60):m.start()])
        out.append({
            "price": normalise_amount(amt),
            "currency": SYMBOL_TO_CODE.get(sym, sym),
            "context": context,
            "term": term,
            "term_distance": dist,
            "term_position": where,
            "incidental": bool(INCIDENTAL_BEFORE_RE.search(before)),
        })
    return out


def load_previous(path):
    return json.loads(io.open(path, encoding="utf-8").read()) if Path(path).exists() else {}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sources", default="reference/market-sources.json")
    ap.add_argument("--out", default="out-market")
    ap.add_argument("--delay", type=float, default=3.0,
                    help="seconds between requests to the same host (default 3)")
    ap.add_argument("--ignore-robots", action="store_true",
                    help="fetch even where robots.txt disallows it. Off by default "
                         "and left to whoever owns compliance.")
    args = ap.parse_args()

    src_path = Path(args.sources)
    if not src_path.exists():
        raise SystemExit(
            "no sources file at %s\n"
            "Create one listing the pages to watch, for example:\n"
            '{\n'
            '  "watch_terms": ["cerabone", "Bio-Oss", "Jason membrane"],\n'
            '  "sources": [\n'
            '    {"name": "our shop — cerabone", "url": "https://...",\n'
            '     "country": "DE", "brand": "cerabone", "owner": "botiss"}\n'
            '  ]\n'
            '}\n'
            "Nothing is fetched until a URL is in it." % src_path)

    cfg = json.loads(io.open(src_path, encoding="utf-8").read())
    sources = cfg.get("sources", [])
    terms = cfg.get("watch_terms", [])
    if not sources:
        raise SystemExit("the sources file has no sources — nothing to do")

    out = Path(args.out)
    (out / "prices").mkdir(parents=True, exist_ok=True)
    prev = load_previous(out / "state.json")
    today = date.today().isoformat()

    robots_cache, state, changes, candidates, skipped = {}, {}, [], [], []
    last_hit = {}

    for src in sources:
        url, name = src.get("url", ""), src.get("name") or src.get("url", "")
        if not url.startswith(("http://", "https://")):
            skipped.append((name, "not an http(s) URL"))
            continue

        allowed = robots_allows(url, robots_cache)
        if allowed is not True and not args.ignore_robots:
            skipped.append((name, "robots.txt disallows it" if allowed is False
                            else "no readable robots.txt — not assuming permission"))
            continue

        host = urllib.parse.urlsplit(url).netloc
        wait = args.delay - (time.time() - last_hit.get(host, 0))
        if wait > 0:
            time.sleep(wait)

        try:
            status, html = fetch(url)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            status, html = getattr(e, "code", 0) or 0, ""
            print("  %-40s FETCH FAILED %s" % (name[:40], e), file=sys.stderr)
        last_hit[host] = time.time()

        parser = Text()
        if html:
            parser.feed(html)
        text = parser.text()
        found = find_prices(text, terms) if text else []

        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
        present = sorted({t for t in terms if t.lower() in text.lower()})
        amounts = sorted({(f["currency"], f["price"]) for f in found})

        state[url] = {
            "name": name, "status": status, "retrieved": today,
            "digest": digest, "price_count": len(found),
            "amounts": [list(a) for a in amounts],
            "terms_present": present,
        }

        before = prev.get(url)
        if before is None:
            changes.append("- **%s** — first run: %d price figure(s), %d watched term(s) on the page."
                           % (name, len(found), len(present)))
        else:
            if before.get("status") != status:
                changes.append("- **%s** — HTTP status changed %s -> %s."
                               % (name, before.get("status"), status))
            was = {tuple(a) for a in before.get("amounts", [])}
            now = set(amounts)
            if was != now:
                gone, new = sorted(was - now), sorted(now - was)
                changes.append("- **%s** — price figures moved.%s%s" % (
                    name,
                    ("\n    - gone: " + ", ".join("%s %s" % a for a in gone)) if gone else "",
                    ("\n    - new: " + ", ".join("%s %s" % a for a in new)) if new else ""))
            wt, nt = set(before.get("terms_present", [])), set(present)
            if wt != nt:
                changes.append("- **%s** — products on the page changed.%s%s" % (
                    name,
                    ("\n    - no longer listed: " + ", ".join(sorted(wt - nt))) if wt - nt else "",
                    ("\n    - newly listed: " + ", ".join(sorted(nt - wt))) if nt - wt else ""))
            if before.get("digest") != digest and was == now and wt == nt:
                changes.append("- %s — page text changed but no price or product change detected."
                               % name)

        for i, f in enumerate(found, 1):
            rec = {
                # The nearest name is a suggestion for the reviewer, never a
                # finding. An explicit product on the source wins over it.
                "product": src.get("product") or f["term"] or "",
                "product_guess": (
                    "" if src.get("product") or not f["term"]
                    else "nearest watched name on the page: “%s”, %d chars %s the price — confirm it"
                         % (f["term"], f["term_distance"], f["term_position"])),
                "brand": src.get("brand", ""),
                "country": src.get("country", ""),
                "pack": "",
                "price": f["price"],
                "currency": f["currency"],
                "source": host,
                "url": url,
                "context": f["context"][:400],
                "owner": src.get("owner", ""),
                "rep": "price watch",
                # Set where the words around the number say shipping, VAT,
                # a voucher or a "from" teaser rather than a product price.
                "incidental": f["incidental"],
                # The two fields that keep this out of the trusted layer.
                "via": "web",
                "confirmed": False,
                "retrieved": today,
                "ts": int(time.time() * 1000),
            }
            doc_id = "web-%s-%s-%d" % (re.sub(r"[^a-z0-9]+", "-", host.lower()).strip("-")[:40],
                                       today.replace("-", ""), i)
            (out / "prices" / (doc_id + ".json")).write_text(
                json.dumps(rec, indent=1, ensure_ascii=False), encoding="utf-8")
            candidates.append({"doc_id": doc_id, "data": rec})

        inc = sum(1 for f in found if f["incidental"])
        print("  %-40s %s  %d price figure(s)%s, terms: %s"
              % (name[:40], status, len(found),
                 (" (%d look incidental)" % inc) if inc else "",
                 ", ".join(present) or "none"), file=sys.stderr)

    BATCH = 50
    (out / "batches").mkdir(exist_ok=True)
    for i in range(0, len(candidates), BATCH):
        (out / "batches" / ("batch-%d.json" % (i // BATCH + 1))).write_text(
            json.dumps([{
                "op": "set", "collection": "prices", "doc_id": c["doc_id"],
                "file_path": str((out / "prices" / (c["doc_id"] + ".json")).resolve()),
            } for c in candidates[i:i + BATCH]], indent=1), encoding="utf-8")

    (out / "state.json").write_text(json.dumps(state, indent=1, ensure_ascii=False),
                                    encoding="utf-8")

    lines = ["# Market watch — %s" % today, "",
             "%d source(s) fetched, %d skipped, %d price candidate(s)."
             % (len(state), len(skipped), len(candidates)), ""]
    if skipped:
        lines += ["## Not fetched", ""] + ["- **%s** — %s" % s for s in skipped] + [""]
    lines += ["## What changed since the last run", ""]
    lines += changes or ["- nothing changed."]
    lines += ["", "## Before writing these to the store", "",
              "Every price here is a CANDIDATE: read off a public page, unchecked. "
              "Each carries the sentence it was read out of, so confirming one is quick. "
              "They write into `prices` with `via: \"web\"` and `confirmed: false`, and the "
              "commercial desk reports them as unconfirmed and refuses to build a discount "
              "case on one. Delete the rows that are shipping, VAT or an unrelated number "
              "before writing the batch — the ones flagged `incidental: true` are "
              "the first place to look."]
    (out / "changes.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("", file=sys.stderr)
    print("%d price candidate(s), %d change(s) noted" % (len(candidates), len(changes)),
          file=sys.stderr)
    print("read %s before writing anything" % (out / "changes.md"), file=sys.stderr)


if __name__ == "__main__":
    main()
