# Refueller — working notes

**Find the cheapest fuel near you at a glance** (draft tagline, for John to
confirm). A sister tool to Clockmaker, Backtimer (repo `JohnBaish/clockwheel`),
Flowcharter (`JohnBaish/flowcharter`) and Hindcaster (`JohnBaish/hindcaster`),
intended for `refueller.baish.net`. Enter a postcode, see the eight nearest
open petrol stations with unleaded and diesel prices.

Read these first, in this order:

1. `SPEC.md`: what Refueller is and does (being agreed with John; §11 lists
   the numbered open questions).
2. `PLAN.md`: the staged build. Work one stage at a time, on its branch.
3. `HOUSE-STYLE.md`: the shared look and ways of working. Copied from
   `JohnBaish/clockwheel`; last re-copied 2026-10-30 (at clockwheel commit `674122d`).
   Clockwheel holds the master copy. If it has changed since, re-copy it and
   note that here. The same goes for `SEO-HANDOVER.md` and
   `.claude/skills/fresh-look/` (the `/fresh-look` review).
4. `design/handover-2026-10-22.md`: John's original handover from a Claude.ai
   chat, kept unchanged. It has the data-source notes (marked "unverified"
   there) and the calculator formula. Where it differs from the house style
   (it defaults to Next.js, a database and server-side search), SPEC §6 says
   how and why.
5. `design/fuel-finder-developer-guidelines-2026-10-24.md`: the Fuel Finder
   portal's Developer Guidelines, pasted by John (rate limits, secrets, caching,
   "Don't redistribute raw API data"). Read before any work on the API.
   Also `design/fuel-finder-developer-docs-overview-2026-10-24.md`: the portal's
   overview and API Testing pages (authentication, environments).
   And `design/fuel-finder-public-api-intro-2026-10-24.md` (the Public API intro) and
   `design/fuel-finder-api-documentation-index-2026-10-24.md` (the API index) and
   `design/fuel-finder-api-fields-guide-2026-10-24.md` (the real field names) and
   `design/fuel-finder-information-recipient-api-2026-10-24.md` (the four endpoints) and
   `design/fuel-finder-oauth-token-api-2026-10-24.md` (the two token endpoints).
   And `design/fuel-finder-oauth-generate-token-2026-10-24.md` (the token call, from a screenshot).
   And `design/fuel-finder-data-endpoints-2026-10-24.md` (the station and price calls: paths, batches, parameters).
   And `design/fuel-finder-terms-of-access-2026-10-24.md` (the registration terms: OGL and the Fair Use policy), plus the field samples `design/fuel-finder-prices-sample-2026-10-24.md` and `design/fuel-finder-stations-sample-2026-10-24.md`.

Key points from the house style, repeated because they matter most:

- John is not a developer. Explain plainly and briefly, say what he needs to
  do, and use British spelling. He decides wording.
- Agree before building anything significant. Show rendered previews of
  pages, images and icons before wiring them in. **Nothing is to be built
  until John has answered SPEC §11 and agreed the first stage.**
- Build on a branch; merge to `main` only when John says so, except notes and
  documents (HOUSE-STYLE §10).
- Check in a real browser at 1200px and at 390px with touch emulation, and
  say what couldn't be checked.
- Add a dated entry below for every change.
- **Project tracker:** when something significant changes (a stage finished, a decision made, something goes live or is parked), update this project's file and its line in `INDEX.md` in `JohnBaish/baish.net-directory`, following that repo's README.

Refueller-specific points:

- **Nothing a visitor types or chooses may go to a server or a third party.**
  The postcode is turned into a position and the search is done in the
  browser. Only anonymous visit statistics are recorded. If a design needs
  more (a routing service, a postcode lookup), stop and ask John.
- **Secrets** (`FUEL_FINDER_CLIENT_ID`, `FUEL_FINDER_CLIENT_SECRET`) live only
  in GitHub Actions secrets. Never write one into a file, a log, a commit or a
  message, and never ask John to paste one into a chat. `.env*` is in
  `.gitignore` (only `.env.example` may be committed).
- **Fair Use policy (SPEC §2a):** show prices without bias, hide or alter nothing to favour or hinder a trader,
  never alter timestamps, link to "Report a Discrepancy", and keep the data fresh: the latest CSV, or the API
  at least every five minutes on average. Breach can mean suspension.
- **Everything must stay free to run** (John, 23 October). The repo is
  **public**, so commit only what may be published (the trimmed data the page
  needs, never raw API responses, never secrets). Vercel's free plan is
  non-commercial only: no adverts or affiliate links. Watch the free limits in
  SPEC §10. No cookies if avoidable.
- "Less than", never "under"; "more than", never "over" for amounts. Times as
  "9.30am". Temperatures, if ever shown, as "20°C" (HOUSE-STYLE §15).
- **This container can't reach** the Fuel Finder developer site and API,
  GOV.UK or postcodes.io (the session's network policy refuses them, 23
  October). Anything that needs the real source is checked from a GitHub
  Actions workflow, or with the network setting changed. Don't stand in
  made-up figures for real ones.

## Layout

Notes: `SPEC.md`, `PLAN.md`, `README.md`, this file, `HOUSE-STYLE.md`, `SEO-HANDOVER.md`,
`.claude/skills/fresh-look/`, `design/` (the handover and the saved Fuel Finder documentation).

