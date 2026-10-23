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
- **Show prices without bias and never alter timestamps** (the scheme's terms
  as the handover reports them; to be checked against the original).
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

Nothing is built yet. Files so far: `SPEC.md`, `PLAN.md`, `README.md`, this
file, `HOUSE-STYLE.md`, `SEO-HANDOVER.md`, `.claude/skills/fresh-look/`,
`design/handover-2026-10-22.md`, `.gitignore`.

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
