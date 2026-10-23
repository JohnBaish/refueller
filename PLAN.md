# Refueller — build plan

Staged so John can see and approve each stage before the next begins. Each
stage is built on its own branch and merged to `main` only when John says so
(HOUSE-STYLE §10; notes and documents may be merged without asking, with a
word afterwards). Read `SPEC.md` and `HOUSE-STYLE.md` before starting any
stage. **Nothing past Stage 0 starts until John has answered SPEC §11 (his first
answers are recorded there) and agreed the next stage.** The repo is public
(John, 23 October: every site must stay free to run).

At the end of every stage:

- `npm run build`, `npm run lint` and `npm run check` are clean (once they
  exist).
- Anything with a screen has been checked in a real browser (Playwright,
  Chromium at `/opt/pw-browsers/chromium`) at 1200px and at 390px with touch
  emulation, with no sideways page scroll at 390px. Screenshots are shown to
  John.
- There is a dated entry in `CLAUDE.md`: what was built, why, what was left
  alone, how it was verified, and what couldn't be checked.
- John gets a short plain-English summary, and a preview link where there is
  something to see.

The order below follows Hindcaster: real data first, so the page is designed
against real figures. It changes with John's answers (for example Q2 and Q3).

---

## Stage 0 — spec and plan

Branch: `stage-0-spec`

`SPEC.md`, `PLAN.md`, `CLAUDE.md` and `README.md`, with the handover moved to
`design/handover-2026-10-22.md` (words unchanged) and `HOUSE-STYLE.md`,
`SEO-HANDOVER.md` and `.claude/skills/fresh-look/` copied from clockwheel
(`36378ed`). John answers SPEC §11.

## Stage 1 — find out what the source really gives

Branch: `stage-1-probe`

Needs John's yes to Q2 and Q3 first.

1. **John registers** for Fuel Finder (GOV.UK One Login), reads the terms and
   adds the two secrets `FUEL_FINDER_CLIENT_ID` and `FUEL_FINDER_CLIENT_SECRET`
   to the repo's GitHub Actions secrets (Claude gives step-by-step
   instructions, with each box named; the values go only into GitHub, never
   into a chat). Write the secrets' expiry dates here once known.
2. **John allows the sites** in SPEC Q3 in the environment's network settings
   (and removes any that were needed only once, later).
3. **Read the portal's Developer Guidelines**
   (`design/fuel-finder-developer-guidelines-2026-10-24.md`). The public API is read-only,
   so the probe and the collector can both use the **live** credentials (the
   portal says read-only calls may be tested against live or test): one pair of
   secrets, one request at a time, one access token per run, reused for every request in it and never requested per
   call (the portal asks for tokens to be reused until close to expiry; they last an
   hour), 429 and errors
   handled with a backoff, nothing from the API or the secrets ever printed to a
   public Actions log, and no raw response committed.
4. Scaffold `package.json` and `tsconfig` to match Hindcaster (Node runs `.ts`
   scripts directly), `.env.example`, and a "Probe Fuel Finder" workflow (Run
   workflow only).
5. `scripts/probe.ts`: gets a token, fetches one batch of stations and one of
   prices, and records **shapes only** (field names, types, counts, batch
   sizes, status codes, timings, response headers about limits), never the
   token or secrets. Writes `design/probe-<date>.md`.
6. From the real answers, correct SPEC §2–§5 (endpoints, fields, fuel codes,
   opening-times format, closure flags, price ranges, how many stations, the
   size of the trimmed list, rate limits, outage behaviour) and list what
   changed.

## Stage 2 — the collector

Branch: `stage-2-collector`

1. `scripts/lib/clean.ts`: plain functions (kept apart from fetching, so they
   can be checked without the network) that join stations and prices, drop
   permanently closed stations, flag temporary closures, drop prices outside
   the sensible range, flag old prices, and trim to what the page needs.
   Rules the field guide adds: Great Britain only (drop Northern Ireland by country
   and `BT` postcode); a future `permanent_closure_date` stays open until then;
   fuel codes matched without regard to case; a station whose position is far from
   its own postcode district is left out; unusable opening hours are kept but marked
   "hours not listed". The collector also fetches GOV.UK's bank-holidays feed and
   writes the dates for England and Wales and for Scotland into the data file.
   From the station sample: opening times are `HH:MM:SS` (ignore seconds), the
   24-hour flag beats the times, 00:00 to 00:00 with the flag false is ambiguous (SPEC
   Q14), `bank_holiday` is one object, `country` and names come in capitals, `county`
   may be null, `fuel_types` is a list of codes. Tidy names for display (BP, ESSO etc.).