Stage 1 (on `main` since 24 October, with the diagnostics added the same day): `scripts/probe.ts` (sign in, page through every
station and price batch, print counts and shapes only), `scripts/lib/probe.ts` (pure helpers: the
host allow-list, redaction, hours classes, summaries, a page-file size estimate),
`scripts/check-probe.ts` (`npm run check`: rules plus a full run against a fake server),
`.github/workflows/probe.yml` (Run workflow only), `.env.example`. `npm run lint`, `npm run typecheck`.
Stage 1c (on `main` since 27 October): `lambda/handler.ts` and `lambda/make-handler.ts` (the probe as an AWS Lambda
handler), `scripts/lib/run-probe.ts` (the probe, shared by the workflow and Lambda), `scripts/build-lambda.mjs`, `scripts/check-lambda.ts`,
`.github/workflows/lambda-package.yml`, `design/aws-test-steps-2026-10-27.md`.
Stage 2 (on `main` since 28 October): `scripts/lib/clean.ts` (the rules, no network), `scripts/lib/collect.ts` (one run: Fuel Finder,
bank holidays, one commit to `main` through GitHub's API), `lambda/collector.ts` and `lambda/make-collector.ts`, `scripts/check-collect.ts`;
`npm run build:lambda` makes `dist-lambda/collector/` and `dist-lambda/probe/`. Data on `main`: `data/stations.json`, `data/prices.json`,
`data/bank-holidays.json`, `data/runs/YYYY-MM.jsonl`. John's steps: `design/aws-collector-steps-2026-10-28.md`.
Stage 3 (branch `stage-3-search`): `scripts/build-outcodes.ts` (`npm run outcodes <Open Names folder>`) makes `data/outcodes.json`
(every postcode district in Great Britain: latitude, longitude, main place, and the OS credit lines); `scripts/lib/grid.ts` (from
Hindcaster, plus `fromBritishGrid`); `src/lib/search.ts` (the page's rules: postcodes, distances, open now, bank holidays, the
eight, cheapest, words); `scripts/check-search.ts` with `scripts/fixtures/rg4-2026-10-30.json` (the real stations round RG4).
Stage 5 (branch `stage-5-page`): the page, Vite + React + TypeScript (`npm run dev`, `npm run build`, `npm run preview`):
`index.html` (dark mode set before drawing), `src/main.tsx` (visit statistics without the part after "#"), `src/App.tsx` (postcode
screen or results, the district in the address after "#" and kept as `refueller.choice`; About these figures; footer; safety net),
`src/components/Results.tsx` (table on a computer, cards on a phone), `src/components/ThemeSwitch.tsx` and `src/lib/theme.ts`
(from Hindcaster; `refueller.theme`), `src/lib/load.ts`, `src/lib/pageTypes.ts`, `src/styles/` (organic.css and the page's
global.css). `scripts/lib/pageData.ts` makes `public/data/` at every build (not kept in git): `index.json` (positions, postcode
districts, bank holidays) and one file per postcode area; the page loads the index, then only the areas of the eight nearest.
Stage 7 (branch `stage-7-calculator`): "Worth driving here?". `scripts/build-road-miles.ts` (`npm run road-miles <Open Roads data
folder>`, about 90 s, needs `NODE_OPTIONS=--max-old-space-size=8192`) makes `data/road-miles.json` from every road in OS Open Roads:
tenths of a mile from each postcode district middle and each station to its 12 nearest stations. `scripts/lib/pageData.ts` splits it
into `public/data/roads-<built>/<area>.json`. `src/lib/calc.ts` (the sums, wording, remembered choices as `refueller.calc`),
`src/components/Calc.tsx` (the panel), `scripts/check-calc.ts`.

## Log

### 2026-10-23 — stage 0: spec, plan and notes drafted (branch `stage-0-spec`)

**What:** John started the project from a Claude.ai handover (committed to the
repo on 22 October as `CLAUDE.md`, then renamed `idea_handover_from_claude_chat.md`).
Following HOUSE-STYLE §16: moved the handover to
`design/handover-2026-10-22.md` with a plain rename (git reports 100%
similar, so not a word changed; dated by the day it was added to the repo);
copied `HOUSE-STYLE.md`, `SEO-HANDOVER.md` and `.claude/skills/fresh-look/`
from clockwheel `36378ed` (checked identical to clockwheel's `main`, which was
up to date with GitHub); took clockwheel's `.gitignore` and added `.env`,
`.env.*` (keeping `.env.example`) as the handover asks. Read Hindcaster's
`SPEC.md` and `PLAN.md` for the layout. Wrote `SPEC.md` (13 numbered
questions, with recommendations), `PLAN.md` (stages 0 to 7, one branch each)
and this file.

**Where the draft departs from the handover, for John to decide (Q2, Q4, Q5):**
the handover wanted Next.js with a database, a search function on the server,
postcodes.io for postcodes and OpenRouteService for road distances. Each of
those sends the visitor's postcode or position to a server or third party,
which cuts across "no data taken from the user". The draft proposes the
Hindcaster way (static site, a GitHub Actions collector, search in the
browser), straight-line distances in the first version, and full postcode
positions from OS Open Names split by postcode area.

**Checked:** the handover's calculator example by code: 4.546 ÷ 45 =
0.10102 litres a mile; 6 extra miles × 0.10102 × 135p = 81.8p; saving 3p × 40
= 120p; net 38.2p; break-even 2.05p a litre. All as the handover says (using
4.54609 litres a gallon changes nothing at this precision). Repo state:
`refueller` `main` at `319beb8`, clean; clockwheel `main` at `36378ed`.

**Couldn't be checked:** every Fuel Finder endpoint, field name, fuel code,
rate limit and term (host blocked; the web-fetch tool couldn't resolve the
GOV.UK or developer-portal hosts either). A web search showed only that
GOV.UK has a guidance page offering a CSV (updated twice a day), an emailed
CSV and an API with OAuth 2.0 client credentials after GOV.UK One Login, and
that one community thread disputes whether the scheme is plain open data
(mentions an "Information Recipient" registration and a "Fair Use" policy).
That is second-hand and unconfirmed: the licence is Q3. Also not checked:
Vercel's rebuild allowance on the free plan, and how big the trimmed
whole-UK station list is.

**Left alone:** no app code, no scaffold, no workflow. `organic.css`,
`global.css` and the other files in HOUSE-STYLE §1 are copied when Stage 5
starts.

### 2026-10-23 — John's first answers; keeping it free (branch `stage-0-spec`)

**John answered** (his list ran 1 to 12; Claude mapped his 10, 11 and 12 to Q11,
Q12 and Q13, which leaves **Q10 unanswered**): public repo (all sites must stay
free to run; no cookies if avoidable); explore the consequences of building it
the house way or the handover way; Q3 "whatever works best"; district centres
for postcodes for now (Q4 A); straight-line miles, one decimal for less than five
miles; unleaded and diesel only; the gap rules; "open" as drafted; probably four
updates a day; Great Britain only; credit lines; remember the last postcode.
He is also open to a different approach to personal data for this tool if it
keeps it free. All recorded in SPEC §11, with the new "Keeping it free" part of
§10 (the table of consequences and a recommendation: house way, public repo).

**Checked:** free-plan limits, by web search (the pages themselves couldn't be
opened): GitHub standard runners free in public repos, 2,000 minutes a month for
private; Vercel Hobby 100 deployments a day, cron at most once a day,
non-commercial only, Web Analytics 50,000 events a month then paused (no charge).
The two Vercel pages quoted disagree on the number of cron jobs, and one says a
Hobby overage means waiting 30 days where another says 7 for analytics, so
re-check before relying on any figure.

**Not changed:** no app code. Waiting on John for Q2 (after reading the table),
Q3 (the sites to allow and his Fuel Finder registration), Q9 and Q10.

### 2026-10-24 — Q2 and Q10 answered; the official sources read (branch `stage-0-spec`)

**John:** yes to the house way (Q2); nearest first with the cheapest price marked
(Q10); sites allowed. A reorder-by-price button is not in the first version.

**What the allowed sites gave:** `www.gov.uk` and `www.legislation.gov.uk` load
from here. `www.fuel-finder.service.gov.uk` answers 403 (the server itself; the
API needs a token, so expected). **The developer portal is still blocked:** its
real address is `www.developer.fuel-finder.service.gov.uk` (with `www.`), but John
allowed `developer.fuel-finder.service.gov.uk` (no `www.`), which doesn't exist.
Asked him to add the `www.` form. The web-fetch tool can't resolve any of these
hosts; the shell (through the proxy) can.

**Checked (details in SPEC §2):** GOV.UK's guidance page and SI 2025/1356. UK-wide
coverage; prices published within 30 minutes of a change; CSV twice a day; API with
OAuth 2.0; the price API updated within 5 minutes of a trader's report; and
regulation 13(5)-(6), under which the aggregator sets "standards" for use of the
data and can withhold access. **Nothing official says Open Government Licence**,
so the handover's licence claim and credit sentence are unconfirmed until the
portal's terms are read.

**Not changed:** no app code. Still waiting for the portal terms (Q3) and Q9.

### 2026-10-24 — developer portal allowed but still unreadable from here (branch `stage-0-spec`)

John added `www.developer.fuel-finder.service.gov.uk`. The proxy now connects,
but the portal answers an empty **403 from CloudFront**, for curl with browser-style
headers and for real Chromium alike, so it blocks this container itself (cause
unknown; possibly non-UK or cloud addresses). The CMA guidance PDF
(`assets.publishing.service.gov.uk`) is also blocked by the proxy. Search snippets
(second-hand, in SPEC §2) say the licence is the Open Government Licence plus the
aggregator's Fair Use policy. **Risk to check in Stage 1:** the API itself may
refuse GitHub Actions runners. Asked John to read the portal's terms pages in his
own browser and paste the text (not a secret) or allow the CMA host.

### 2026-10-24 — CMA guidance read; a search-snippet claim corrected (branch `stage-0-spec`)

**Correction:** the previous entry and SPEC §2 said a snippet showed the CMA's
guidance saying the fuel data is reusable under the Open Government Licence. Having
read the whole PDF (`assets.publishing.service.gov.uk`, now allowed), that line is
only its own Crown copyright notice. Nothing in it covers the data's licence. It
does name "fuel price comparison and navigational apps and websites" as the
intended recipients (paragraph 11). The only source for "OGL plus Fair Use policy"
is the forum post, so Q3 is still open. John says the portal's access page had
"very little" on it; the terms are probably shown during registration.

### 2026-10-24 — the portal's Developer Guidelines (branch `stage-0-spec`)

John pasted the portal's "Developer Guidelines" page (saved unchanged in `design/`).
Not seen before. **Findings (SPEC §2):** 100 requests a minute and one at a time per
client, test and live environments with separate credentials; caching advice (stations
1 hour, prices 15 minutes); never expose secrets in public repos or client code (our
collector uses Actions secrets, which is fine, but a public repo's logs are public,
so print nothing sensitive); **"Don't redistribute raw API data"**; "attribute data
sources appropriately". Still not seen: the terms of service, licence, Fair Use policy
and attribution wording. **Open risk:** whether a trimmed public data file counts as
raw redistribution. Proposed: ask VE3 in writing before Stage 2. Q9 (refresh rate)
isn't constrained by the API.

### 2026-10-24 — more portal text from John: overview and API Testing

Saved unchanged in `design/fuel-finder-developer-docs-overview-2026-10-24.md`.
**New:** read-only calls can be tested against live, so **one pair of live secrets
is enough** (corrects the plan's "two pairs"); token request details (form POST,
`scope=fuelfinder.read`, one-hour tokens), but the token address is blank in the
paste. **Conflict to settle by the probe:** the portal's examples use
`api.fuelfinder.service.gov.uk/v1/...` and `fuel_type=unleaded`, the handover has
`www.fuel-finder.service.gov.uk/api/v1/pfs?batch-number=N` and `E10`/`B7_STANDARD`.
John is sending more sections; still no terms, licence, Fair Use or attribution text.

### 2026-10-24 — Public API introduction from John

Saved unchanged in `design/fuel-finder-public-api-intro-2026-10-24.md` (its first
paragraph is cut off in the paste). Nothing new beyond what GOV.UK and the
regulations already said: UK-wide, updated within 30 minutes of a change (the
traders' reporting duty; the API itself is updated within 5 minutes of their report,
per regulation 13), forecourt details, amenities and opening hours, a timestamp on
each price and site, GOV.UK One Login, OAuth 2.0 client credentials. Still no endpoint
list, field names, terms, licence or attribution wording.

### 2026-10-24 — API documentation index from John

Saved unchanged in `design/fuel-finder-api-documentation-index-2026-10-24.md`. It
lists two pages, "Information Recipient API's" (`/fuel-finder/apis-ifr/info-recipent`:
fetch prices and station information, "including incremental updates") and "OAuth
Access Token Generation API" (`/fuel-finder/apis-ifr/access-token`), which should hold the
real endpoints and fields; they have not been seen. **New rule from the token page:**
access and refresh tokens must be reused until close to expiry, not requested before
every call. The collector gets one token per run and reuses it for every request in
that run (and refreshes it if a run outlasts the hour); the plan's "new token each run"
is within that. Asked John for those two pages next.

### 2026-10-24 — the API fields guide from John

Saved in `design/fuel-finder-api-fields-guide-2026-10-24.md` (tab-separated paste laid
out as tables, words and samples unchanged). Summarised in SPEC §2. **Corrections to
my earlier notes:** the data *does* contain bank-holiday opening hours (I had said it
didn't), so SPEC §4 and Q8 now use them, flagged for John to confirm; diesel is spelt
`B7_Standard` there, not `B7_STANDARD`. **New cautions:** hours are "usual" only;
`temporary_closure` only covers three days or more; a permanent closure can be in the
future; the sample longitude is wrong (positive for Leicestershire), so positions get
a sanity check. **Checked:** GOV.UK's `bank-holidays.json` loads from here and covers
2019 to 2028 for England and Wales, Scotland and Northern Ireland. Still not seen: the
two API pages themselves (addresses, paging, what "Incremental" asks for), and any
terms, licence or attribution wording.

### 2026-10-24 — the four endpoints (names only) from John

Saved in `design/fuel-finder-information-recipient-api-2026-10-24.md`: API version 1,
four GET calls (fetch all PFS fuel prices; fetch incremental PFS fuel prices; fetch PFS
information; fetch incremental PFS information). No addresses or parameters in the paste
(each row probably opens its own page). John will register first and email VE3 about
"Don't redistribute raw API data" only if the registration terms leave it unclear.
Still not seen: each endpoint's address, parameters and paging; the OAuth token page;
terms, licence, Fair Use and attribution wording.

### 2026-10-24 — the two token endpoints (names only) from John

Saved in `design/fuel-finder-oauth-token-api-2026-10-24.md`: a POST to generate an access
token, and a POST to regenerate one from a refresh token. The same token-reuse guidance as
before; no addresses or parameters in the paste; the version field is empty. So the
collector's token handling is: one POST at the start of a run, reuse it, and use the refresh
call (not a fresh login) if a run outlasts the token. Still needed: each endpoint's own page.

### 2026-10-24 — the token endpoint page (screenshot) from John

First real endpoint page. Transcribed (not saved as an image) in
`design/fuel-finder-oauth-generate-token-2026-10-24.md`: `POST
/api/v1/oauth/generate_access_token`, JSON body with `client_id` and `client_secret`,
access token 3600 s, refresh token 48 h, replies 200/400/401/429/500/502/503/504.
**Matches the handover's path; differs from the overview's generic example** (form body,
`scope`, `/v1/...`), so the specific page wins until the probe confirms. The screenshot's
sample key strings were deliberately not copied (placeholders, not credentials; John hasn't
registered yet). Host still not shown. Still needed: the other five endpoint pages.

### 2026-10-24 — token endpoint, second screenshot

Added to `design/fuel-finder-oauth-generate-token-2026-10-24.md`: the 200 reply is
`{success, data:{access_token, token_type, expires_in, refresh_token,
refresh_token_expires_in}, message}`, so the collector reads the token from `data`;
error descriptions (401 invalid credentials, 503 "try again later", and so on); and the
regenerate call's path, `POST /api/v1/oauth/regenerate_access_token`. Sample token strings
not copied. Four data-endpoint pages still to come.

### 2026-10-24 — token endpoint, third screenshot

Added to the same transcription: the regenerate call takes `client_id` and
`refresh_token` (no secret) and returns `data.access_token` with an hour's expiry, and
no new refresh token in the visible sample. This completes the token side. Four data
endpoint pages still to come.

### 2026-10-24 — the data endpoints (screenshots) from John

Transcribed in `design/fuel-finder-data-endpoints-2026-10-24.md` (the first of the five
images repeated an earlier token screenshot). **Confirmed:** `GET /api/v1/pfs?batch-number=N`
and `GET /api/v1/pfs/fuel-prices?batch-number=N`, up to 500 forecourts a batch; incremental
forms add `effective-start-timestamp=YYYY-MM-DD` (a date, not a time). All match the
handover's paths. **Mismatches:** the fields guide says `fuel_types` is true/false flags, the
sample shows an array; `permanent_closure` is `false` or `null`. The samples include test
records. **Plan:** stations once a day, prices each run, one request at a time. Still not
seen: the host, the incremental station page, the "all prices" page's own text, the expanded
samples, and any terms or licence wording.

### 2026-10-24 — incremental station page (screenshots) from John

Added to `design/fuel-finder-data-endpoints-2026-10-24.md`: `GET
/api/v1/pfs?batch-number=1&effective-start-timestamp=YYYY-MM-DD` (the same two parameters
as the incremental prices call). The sample records are documentation tests ("TEST",
"Yono", "csvprice"); one has an empty `amenities` list and a true supermarket flag. The
folded groups (`location`, `opening_times`, `fuel_types`, `fuel_prices`) are still not
expanded in any screenshot. All station and price endpoints are now seen except the "all
prices" page's own text.

### 2026-10-24 — a prices sample response from John

Saved unchanged in `design/fuel-finder-prices-sample-2026-10-24.md`. Settles the price
shape: `price` is a number (pence per litre), timestamps are UTC with milliseconds, there is
no location in the prices call (join on `node_id`), and **a station lists only the fuels it
sells** (the samples show one without E10 and one without diesel). Diesel is `B7_STANDARD`
here and `B7_Standard` in the fields guide: match case-insensitively. Still not seen: the
expanded `location`, `opening_times`, `fuel_types` and `amenities` of the station call.

### 2026-10-24 — full station sample from John

Saved unchanged in `design/fuel-finder-stations-sample-2026-10-24.md` (checked to parse as
JSON). **Resolves:** `fuel_types` is a list of codes; opening times are `HH:MM:SS` (can be a
second out); `bank_holiday` is a single object (not `bank_holidays` as in the guide) with a
`type` of "bank holiday" or "standard"; `location` fields can be null, upper case, or the
whole address in line 1. **Checked by code:** two of the three sample positions are 335 km
and 260 km from their own postcodes (by my approximate town positions); the third is right.
**New question for John (Q14):** what `00:00 to 00:00, not 24 hours` means. Not changed: no
app code. Still not seen: the registration terms, the host, the "all prices" page's text.

### 2026-10-24 — PARKED (John will register later)

**State:** Stage 0 is complete and merged to `main` as documents (spec, plan, notes, house
style copies, and nine saved pieces of the Fuel Finder documentation in `design/`). Nothing
is built; no scaffold, no workflow. A new thread should start on `main`, read the list at the
top, then SPEC §11 and the "PARKED" box at the top of PLAN.md.

**Decided (SPEC §11):** Refueller at `refueller.baish.net`; public repo; the house way
(static site, GitHub Actions collector, search in the browser, no cookies); district-centre
postcodes for now; straight-line miles (one decimal for less than five miles); unleaded
(`E10`) and standard diesel (`B7_STANDARD`) only; flag prices older than seven days, keep
stations with one fuel, drop prices outside 100p to 300p; "open" as drafted (now using
bank-holiday hours too, for John to confirm); nearest first with the cheapest marked;
Great Britain only; credit lines as Hindcaster; remember the last postcode; probably four
updates a day.

**Open:** Q3 the data terms (licence, Fair Use, attribution, "don't redistribute raw API data"),
which John says come with registration; Q9 final refresh rate (four a day likely); Q14 hours
shown as 00:00 to 00:00; John to confirm the Q8 bank-holiday amendment; later questions
(dark mode, calculator, favicon, search wording).

**Known about the API** (SPEC §2): token and data paths, 500 stations a batch, field names and
shapes, rate limits (100 a minute, one at a time), token lifetimes. **Not known:** the host,
the licence and attribution wording, how many stations there are, the real spellings and
data quality (the samples are test records with some wrong positions).

**Risk to check first in Stage 1:** the portal returns 403 to this container, so the API
may refuse GitHub's runners too; the probe will show.

**Housekeeping for John:** nothing running or scheduled; no secrets exist yet. The network
allow-list now includes the Fuel Finder sites and `assets.publishing.service.gov.uk`;
`www.gov.uk` and `www.legislation.gov.uk` were used. Remove any that are no longer needed
when the work resumes or ends.

### 2026-10-24 — the registration terms (John pasted them); the refresh rule changes the plan

Saved unchanged in `design/fuel-finder-terms-of-access-2026-10-24.md`; summarised in SPEC §2a.
**Settled:** the licence is the Open Government Licence plus the aggregator's Fair Use policy,
so a public repo and a trimmed public data file are fine in principle. **Changes the plan:**
users promoting fuel retail to motorists "must" use the most up-to-date CSV or call the API on
average at least every five minutes. **Four updates a day does not comply, and my earlier
"four a day is likely" was wrong (Correction).** Options (SPEC §2a, Q9): A, the CSV (published
twice a day) when it appears; B, the API every five minutes (about 288 runs a day, and the
data must be published without a site rebuild, because Vercel allows 100 deployments a day);
C, ask VE3. Recommended: A if the CSV can be fetched automatically. Also required: a "Report a
Discrepancy" link (`.../motorist/price-report`); three filters to disclose (price range,
position check, two fuels). Not changed: no app code. Next: John registers and finds how the
CSV is downloaded, its columns and the API host.

### 2026-10-24 — UNPARKED: John has registered

John reports that registration gave **only a client ID and a client secret** (no CSV link or API
host mentioned). Neither value has been pasted into the chat or seen by Claude. Next: John adds
them as the GitHub Actions secrets `FUEL_FINDER_CLIENT_ID` and `FUEL_FINDER_CLIENT_SECRET` on
`JohnBaish/refueller` (steps given in the thread), then Stage 1 (the probe) once he agrees it.
The probe must find the API host itself, trying only government hosts (handover:
`www.fuel-finder.service.gov.uk`; overview example: `api.fuelfinder.service.gov.uk`), so that a
secret is never sent to anywhere else. The public repo's Actions logs and any committed report
must hold counts and field names only, never raw data or secrets. Q9 (CSV or five-minute API)
is still open; the probe does not depend on it. Whether the secret has an expiry date: ask John.

### 2026-10-24 — stage 1: the probe built (branch `stage-1-probe`)

**John:** added the two secrets in GitHub (no expiry date seen) and said go ahead.

**What:** `scripts/probe.ts` signs in at the first government host that answers (the handover's
`www.fuel-finder.service.gov.uk`, then the portal example's `api.fuelfinder.service.gov.uk`, then
`api.fuel-finder.service.gov.uk`), reads every station batch and price batch one request at a time
(0.8 s apart; the limit is 100 a minute), tries the three "incremental" calls once, tries the refresh call
once, and prints **counts and shapes only**: batch sizes, field types, hours classes (including the
00:00 to 00:00 question, Q14), fuel-code spellings, price ranges and ages, the station/price join, closure
and position oddities, and an estimate of the page's data file (JSON and gzip bytes). It also records
rate-limit headers. It writes the same summary to the run's job summary. Safety: secrets go only to the
listed hosts and never to a redirect target; the token stays in memory; every printed line passes
through `redact`; the workflow has read-only permissions and runs no `npm install`. Test-like station
names are counted, with at most five names quoted; no codes, addresses or prices of individual stations.

**Checked here:** `npm run check` (17 checks): host allow-list (including look-alike and `user@` tricks),
redaction, times and hours classes, summaries of John's three saved samples, and the whole probe against
a fake server on this machine: paging until an empty batch, a wrapped reply, a 429 waited out, a redirect
not followed (a trap server received nothing), wrong credentials (no data requests made), an expired token
renewed once, a host off the list refused, nothing answering. **Four deliberate breakages each made the right
check fail** (following redirects; printing the token past `redact`; ignoring a `user@` host; reading
00:00 to 00:00 as ordinary hours), then the code was restored. `npm run lint` and `npm run typecheck` are clean.

**Couldn't be checked:** anything against the real API (this container is blocked; Q: will GitHub's servers
be accepted?), the workflow on GitHub itself, and the real host and data. **Not merged:** John to say
merge (the workflow touches the secrets, and the Run workflow button needs it on `main`).

