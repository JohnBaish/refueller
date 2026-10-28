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
   `JohnBaish/clockwheel` on 2026-10-23 (at clockwheel commit `36378ed`).
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
Stage 2 (branch `stage-2-collector`): `scripts/lib/clean.ts` (the rules, no network), `scripts/lib/collect.ts` (one run: Fuel Finder,
bank holidays, one commit to `main` through GitHub's API), `lambda/collector.ts` and `lambda/make-collector.ts`, `scripts/check-collect.ts`;
`npm run build:lambda` makes `dist-lambda/collector/` and `dist-lambda/probe/`. Data on `main`: `data/stations.json`, `data/prices.json`,
`data/bank-holidays.json`, `data/runs/YYYY-MM.jsonl`. John's steps: `design/aws-collector-steps-2026-10-28.md`.
No app yet.

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
steps (written from general knowledge). Not merged: John to say.