2. `scripts/collect.ts`: fetch (one retry at most, polite to the API's limits),
   clean, write the data file, keep the last good copy when a run fails, and
   log each run (counts, newest price time, failures) in `data/runs/`.
3. `.github/workflows/collect.yml`: Run workflow, started by cron-job.org at
   the times agreed in Q9 (no GitHub schedule, as Hindcaster); commits `data/`
   to `main` (the collector's own commits go straight to `main`, as
   Hindcaster's do, if John agrees). John sets up cron-job.org and its GitHub
   token (expiry date written here).
4. `npm run check` (`scripts/check-clean.ts`): the cleaning rules on real
   examples from the probe, an outage run keeping the old copy, duplicate
   stations, a station with one fuel.
5. John merges once the first real runs look right.

## Stage 3 — places and the search rules

Branch: `stage-3-search`

1. Postcode positions per Q4 (OS Open Names; `scripts/build-postcodes.ts`,
   the download kept out of the repo), with a check that known postcodes land
   within tens of metres of where they are, and the credit lines read from the
   licence file.
2. `src/lib/search.ts`: nearest eight open stations (UK clock time, clock
   changes, opening times that run past midnight, 24-hour stations, no hours
   listed, fewer than eight open), distance in miles (Q5) and the
   wording/rounding helpers copied from Hindcaster (`format.ts`).
3. `npm run check` covers all of it, with worked examples checked by hand.

## Stage 4 — mock-ups

Branch: `stage-4-mockups`

Computer and phone mock-ups from real collected data for John's approval, for
every state listed in SPEC §7, with labelled options where there is a choice.
No wiring in before approval.

## Stage 5 — the page

Branch: `stage-5-page`

1. Scaffold Vite + React + TypeScript; copy `organic.css`, `global.css`
   (trimmed), `icons.tsx`, `responsive.ts`, `words.ts` from clockwheel and the
   `SafetyNet` pattern from Hindcaster.
2. Build the agreed page; remembered postcode in `localStorage`
   (`refueller.choice`); statistics stripped of anything after "#".
3. Late in the design, **ask John whether Refueller should have a dark mode**
   (HOUSE-STYLE §2 and §16), and if so mock it up in both themes first.
4. Browser checks as above, plus every real data state (old copy, missing
   price, nothing open).

## Stage 6 — launch

Branch: `stage-6-launch`

Favicon options and a link-preview image (shown to John before wiring in,
HOUSE-STYLE §7); the search title, description, canonical, robots.txt and
sitemap, and the visible explanation (SEO-HANDOVER checklist, John's wording);
the credit lines and privacy wording as agreed; Vercel project, domain and Web
Analytics (John); Search Console (John); then, last, the baish.net landing card
with the hub's description updated, and the overview PDF
(`design/overview/` in clockwheel). A **fresh look** review after launch.

## Stage 7 — the calculator (later)

Branch: `stage-7-calculator`

"Is it worth driving further?" (SPEC §9). Its own questions, mock-ups and
checks first; the arithmetic in `npm run check`, including the handover's
worked example (net 38p, break-even about 2p a litre).

---

## Needed from John, and when

| When | What |
|---|---|
| Now | Answer SPEC §11 |
| Stage 1 | Register for Fuel Finder, read the terms, add the two secrets, allow the network sites |
| Stage 2 | cron-job.org job and GitHub token; re-save `collect.yml` on github.com after Claude changes it |
| Stage 5 | Dark mode yes or no |
| Stage 6 | Vercel project, domain, Web Analytics, Search Console, DNS |

## Dates to remember

None yet. The portal says to rotate client secrets regularly. Write here: the Fuel Finder
secrets' expiry and rotation dates, the cron-job.org
GitHub token's expiry, and the GitHub API version cut-off, as soon as each is
known.

## Ideas logged for later

Not to be worked on yet: a "More fuels" choice (super unleaded, premium
diesel, HVO); a map; price history from our own snapshots; filters (motorway
services, supermarkets, 24 hours); Northern Ireland; the cheapest station
within a chosen distance; county or region pages for search.