### 2026-10-24 — first real probe run: red, and informative (branch `stage-1b-diagnose`)

John merged Stage 1 and pressed Run workflow (run 40011176944, 15 seconds). **Read from the Actions log
through GitHub's API:** the 17 checks passed on GitHub's Node 24; the secrets printed as `***`; nothing leaked.
**Token requests:** `www.fuel-finder.service.gov.uk` -> HTTP 403 with an empty body;
`api.fuelfinder.service.gov.uk` and `api.fuel-finder.service.gov.uk` -> no answer (`ENOTFOUND`, so those hosts do
not exist). **So the host is `www.fuel-finder.service.gov.uk`, and it refuses GitHub's servers with a blank 403**
(the docs promise 401 for bad credentials), as it does this session's container. Probably location or network
filtering; unproven.

**Built on `stage-1b-diagnose` (not merged):** the probe now sends an honest `User-Agent` ("Refueller-probe/0.1",
no disguise, because the terms forbid circumventing security); keeps safe response headers of a refused sign-in
(server, via, x-cache, edge location, content-length, www-authenticate; never cookies); and, only when sign-in
fails for a reason other than bad credentials, makes three plain requests with **no credentials** (site home, the
API without a token, the public Report a Discrepancy page) plus a control request to www.gov.uk. 19 checks; three
more deliberate breakages each caught (keeping cookie headers, sending the secret on a diagnostic request, dropping
the honest user agent). One earlier check correctly failed when the diagnostics were added, and the rule was changed so
a 400 or 401 (service reached, credentials refused) is not diagnosed. `npm run lint` and `typecheck` clean.

**Needs John:** merge (the probe touches the secrets), run it again; look in the portal for a CSV download and
how it is fetched; and decide whether to email the Fuel Finder team now (draft below).

*Draft email, for John to send or change (no credentials in it):* Subject: Fuel Finder API returns 403 to requests
from GitHub Actions servers. "Hello. I registered as an Information Recipient on 24 October 2026 for a free,
non-commercial website showing nearby petrol stations. A request to
https://www.fuel-finder.service.gov.uk/api/v1/oauth/generate_access_token from a GitHub Actions server (a US
datacentre address) gets HTTP 403 with an empty body, and the same site also returns an empty 403 to ordinary page
requests from that kind of address. Is the API restricted by country or by network? If so, what do you recommend for a
small site that fetches data on a schedule and must meet the Fair Use rule of using the latest CSV or calling the API
at least every five minutes on average? Also, where can the CSV be downloaded automatically? Thank you. John Baish"

### 2026-10-24 — second probe run: the whole site is closed to GitHub's servers (on `main`)

John merged the diagnostics and ran the probe again (run 40011760477). Read from the log: the checks passed;
secrets showed as `***`; the token request to `www.fuel-finder.service.gov.uk` got HTTP 403, empty body,
`server: CloudFront`, `x-cache: Error from cloudfront`, edge `IAD61-P12`. **The three no-credential requests
(site home, the API without a token, the public `/motorist/price-report` page) all got exactly the same
403.** The control request to www.gov.uk got 200. **Conclusion:** the whole site refuses that address at the
content network; credentials are irrelevant and no sign-in has actually been tried. Same result as from this
session's container (another network). By country or by type of network is not yet known. John is **inclined to
email the Fuel Finder team on Monday** and cannot find a CSV link in the portal (he doesn't know where to look;
the regulations call it the "flat file").

**Asked of John:** open `https://www.fuel-finder.service.gov.uk/motorist/price-report` in his own browser (UK home
connection) and say whether it loads; add to the email the new evidence below; and, if he logs in to the portal
again, look for the words "CSV", "flat file" or "download".

*Revised draft email (replaces the earlier one; no credentials in it):* Subject: Fuel Finder site and API return 403
to requests from cloud servers. "Hello. I registered as an Information Recipient on 24 October 2026 for a free,
non-commercial website showing nearby petrol stations. Every request to www.fuel-finder.service.gov.uk from a
GitHub Actions server (a US datacentre address) gets HTTP 403 with an empty body from CloudFront, including your
public Report a Discrepancy page, so I can't get as far as signing in. Is the service restricted by country or by
type of network? If so, what do you recommend for a small site that fetches data on a schedule and must meet the
Fair Use rule of using the latest CSV, or calling the API at least every five minutes on average? Can the CSV be
fetched automatically from a fixed address, and can the API be opened to my server? Thank you. John Baish"

**Not an option, again:** disguising where requests come from (VPN or proxy). The Fair Use terms forbid
circumventing security measures. Possible, but unverified and more to look after: a collector on John's own
computer or Raspberry Pi as a GitHub self-hosted runner, or a free machine in a London cloud region (only if the
block is by country, not by cloud network). Decide after the Fuel Finder team answer.

### 2026-10-24 — John's one-click test: the public page loads from a UK home connection

John opened `https://www.fuel-finder.service.gov.uk/motorist/price-report` in his own browser and it **loads**. Together
with the two runs, this means the site is open to an ordinary UK home connection and closed to both this session's
container and GitHub's US datacentre address, so the rule is by country or by type of network (cloud and
datacentre addresses); which of the two is still not known. This is worth adding to the email: *"The same page loads
normally from my UK home broadband."* Nothing else changed; still waiting on the Fuel Finder team (John plans to email
on Monday 26 October).

### 2026-10-24 — PAUSED until the Fuel Finder team reply

John will email the team on **Monday 26 October**; the final wording is saved in
`design/email-fuel-finder-team-2026-10-24.md` (it adds that the public page loads from his UK home broadband, and asks four
numbered questions: restricted by country or network? recommended route for a scheduled site under the Fair Use rule? can the
CSV be fetched automatically, and from where? can the API be opened to a specific server?). **State:** everything is on `main`
(the probe with diagnostics, the notes, the saved documentation); nothing is running or scheduled; the two GitHub secrets
exist; no app, no page. **To resume:** a new thread on `main`, with their reply pasted in. Housekeeping for John: the network
allow-list still includes the Fuel Finder hosts and `assets.publishing.service.gov.uk`, and can be trimmed while paused.

### 2026-10-26 — the Fuel Finder team replied: a UK address is needed

John sent the email; the reply (probably automatic) is saved in `design/fuel-finder-team-reply-2026-10-26.md`. It lists
"an IP address outside the UK" first among the causes of a 403, and offers whitelisting for a service outside the UK
only for "a single static public outbound IP address". **Checked by web search:** GitHub's standard (free) runners use
changing Azure addresses and GitHub advises against allow-listing them; fixed addresses come only with "larger
runners", which need a paid Team or Enterprise plan. So whitelisting GitHub's servers is not possible for free, and
**the collector must run from a UK address.** Oracle's Always Free tier includes a London region (UK South), but
free capacity there can't be confirmed in advance (third-party guide; Oracle's own pages read were silent).

**Options put to John (PLAN, "26 October"):** A, a machine at his home (proven to reach the site); B, a free Oracle
machine in London (works only if the block is by country, not by data-centre network); C, other London cloud
services (need a card; not recommended). **Still to design:** publishing fresh prices every five minutes without a
Vercel rebuild each time. **Drafted:** a short follow-up email asking whether UK data centres are accepted and where the
CSV is (`design/email-fuel-finder-team-2026-10-26-followup.md`). No code changed.

### 2026-10-26 — follow-up email revised

John asked whether the follow-up clashed with his first email. It didn't contradict it, but it stated an undecided plan as
fact ("will run from a UK address") with no reason given. Revised in `design/email-fuel-finder-team-2026-10-26-followup.md`:
explains that GitHub's servers have no fixed address (so no whitelisting request), says he *plans* to move the job to a UK
address calling the API about every five minutes to meet the Fair Use policy, and keeps the same two questions. Kept short on
purpose.

### 2026-10-26 — follow-up sent; waiting again

John sent the revised follow-up (`design/email-fuel-finder-team-2026-10-26-followup.md`). Waiting for the answer to: are UK data
centres accepted, and where is the CSV? Still open with John: whether he has a computer at home that stays on (or would buy a
Raspberry Pi), whether he'd set up an Oracle account, and whether Claude should write the comparison of the two (including
publishing prices every five minutes without a Vercel rebuild each time). Also fixed: the Layout section above said Stage 1 was
not yet on `main`. No code changed.

### 2026-10-26 — John's answers on where the collector could run; the decision tree

No computer at home to leave on, and John would not buy a Raspberry Pi: option A is out. He would "potentially" set up an Oracle
account (option B). The comparison write-up is not needed. **Decision tree recorded in PLAN.md** (depends on the team's reply):
(1) CSV fetchable from an address GitHub can reach -> stays on GitHub Actions, twice a day; (2) else UK data centres accepted ->
Oracle London machine; (3) else Refueller stops and John moves on to his next project. No code changed; waiting for the team.

### 2026-10-26 — the second reply: UK cloud servers are accepted; the CSV is not an escape route

Saved in `design/fuel-finder-team-reply-2026-10-26-b.md`. **API: accepted from UK data centres including UK-hosted cloud servers.
CSV: needs a subscription and is UK-IP-only**, so it can't be fetched by GitHub's servers either. Outcome 1 of the decision tree is
gone; outcome 2 (a collector on a UK cloud machine, John's "potentially" Oracle account) is the only free automatic route. **Checked by
web search (secondary sources; Oracle's pages not read directly):** Oracle sign-up needs a card for verification (not charged unless
upgraded); **idle Always Free machines (all of CPU 95th percentile, network and ARM memory below 20% over seven days) can be
reclaimed**, and Oracle's suggested cure is to upgrade to Pay As You Go (no charge inside the free limits, but billing on); free ARM
capacity in London is not guaranteed. **Proposed:** a cheap feasibility test first (Oracle machine plus self-hosted runner, run the
existing probe there). Q9 is decided by necessity: API at least every five minutes. Awaiting John's go or no-go. No code changed.

### 2026-10-26 — why five minutes, and the third email

John asked why the collector would have to poll every five minutes. It is the Fair Use policy in the registration terms (quoted in
SPEC §2a): for a site promoting fuel retail to motorists, "the most up to date CSV, or ... the API ... on average ... not more than 5
minutes". Once a day is not covered, and the team had not answered that part of the first email. Claude's reading is the cautious one,
not a ruling. **John sent a third email** (`design/email-fuel-finder-team-2026-10-26-third.md`) asking whether twice-daily
refreshes in step with the CSV, with each price's age shown, would meet the policy. Noted: either way a UK-address machine is
needed (API and CSV are both UK-only); the answer only changes how heavy the setup is. **Oracle test on hold until they answer.**

### 2026-10-27 — the third reply: twice a day is fine (this reverses the five-minute conclusion)

Saved in `design/fuel-finder-team-reply-2026-10-27.md`. The team: the CSV is updated twice daily, "so you can use these publication times to
schedule your data refreshes"; "no requirement ... for your website to make API requests every five minutes" (that is how fast *their* API
updates after a price change); show when each price was last updated; the Fair Use policy still applies. **Correction:** my earlier reading
of the Fair Use wording (SPEC §2a item 2, and what I told John on 26 October) was too cautious for this site; their written answer is the
one to rely on. **Q9 decided: twice a day, in step with the CSV publication times, with price ages shown.** The five-minute design, and the
"publish data without a Vercel rebuild" problem, are gone. **Still needed:** a UK address for two short runs a day, so Oracle London (a machine
that would count as idle) or a small AWS London scheduled function (checked by search: EventBridge Scheduler has 14 million free invocations a
month on AWS's page; Lambda's 1 million free requests a month from a third party; new AWS accounts have a credit-based free plan that ends after
about six months unless upgraded), both with a card on file. **Open:** John's choice and comfort with a billing-enabled account; the CSV's two
publication times. No code changed.

### 2026-10-27 — John chose AWS London; the CSV time question

John: the portal's latest CSV was uploaded at 16:00 on 26 October (time zone unknown) and he wonders whether the second time can be confirmed
publicly; he is happy with a card and a billing-enabled account; **he chose AWS** (London). Claude suggested watching the portal page across a day
or two, or subscribing so that "new file" emails show the publication times, and noted the exact times matter little because the API is near-real-time
and every price carries its own timestamp. **Design sketched in PLAN.md ("27 October, later"):** Stage 1c, a feasibility test (the existing probe packaged
as a Lambda function in London, run once by John, log pasted back, which holds counts and shapes only); Stage 2, the collector as a function run twice a
day by EventBridge Scheduler in `Europe/London` time, saving the data file to this repo through GitHub's API with a repo-limited token (expiry to record).
Free-tier cautions listed (no private network, no Secrets Manager, budget alert, read AWS's own sign-up screens). Nothing built; waiting for John's go-ahead
on Stage 1c.

### 2026-10-27 — stage 1c built: the probe as an AWS Lambda package (branch `stage-1c-lambda`)

**John:** go ahead with the package.

**What:** split the probe into `scripts/lib/run-probe.ts` (no command-line code; also returns the redacted summary text) and a thin
`scripts/probe.ts`; added `lambda/make-handler.ts` (reads the two values from the function's environment variables, runs the probe, prints counts
and shapes only to the log, and returns the same redacted summary plus the AWS region and Node version, so the console's Test result can be
copied) and `lambda/handler.ts` (exports just `handler`). `scripts/build-lambda.mjs` bundles it with esbuild (a dev dependency, used only to build) into
`dist-lambda/index.mjs`: one 26 KB plain-JavaScript file importing only Node built-ins, no command-line code. `.github/workflows/lambda-package.yml`
("Build Lambda package": Run workflow only, read-only, no secrets) lints, type-checks, runs every check, builds, zips and keeps `refueller-probe.zip`
for 14 days as a download (the artifact is a zip around the zip: unzip once). `design/aws-test-steps-2026-10-27.md` is John's numbered guide: package,
account (read the plan screens and tell Claude before choosing), London region, budget alert, one function (Node.js 22.x, 512 MB, 5 minute timeout), the two
settings typed into AWS only, Test, paste the Response back. No function URL, no trigger.

**Checked here:** `npm run check` now includes `scripts/check-lambda.ts`: the handler against a fake server (missing settings; a full run returning the
summary with no secret, token or station code anywhere; a refused front door returning the diagnosis); and the real built bundle (one small file, only
`node:` imports, no command-line code, loads and exports only `handler`, answers plainly with the settings missing; the zip holds just `index.mjs`).
**Three deliberate breakages each made the right check fail** (the handler returning the secret; command-line code pulled into the bundle; an
unredacted setting echoed in the summary), then the code was restored. Lint, type-check and the earlier 19 checks are clean; the CLI still starts.

**Couldn't be checked:** anything on AWS itself (the console, the Lambda runtime's Node 22 version, whether a London AWS address is accepted, the
sign-up screens, the budget template's name): the steps are written from general knowledge and flagged as such. **Merged to `main` at John's word (27 October).** John will come back to the AWS test later; nothing is running or scheduled.

### 2026-10-27 — the CSV's second time; AWS sign-up lands in Stockholm (notes only)

**CSV:** John found the second daily publication time, **10am** (the other is 4pm), taken as UK time. The collector's two runs go just
after each. SPEC §2a and PLAN updated.

**AWS:** John first signed up through AWS's new quick sign-up, which made a "project" fixed to **Stockholm** (eu-north-1): in that
experience Europe always gets Stockholm (AWS's docs, via search; the pages themselves are blocked here), and Fuel Finder refuses
non-UK addresses. The "Agent Toolkit" prompt AWS offered (install the CLI and an MCP connection, give an AI tool ongoing account access,
add AWS's rules to `CLAUDE.md`) was read and **not run**: not needed for a console-only test. Of the two ways to reach London
(activate "advanced features", which removes the hard spend limit; or the full "advanced" sign-up), John chose the full sign-up and is
doing it now, on the free plan (6 months or $200 credit; then upgrade or the account closes; credits usable for 12 months after upgrading;
Always Free allowances continue). `design/aws-test-steps-2026-10-27.md` now points at the full sign-up. If Refueller goes ahead on AWS:
**upgrade before late April 2027**, after checking the then-current Lambda and Scheduler free limits. The Stockholm project is untouched.

### 2026-10-27 — the probe works from AWS London (notes only)

John made the full AWS account (London available), the budget, and the function `refueller-probe` (Node.js 24.x, as 22.x wasn't
offered or needed; the console's "Upload from" is now under **Update**), and pressed Test. **Fuel Finder accepted the London AWS
address:** sign-in, all 17 station and 17 price batches (8,146 stations, 8,141 price records), the incremental calls and the refresh
call all worked. `ok: false` only because the end of each list is a **404 on the next batch**, not an empty batch. Figures and what
they change in `design/probe-result-aws-2026-10-27.md`. New question: the seven-day "old price" flag would flag 69% of prices.
Q14 covers 458 stations. Nothing else running; the function only runs when John presses Test.

### 2026-10-28 — stage 2: the collector built (branch `stage-2-collector`)

**John's answers:** runs at 10.15am and 4.15pm UK time; old prices marked after 30 days, not 7 (Q7, B); 00:00 to 00:00 is closed
on those days, or "hours not given" when every day (Q14); the collector's commits go straight to `main`; unusual prices (more than 30p
from the middle price in Great Britain, provisional) shown with a note and the Report a Discrepancy link, never marked cheapest (B).
SPEC Q7, Q14 and PLAN Stage 2 updated.

**What:** an AWS Lambda function (not GitHub Actions: the API refuses non-UK addresses). Each run signs in, fetches every station and
price batch (one at a time, 0.8 s apart, at most one retry; the end of a list is the 404 seen on 27 October), keeps Great Britain by
postcode (BT, IM, GY, JE left out), drops permanently closed stations (a future closure date means still open), positions outside a
rough GB box, and stations with neither E10 nor diesel in 100p to 300p; keeps prices and "last updated" times exactly as given; marks
unusual prices; turns hours into "06:00-22:00", "24h" or "closed" per day. It saves `data/stations.json` (one station a line),
`data/prices.json` (keyed by the first 12 characters of the station code), `data/bank-holidays.json` (GOV.UK, when readable) and a
line in `data/runs/YYYY-MM.jsonl`, all in one commit to `main` through GitHub's API (starting again once if `main` moved). If Fuel
Finder fails, or fewer than 4,000 records come back, or fewer than 3,000 stations are kept, the data files are left alone and only
the run line is saved. Secrets: Fuel Finder values only to the Fuel Finder host, the GitHub key only to `api.github.com`; nothing
followed through redirects; everything logged, saved or returned passes `redact`. The handler never throws (AWS would re-run it).
The probe now also treats the end-of-list 404 as the end. The build workflow makes both packages.

**Checked here:** `npm run check`: the 19 probe checks, 17 new collector checks (the rules, then whole runs against a fake Fuel
Finder, fake GitHub and fake GOV.UK: a good run, secrets kept to their own servers, a refused sign-in, too few records, a first-batch
404, `main` moving while saving, foreign hosts refused, a missing setting) and 9 Lambda checks (both bundles: one file each, only
Node built-ins, only `handler` exported). Lint and type-check clean. **Four deliberate breakages:** three were caught at once (no
minimum count; unusual at exactly 30p; Northern Ireland kept). The fourth (the GitHub key sent to Fuel Finder in an extra header)
was **not** caught at first, because the check only looked at the authorisation header and the body; it now looks at every header,
and catches it. All code restored.

**Couldn't be checked:** the real API's behaviour beyond the 27 October probe, the real GitHub API, the AWS scheduler and the console
steps (written from general knowledge). **Merged to `main` at John's word (28 October);** he follows the steps on 29 October. Nothing runs until he creates the function and its timetable.

### 2026-10-29 — house style re-copied; dark mode from the start (notes only)

From clockwheel `cba1629` (John): every tool has a dark mode that follows the device's light or dark
setting until the visitor uses the switch (§2), built in from the start rather than asked about late
(§16). So the Refueller page (stage 5 onwards) is to be built with dark mode and mock-ups in both themes.

### 2026-10-29 — project tracker line (notes only, straight to `main`)

At John's request: a line in the key points asking future sessions to update
this project's file in the project tracker (`JohnBaish/baish.net-directory`)
when something significant changes.

### 2026-10-29 — house style re-copied (notes only, straight to `main`)

From clockwheel `aa12cd6`: §10 describes the project tracker
(`JohnBaish/baish.net-directory`) and when to update it; §16 adds the tracker to
starting a new tool. No app code changed.

### 2026-10-30 — collector set-up under way; GitHub key expiry (notes only)

John is following `design/aws-collector-steps-2026-10-28.md`. The "Build Lambda packages" run #2 worked (both packages).
Step 2 now describes the run page and its Artifacts list; Safari unzipped the download to `index.mjs`, so Claude told John to
check it (about 21 KB, first line `// scripts/lib/collect.ts`) and use Finder's Compress to make a zip; step 5 now explains
GitHub's new "Add permissions" box. **The collector's GitHub key expires 28 January 2027** (GitHub's 90-day default, which
John kept); in PLAN's "Dates to remember" with the AWS free plan's end and the GitHub API version cut-off. The project tracker
(`JohnBaish/baish.net-directory`) couldn't be updated from this session: adding that repo was refused by the session's
permission check, so John was asked.

### 2026-10-30 — the collector's first real run: green (notes only)

John made the function `refueller-collector` and pressed Test (09:08 UTC, 30.5 s, 37 Fuel Finder requests). **Saved commit `75d892d`
"Data: 2026-10-30 09:08 UTC"** with `data/stations.json` (7,535 stations, 2.4 MB), `data/prices.json` (887 KB), `data/bank-holidays.json`
and `data/runs/2026-10.jsonl`; together 626 KB compressed. Fetched 8,146 stations and 8,141 price records; left out 591 outside Great
Britain and 20 with neither fuel; none closed, none out of range; 48 temporarily closed; 3 with hours not given; middle prices E10
172.7p, diesel 199.9p; **16 unusual prices**, most of them old ones (last updated February to July) or 299.9p entries. Checked from
the repo: no Northern Ireland, Isle of Man or Channel Islands postcodes; nothing secret in any file. **Correction:** the probe's
"about 6,200 in Great Britain" counted by the unreliable `country` field; by postcode it is 7,535 (8,146 less 591 and 20).
**For later (Stage 5):** the page should load a smaller file made at build time; and `prices.json` changes every run, so watch the
repo's size. Next: John sets up the timetable (Part 5).

### 2026-10-30 — stage 4: first mock-ups (branch `stage-4-mockups`)

John set up the timetable (`refueller-twice-daily`, Europe/London, 10.15am and 4.15pm) and asked to move on to design, with RG4
as the place to show. **First round:** `design/mock/mock-results.html` (with `rg4.js`, the real stations and prices from the
9.08am collection, and a copy of clockwheel's `organic.css`), pictures in `design/previews/mock-1-*.png`: the postcode screen,
RG4's eight nearest open stations at 12.30pm Friday and at 11.30pm (five nearer stations closed), computer and phone, light and
dark, and labelled options ("Updated 3 days ago" with a "Cheapest" tag, or "Updated October 26th" with the cheapest shaded). A
dashed "Illustration only" box shows real stations with made-up problems (an unusual price, a price more than 30 days old, no
diesel). RG4's centre is Hindcaster's district centre (OS Open Names), turned into latitude and longitude. Names tidied for display
(capitals to ordinary case, BP and MFG kept); towns not repeated in addresses. All wording is draft, for John. Checked: both fonts
loaded, no sideways scroll at 1200px or at 390px with touch. **Seen in the real data:** 30-day-old diesel prices are common near
Reading. Not merged.

### 2026-10-30 — mock-ups, round 2 (branch `stage-4-mockups`)

**John:** "Updated 3 days ago" (not the date); the "Cheapest" tag (not shading); a gentler mark for prices more than 30 days old
(now just the "Updated …" line in terracotta, no "may be out of date"); station names in ordinary capitals, yes; the postcode
screen's heading "Check fuel prices near you". **Closed stations stay in the list** with "Closed until 7am tomorrow" (a grey pill,
the row a little faded); the heading is now "Eight nearest stations to RG4 (Caversham)" and the note says how many are closed
(SPEC §4 item 4 changed). Full stop after "Report a wrong price". Pictures `design/previews/mock-2-*.png`. Sorting by column and
full postcodes stay for later (SPEC Q10, Q4).

### 2026-10-30 — mock-ups, round 3 (branch `stage-4-mockups`)

John: centre the distance, price and opening columns under their headings (done; the station column stays left); the footer
says "Prices from the Government's Fuel Finder service." (capital G, "service" not "scheme"), and "not connected with the Fuel
Finder service" to match. Pictures `design/previews/mock-3-*.png`. John: "The rest looks really good."

### 2026-10-30 — mock-ups, round 4 (branch `stage-4-mockups`)

John: the "Cheapest" tag on its own line under the price, so every price lines up in its centred column. Done (price, then
the tag, then "Updated …"). Pictures `design/previews/mock-4-*.png`.

### 2026-10-30 — the timetable works (notes only)

John made the schedule `refueller-twice-daily` (EventBridge Scheduler, London, Europe/London, 10.15am and 4.15pm). Its first run
saved `2481f55` "Data: 2026-10-30 10:15 UTC" (10.15am GMT, the clocks having gone back on 25 October): ok, 37 requests, 106 s
(slower than the test's 30 s, still well inside the 5-minute limit), 7,533 stations kept. The collector now runs by itself.

### 2026-10-30 — stage 3: postcodes and the search rules (branch `stage-3-search`)

**John** approved the mock-ups ("ready to go onto the build").

**What:** `data/outcodes.json` from OS Open Names (downloaded here from `api.os.uk`; checksum as listed): 2,863 postcode districts in
Great Britain, each its postcodes' average position, as latitude and longitude, and its main place (RG4 Caversham, ZE1 Lerwick,
TR21 Hugh Town), with the three credit lines from the download's licence file (OS, Royal Mail, National Statistics). `src/lib/search.ts`:
the first half of a typed postcode (with or without a space; Northern Ireland and unknown districts explained); straight-line miles
("0.4 miles", "12 miles", "less than 0.1 miles"); open now, until when, or "Closed until 7am tomorrow" / "Closed until Monday 7am",
by UK clock time, with hours past midnight counting the next morning and bank-holiday hours on bank holidays (Scotland's dates for
Scottish postcodes, Berwick's TD15 English); the eight nearest (temporarily closed ones left out); the cheapest of each fuel, never
an unusual price, ties all marked; "Updated 3 days ago" and the 30-day mark; tidied names and addresses.

**Found with the real data:** 64 stations' postcodes come without a space (`CW13HD`), so the first half is now found by dropping
the last three characters; and the position check (a station more than 25 miles from the middle of its own postcode district is
left out) wrongly caught three Shetland stations and one in Wester Ross, whose districts are huge, so the Highlands and Islands
(ZE, HS, KW, IV, PA, PH) get 60 miles. It now leaves out 5 of 7,535 stations, placed 30 to 97 miles from their districts.

**Checked:** `npm run check` (search: 12 checks, worked examples by hand, including GMT and BST, the night the clocks go forward,
Christmas Day, St Andrew's Day and a Sunday-night bank-holiday Monday; the RG4 run on the fixed copy matches the mock-ups: Emmer
Green 0.4 miles, four closed at 11.30pm, "Closed until 6am tomorrow" at MFG Thames Valley). **Four deliberate breakages each caught**
(bank holidays ignored; the past-midnight rule dropped; an unusual price allowed to be cheapest; old at 30 days). Lint and type-check
clean. Not merged.

### 2026-10-30 — stage 5: the page built (branch `stage-5-page`)

**John:** "Let's go!" after Stage 3. The approved mock-ups (round 4) built as the real page, with Hindcaster's dark mode (following
the device until switched). **Data:** the whole station list is about 460 KB compressed, too much for every phone visit, so the
build splits it: `index.json` (7,480 station positions to four decimal places, the 2,863 districts, bank holidays; 108 KB
compressed) and 121 postcode-area files of a few KB. A search loads the index, picks the eight nearest, then only their areas (RG4:
one file; SW1A: four). Every visitor asks for the same files whatever they type. Temporarily closed stations (48) and those far from
their postcode (5) are left out at build time. **Added since the mock-ups (drafts for John):** "About these figures" (three
paragraphs: where prices come from and when they're collected; the fuels, the 100p to 300p range and the unusual rule; straight-line
distances from the district's middle, what's left out, usual opening hours); the postcode messages (empty, not a postcode, Northern
Ireland, not found); the OS credit lines in the footer ("Postcode positions: …", word for word from the licence file, and a check that
they match `data/outcodes.json`); "Finding stations…" and "Sorry, the prices couldn't be loaded" with Try again; a note if the latest
collection is more than a day old; draft page title and search description.

**Checked:** lint, both type-checks, `npm run check` (13 search checks now); built and used in Chromium at 1200px and at 390px with
touch, light and dark: the postcode screen, RG4 (the same eight as the mock-ups, prices from the 10.15am collection), ZE1 (Lerwick),
QQ1 (not found), BT1 (Northern Ireland), typing "rg4 7hn" and "RG47HN", Back between two districts, reopening on the remembered
district, the switch kept as `refueller.theme`: no sideways scroll; the only failed load is Vercel's statistics script, which exists
only on Vercel. Pictures `design/previews/page-*.png`. **Couldn't be checked:** a real phone, and Vercel (no Vercel project for
Refueller yet). Not merged.

### 2026-10-30 — Vercel project made; first preview (branch `stage-5-page`)

John made the Vercel project for Refueller. `stage-5-page` had been pushed before it existed, so it had no preview; this push
(with `main`'s latest data brought in) starts one. Preview link pattern (HOUSE-STYLE §10):
`https://refueller-git-stage-5-page-john-baish.vercel.app`. Vercel's status can be read from GitHub's commit-status API.

### 2026-10-30 — John's first look at the preview: box round the table; About full width (branch `stage-5-page`)

**John** (six points). Built for him to see on the preview: (1) the computer table now sits in a rounded box in the card
colour (`.table-box`, like the phone cards; last row's line dropped); (3) "About these figures" now runs the full width
of the table (its 760px limit removed). Picture `design/previews/page-box-computer.png`. Checked at 1200px light and
dark and 390px with touch: About and the table both 1,047px wide (355px on a phone), no sideways scroll, no errors.

**Found for his other points (nothing built):** (2) of the 1,373 price times that moved between the 9.08am and 4.15pm
collections on 30 October, 1,371 came with a new price and 2 with the same one, so "updated" in the data almost always
means "changed"; wording question put to John. (5) Whittington Garage (PE33 9TF) gives 6pm-10pm on four days and
6am-10pm on another, almost certainly a 12-hour slip. A narrow test (a day that opens exactly 12 hours later, or closes
exactly 12 hours earlier, than another day with the same other end) finds 17 stations, all of which look like slips;
genuine short island hours (Coll, Eday) are not caught. Options put to John; correcting the hours ourselves is not
proposed (Fair Use: alter nothing). (6) "Centre on this station" noted as a later feature: centre on the station's own
position, not its postcode district, still worked out in the browser.
(Housekeeping: `pkill -f` stopped this session's own shell, as in Hindcaster; stop preview servers by process number.)

### 2026-10-30 — "Price set", hours that look wrong, initials kept, About drafted (branch `stage-5-page`)

**John:** (2) "Price set 16 days ago" (was "Updated …"); (5) "Opening hours look wrong", no more detail, and Asda Harwich's
6.30pm-9.30pm every weekday must be caught too; initials kept in names (PE33 9RF "PC&AT Hudson", KT12 1RZ "TGC"); (4) asked
for a draft of the colours wording.

**What:** `updatedText` says "Price set …". `hoursLookWrong()` in `src/lib/search.ts`: a station's hours look wrong when any day
(bank holidays included) opens at 6pm or later and closes the same evening, or opens exactly 12 hours later / closes exactly 12
hours earlier than another day with the same other end; then it says "Opening hours look wrong" every day (not open, not
closed, never corrected). 19 stations on 30 October, all looking like slips; island shops' short hours and overnight hours not
caught. `tidyName`: a name or line with small letters is left exactly as typed; words with no vowel (A E I O U Y) kept in
capitals as initials, except the usual short forms (`SHORT`: Ltd, Rd, St, Cwm …); short pieces joined by "&" kept; "." and "&"
split words like hyphens ("D.J.Johnson"). "About these figures" redrafted for John to edit: when the price was set, and a "How
to read the list" list (Cheapest, orange "Price set", orange "Unusual price", grey "Closed until", "Opening hours look wrong").

**Checked:** `npm run check` (new checks for the names and the hours; making the evening rule 7pm made the Asda check fail, then
restored), lint, both type-checks, build; PE33, KT12 and CO12 at 1200px and 390px with touch: "PC&AT Hudson", "TGC – Walton
House", Whittington and Asda Harwich "Opening hours look wrong", no "Updated" left, no sideways scroll, no errors.
**Noticed, not changed:** Whittington Garage's address repeats "King's Lynn, PE33 9TF" (its first line holds the whole
address); trader typos such as "Holden Renualt" are shown as given.

### 2026-10-30 — 45 days, a note colour, "More" for hours, the graph in the plan (branch `stage-5-page`)

**John:** old prices marked after 45 days, not 30 (an unchanged price may be right); a colour other than orange for the
notes, as orange marks the cheapest; the hours bullet reworded ("the hours given by the station are unlikely to be right
(often 6pm given for 6am)." and nothing after); a "More" button explaining which rule caught a station's hours; and the
14-day price graph added to the plan (with a check against the Fair Use policy).

**What:** `isOld` is more than 45 days. `--color-note` (slate blue `#3f5f8a`, dark `#9fb8dc`; contrast 4.9:1 on the light
cards, 6.2:1 on the dark) for "Price set …" over 45 days and the "Unusual price" note; plum was the other option shown
(`design/previews/note-colour-options.png`). `hoursProblem()` returns the plain-English reason (the 12-hour comparison when
there is one, else the evening-only rule; days grouped, "Mondays to Saturdays", "bank holidays"); `hoursLookWrong` uses it.
`OpenCell` shows "More"/"Less" under "Opening hours look wrong" (44px tap target on phones) and the reason beneath. About
reworded to match. PLAN "Ideas logged for later": the 14-day graph and "Centre on this station", with notes.

**Checked:** `npm run check` (new: the three kinds of explanation, 45/46 days), lint, both type-checks, build; PE33 and RG9 at
1200px light and dark and 390px with touch: More opens and closes, reason as above, no sideways scroll, no errors.
**Noticed for John:** several "unusual" prices are genuine island prices (Scilly 209p, Hebrides 208.8p and 232.8p, Raasay).

### 2026-10-30 — high prices on the islands not marked unusual (branch `stage-5-page`)

**John:** slate blue agreed; if there's a good reason a price isn't unusual, don't mark it at all, and say in About which ones are
let off and why ("unless …").

**What:** `higherPricesUsual(postcode)` in `src/lib/search.ts`: the Highlands and Islands (ZE, HS, KW, IV; PA20 and above, not
Paisley's PA1-19; PH19 and above, not Perth's PH1-18; KA27-28 Arran and Cumbrae) and the Isles of Scilly (TR21-25). At build
time `scripts/lib/pageData.ts` removes the collector's "unusual" mark from a price above the GB middle there, so it is shown
plainly and can be the cheapest; a price far below the middle is still marked. The collector (on AWS) is unchanged, so
`data/prices.json` still carries the mark. On 30 October this lets off 7 prices at 5 stations (Scilly, Skerries, Raasay, Tiree,
Cluanie Inn), out of 181 stations in those areas. About's "Unusual price" bullet now ends "…, and may be a mistake, unless the
station is in the Highlands and Islands of Scotland or on the Isles of Scilly, where higher prices are usual: there, a higher
price isn't marked. An unusual price is never marked as the cheapest." (draft, for John).

**Checked:** `npm run check` (new: the areas, including Paisley, Perth, Penzance and Truro left out, and the build step: a high
island price unmarked, a low one and a mainland one still marked; making the rule unmark low prices instead made it fail; the
check was first added after the file's summary line and so not counted, then moved), lint, both type-checks, build. Typed RG9 5QL,
TQ1 4AH, PE33 9TF, IV51 9JS, TR21 0JY and PA77 6UP at 1200px and 390px with touch: an unusual note only at RG9, the blue 45-day
line at TQ1, "More" at PE33, none of the island prices marked; no sideways scroll, no errors.
**Found:** every unusual price outside those areas on 30 October is also more than 45 days old.

### 2026-10-30 — names typed all in small letters (branch `stage-5-page`)

**John** (TR21): "trewellard garage petrol station" should have capitals. The rule left any line with small letters as typed; now
only a mix of capitals and small letters is left as typed, and a line all in small letters is treated like one in capitals
("Trewellard Garage Petrol Station", "R S Morphet Ltd"). 118 names and address lines on 30 October, all read through: sensible,
apart from what the stations' own typing can't tell us ("je garner" shows as "Je Garner", probably J E Garner).
`npm run check` (new checks), lint, type-check, build.

### 2026-10-30 — idea: cheapest on the way (notes only)

John: type a destination too, and see the three cheapest prices roughly on the way against the station nearest the start, and the
same at the other end. Added to PLAN "Ideas logged for later" (item 3) with notes: no routing service (it would send both
postcodes to a third party), so "on the way" means a small extra straight-line distance, worked out in the browser and worded as
an approximation; objective ranking, so within the Fair Use policy; data and the calculator to settle with a mock-up.

### 2026-10-30 — stages 3 to 5 merged to `main`; wording agreed

**John:** all the draft wording agreed ("About these figures", the postcode messages, the footer's "Postcode positions" line,
the page title and search description); "cheapest on the way" to say "may be close to the route", explained in About (PLAN
idea 3); merge, then on to stage 6. `stage-5-page` (with stages 3 and 4 in it) fast-forwarded into `main` after the checks,
lint, type-check and build. Vercel now builds the page from `main` (on Vercel's own address; `refueller.baish.net` comes in
stage 6), and again after each collection.

### 2026-10-30 — house style re-copied (notes only, straight to `main`)

From clockwheel `674122d`: §2 dark mode also sets finer text smoothing (Macs), §3 never bold
Caprasimo. The page, when built, should include both. No app code yet.

### 2026-10-30 — stage 6: favicon options (branch `stage-6-launch`)

**What:** three options in `design/favicon-options/`, drawn to the house recipe (48×48, circle r=21, cream with a 2.5px terracotta
ring or solid terracotta, ink and terracotta shapes): A, an ink fuel pump with a terracotta hose; B, a terracotta drop of fuel; C,
A on solid terracotta. `design/favicon-options.html` (from Hindcaster's) shows them at 16, 32, 48 and 96px beside the Clockmaker,
Backtimer, Flowcharter, Hindcaster and baish.net icons in a row of browser tabs; renders `design/previews/favicon-options*.png`
(2x and 1x). Nothing wired in; waiting for John's choice.

### 2026-10-30 — favicon A chosen and wired in (branch `stage-6-launch`)

**John chose A** (the fuel pump). `public/favicon.svg` (a copy of `design/favicon-options/a-pump.svg`), linked from `index.html`;
the build copies it into the site. Next: the link-preview wording, then the image.

### 2026-10-30 — link-preview image drafted (branch `stage-6-launch`)

**John:** tagline "Nearby fuel prices", to be updated when Refueller gains more features (noted in PLAN, Stage 6).
`design/og-refueller.html` from Hindcaster's `og-hindcaster.html` (same layout, positions and fonts loaded by path): the
favicon's pump drawn large on the pale disc, title "Refueller", tagline "Nearby fuel prices" (no full stop, as John wrote it).
Rendered at 1200×630 to `design/previews/og-refueller.png`; Caprasimo 400 and Figtree 600 confirmed loaded. Waiting for John's
approval before it goes in `public/` with the `og:`/`twitter:` tags.

### 2026-10-30 — tagline tried as "Nearby petrol and diesel prices" (branch `stage-6-launch`)

John asked to see "Nearby diesel and unleaded petrol prices" (rendered on one line and on two,
`design/previews/og-refueller-one-line.png` and `-two-lines.png`), then preferred "Nearby petrol and diesel prices" (no full stop).
`design/og-refueller.html`, `design/previews/og-refueller.png` and PLAN's note updated; it fits on one line with room to spare.
Fonts confirmed loaded. Waiting for John's approval before wiring in.

### 2026-10-30 — link preview and search set-up wired in (branch `stage-6-launch`)

**John** approved the image. `public/og-refueller.png` (copied from the render); `index.html` gains the canonical link
(`https://refueller.baish.net/`), a comment on what the tags are for, and `og:`/`twitter:` tags (title "Refueller", description
"Nearby petrol and diesel prices", the image, `summary_large_image`). `public/robots.txt` (allow all, sitemap line) and
`public/sitemap.xml` (the one address), plain files as the project serves only its own domain (SEO-HANDOVER item 8). The page
title and search description were agreed on 30 October. The tags point at the final domain, so link previews only work once it
is set up. **Checked:** build, `npm run check`, lint, type-check; `vite preview` at 1200px and 390px with touch: tab title,
canonical, preview tags and favicon correct, no errors or sideways scroll; robots.txt, sitemap.xml, the image and the favicon
all served with the right types.

### 2026-10-30 — postcode example RG1; shorter footer on the postcode screen; stage 6 merged to `main`

**John** (on his phone, the stage 6 preview): use Hindcaster's example postcode, "RG1 or RG1 8FR"; the postcode screen doesn't need
the whole footer; otherwise merge. **What (`src/App.tsx`):** the box's example "RG1 or RG1 8FR", the messages "Please type a
postcode, such as RG1 8FR." and "Try one like RG1 or RG1 8FR.", the hint "Only the first half (RG1) is used."; on the postcode
screen the footer keeps only the project and privacy paragraph and the last line, and the Fuel Finder and postcode source lines
appear with the results (where prices and positions are shown). **Also added (house style §8 and §12, missed before):**
"Contact: workshop@baish.net." after "More free tools at www.baish.net.", as plain text. **Checked:** checks, lint, type-check,
build; at 1200px and 390px with touch: the new example, both messages, the short footer on the postcode screen, the full footer
on RG1's results (Reading), no errors, no sideways scroll. Picture `design/previews/page-start-phone-2026-10-30.png`. Then merged
`stage-6-launch` into `main` at John's word (favicon, link preview and tags, canonical, robots.txt, sitemap.xml, these changes).
**Next (John):** add `refueller.baish.net` to the Vercel project and switch on Web Analytics.

### 2026-10-30 — the house style's dark-mode smoothing added (on `main`)

Merging stage 6 met the other session's house-style entry (clockwheel `674122d`) in this file; both entries kept. As that entry
asks, `src/styles/global.css` now has the finer text smoothing in dark mode (HOUSE-STYLE §2), in the screen-only block after the
dark colours. Checked for the other rule, no bold Caprasimo: nothing on the page sets the heading font bold (it is 400 everywhere).

### 2026-10-30 — launch steps held back; more features first (notes only)

**John:** the domain, Web Analytics, Search Console and the baish.net landing card wait until more features are built; he is not
sure about the straight-line approach for "may be close to the route", to be discussed. PLAN Stage 6 and idea 3 updated. Next:
John chooses which feature to build first.

### 2026-10-30 — "Centre on this station" built (branch `feature-centre-station`)

**John** agreed the order of work (centre on a station, then the calculator, then the 14-day graph, then "may be close to the
route") and said go. **What:** a "Centre on this station" link under each station (table and phone cards; 44px tall on a phone)
opens `#station/<area>/<code>`: the eight nearest to that station's own position, itself first with "This station" in place of a
distance, and no link of its own. Heading "Eight nearest stations to Caversham Esso Express", notes "Straight-line distances from
Caversham Esso Express." The address uses the station's own 12-character code, now carried as a tenth field in the area files
(`DetailRow`), so it keeps working after each collection; a code no longer listed says "That station isn't listed any more. Try a
postcode instead." `nearestFrom()` in `src/lib/search.ts` (nearestEight now uses it), `postcodeArea()` shared with
`scripts/lib/pageData.ts`; `App.tsx` reads either kind of address. Nothing is sent anywhere: the address after "#" stays in the
browser and the visit statistics drop it. Not remembered as the last choice (reopening the page still goes to the last postcode).
Wording drafted, for John: "This station", the heading, the not-listed message.

**Checked:** `npm run check` (new check: the eight from a station, itself first and cheapest, the ninth left out; areas from
postcodes), lint, both type-checks, build; at 1200px and 390px with touch: RG4 shows eight links, the second opens Caversham Esso
Express's eight (seven links), Back returns to RG4, a reload keeps the station, an unknown code gives the message, no errors, no
sideways scroll. Pictures `design/previews/centre-*.png`.

### 2026-10-30 — the link renamed "Find stations near this one"; merged to `main`

**John:** "Centre on this station" wasn't obvious at a glance; chose "Find stations near this one" (option A of five); "This
station", the heading and the not-listed message agreed; reopening the page stays on the last postcode. The link and the comments
renamed. **Checked:** checks, lint, type-check, build; at 1200px, 390px and 320px with touch: eight links with the new words, a
tap opens the station's eight, no errors, no sideways scroll. Merged `feature-centre-station` into `main` at John's word.
**Next:** the calculator's questions.

### 2026-10-30 — road routes in the browser: feasibility test (notes only)

**John** asked whether anything better than "as the crow flies" was possible for "may be close to the route". Tested OS Open Roads
(OS OpenData, GB, October 2026): motorways, A and B roads joined into a 1.16 MB (compressed) network routes Westminster to
Edinburgh in 0.23 s on a browser slowed to phone speed, all on the visitor's device. Road-to-straight ratios ran from 1.11 to 1.58
(Cardiff to Bristol), so a single allowance doesn't fit. Findings, caveats (no one-way streets, figures probably a little short)
and conclusions in `design/road-routing-feasibility-2026-10-30.md`; PLAN idea 3 points to it. Download and scripts in the
scratchpad only (the 3.4 GB unpacked data deleted after).

### 2026-10-30 — the calculator's questions answered (notes only)

**John:** a "Worth driving here?" panel under each station; compared with the nearest open station selling that fuel; the visitor
types £ to spend (starting at £50) and mpg (starting at 36 for petrol, 43 for diesel, typical figures they can change; NimbleFins,
seen in a search summary only); litres = £ ÷ the nearest price; extra miles from road routes, shown as "about N miles" and editable;
fuel buttons; fuel, mpg and £ remembered on the device; the agreed wording. Recorded in PLAN Stage 7. Next: the mock-up.

### 2026-10-30 — calculator mock-ups (notes only)

The real RG4 page with a "Worth driving here?" link under each station and the panel opened under Reading Extra (Tesco), compared
with Emmer Green Esso (the nearest open station selling unleaded): `design/previews/calc-{not-worth,worth}-{computer,phone}.png`.
Figures worked out from the day's real prices and a road network of every road round Reading: £50 at 36 mpg and about 4 extra miles,
"Not worth it" (88p of fuel against 57p saved; worth it at 3.1p a litre cheaper); £90 at 50 mpg, "Worth it" (£1.03 saved, 64p of fuel,
39p better off). The sums checked against the handover's example (38p, 2.05p). Main roads alone proved too coarse for such short
trips; the findings added to `design/road-routing-feasibility-2026-10-30.md`. Panel styles injected in the browser only; no app code.

### 2026-10-30 — stage 7: the calculator built (branch `stage-7-calculator`)

**John:** "Go for it" on the agreed design (PLAN Stage 7).

**Road miles:** worked out once, here, not on visitors' phones: `scripts/build-road-miles.ts` reads every road in OS Open Roads
(October 2026: 3.4 million junctions, 4 million links) and finds the shortest route from each of the 2,863 postcode district middles
and 7,535 stations to their 12 nearest stations (90 seconds in all). `data/road-miles.json` is 2.4 MB (1 MB compressed); the page
loads only one area's part, when a panel opens (RG: 6 KB compressed). RG4 agrees with the feasibility test (Emmer Green 0.6 miles,
Reading Extra 2.5). 745 of 34,356 district figures and 1,028 of 90,420 station figures have no road route, almost all on islands
(PA 49, IV 19, PO 11, KW 9: ferries); there the miles box starts empty and asks. One-way streets aren't known, so figures may be a
little short.

**The panel:** "Worth driving here?" beside "Find stations near this one" opens it under the station (one at a time). It compares
with the first open station in the list (nearest as the crow flies) selling the fuel at a usual price; extra miles = twice the
difference in road miles from where the list is measured, one decimal under 5 miles. Cases: doesn't sell it; unusual price; nothing
to compare; this is the nearest; same price or dearer. Fuel, £ and mpg remembered (`refueller.calc`). Hidden when printing.

**Drafts for John (Claude's):** the case sentences; "About even:" when the two round to the same; the About paragraph; the footer
line "Road distances: Contains Ordnance Survey data © Crown copyright and database right 2026." (word for word from the licence file,
checked); the privacy sentence now lists the calculator's choices. **Two small changes from the mock-ups:** "better off" is worked
from the rounded figures so it adds up (£1.03 less 60p is 43p, not 42p); and the break-even is rounded up, as it says "at least"
(1.24p shows as 1.3p, not 1.2p). The fuel buttons are in Figtree, not the mock-up's Caprasimo (house style: no bold Caprasimo).

**Checked:** `npm run check` (new: `scripts/check-calc.ts`, the handover's example 38p and 2.1p, the mock-ups' figures, wording,
typing, the station compared with, the credit, RG4's road figures, the area split), lint, type-check, build. In Chromium at 1200px
and 390px with touch, light and dark: RG4's Reading Extra (not worth it at £50 and 36 mpg; worth it, 43p better off, at £90 and 50
mpg), diesel, the nearest station itself, same price (MFG Leander), a station view, HS1 and ZE2, no road file (empty box, then typed),
choices kept after a reload, print hides it, no sideways scroll, no errors. Pictures `design/previews/calc-built-*.png`. Not merged.

### 2026-10-30 — "Worth driving here?" only where it can help (branch `stage-7-calculator`)

**John:** show the link only where it's useful. `cheaperFuels()` in `src/lib/calc.ts`: the link appears on a station only when it
is cheaper than the nearest open station selling that fuel (at a usual price) for unleaded or diesel; the panel opens on the
remembered fuel if that is one of them, otherwise on the one it is cheaper for (only pressing a fuel button changes the remembered
fuel). A station closed now but cheaper still gets it (the panel says it's closed). **Checked:** `npm run check` (new check: the
nearest itself, same price, cheaper for diesel only, an unusual price, closed but cheaper), lint, build; RG4 (3 of 8), SW1A (5),
M1 (4) and TR21 (none) at 1200px and 390px with touch; no errors, no sideways scroll.

**John also asked** whether full postcodes were due by now: no. Q4 was "district centres, for now", and full postcodes were left for
later in the mock-up round of 30 October; they aren't yet in the agreed feature order.

### 2026-10-30 — stage 7 merged to `main`; full postcodes in the plan

**John:** merge and put it live; all the draft wording stands. Brought in `main`'s data commits; checks, lint and build clean;
`stage-7-calculator` merged into `main`, so Vercel's production build (still on Vercel's own address) has the calculator. Full
postcodes added to PLAN "Ideas logged for later" (item 4), next after the 14-day graph, with the wording with and without the
second half still to work out.

### 2026-10-31 — the history check ran: Fuel Finder holds no earlier prices (notes only)

John built the package from `probe-price-history` and ran `{"history": true}` on `refueller-probe` from his phone. Result in
`design/probe-result-history-2026-10-31.md`: the "changed since 17 October" call returned 6,204 stations, each once, every price and
"set" time identical to the current call. **No history is available from Fuel Finder;** the 14-day graph has to build on our own
collections (from 30 October; a full fortnight on about 13 November). Stations missing from that list (about 1,939) had no change in
the fortnight. The branch stays unmerged (the check isn't needed again); the test function now runs the branch's code, and `{}`
still runs the usual probe. Phone tips that worked: the artifact's own download link, Files unpacking the wrapper, and
`https://console.aws.amazon.com/` (not aws.amazon.com, whose "Create profile" is an AWS Builder ID).

### 2026-10-31 — 14-day graph, option A: mock-ups (notes only)

John asked to see option A (build the graph now and let it fill in). Mock-ups from the real RG4 prices in the three collections of
30 October, drawn into the built page in the browser only (`design/mock/graph-mock.cjs`; no app code): a "Price history" link and a
panel under the station, like the calculator, with Unleaded/Diesel buttons, this station's price as a step line from each price's
own "set" time, a dashed line for the average of the eight shown (only once all eight prices are known: from 3pm on October 29th),
"Not recorded" shading before the first known price, a sentence saying the same in words, and a note on when recording began.
Already real: Caversham Esso Express shows the full fortnight (177.9p since October 14th, then 175.9p), because its earlier price was
set before the window. Colours checked with the dataviz validator (light #c05a14 and #5f5a52, dark #cf7a3f and #7a7266): all checks
pass except the grey's "chroma floor", which is deliberate (a grey reference line), with dashes as the second cue. Pictures
`design/previews/graph-*.png`. All wording is draft.

