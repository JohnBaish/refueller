# Refueller — specification

**Working name and tagline, both for John to confirm:** Refueller, at
`refueller.baish.net`. Draft tagline: "Find the cheapest fuel near you at a
glance."

A free-to-use personal project by John Baish. Enter a postcode and see the
eight nearest petrol stations that are open, with their unleaded and diesel
prices. Later, a small calculator to see whether a longer drive to cheaper
fuel is worth it.

This file is the design, being agreed with John. `PLAN.md` says what gets
built in what order. `HOUSE-STYLE.md` (copied from `JohnBaish/clockwheel`,
which holds the master copy) covers everything shared with Clockmaker,
Backtimer, Flowcharter and Hindcaster: colours, type, buttons, phone rules,
hosting and ways of working. Where this file is silent, follow the house
style; where they disagree, ask John.

The source is John's handover from a Claude.ai chat, kept unchanged in
`design/handover-2026-10-22.md`. It has the detail on the data source and the
calculator; this file has what is proposed.

**Status, 23 October 2026.** John's first answers are recorded in §11. Anything
not yet confirmed is **Proposed**: Claude's draft for John to confirm, change
or turn down. Q3 (the terms) is answered (§2a); still open: how often to refresh (Q9, now
constrained by the Fair Use policy) and Q14.
Nothing is built.

**What has and hasn't been checked.** This container can't reach the Fuel
Finder developer site, GOV.UK or postcodes.io (the session's network policy
refuses them), so **none of the handover's endpoints, field names or terms
has been tested against the real source.** A web search confirmed only that
GOV.UK publishes a guidance page for the scheme with three routes in (a CSV,
an emailed CSV and an API), that the CSV is updated twice a day, and that the
API uses OAuth 2.0 client credentials after a GOV.UK One Login. The
handover's calculator example was checked by code and is right (§9).

---

## 1. What it does (Proposed)

A visitor types a postcode. Refueller shows the eight nearest petrol stations
that are open at that moment, nearest first, each with its unleaded and diesel
price, how old the price is, how far away it is and when it closes.

- **Clean and neat**: one box, one list. No accounts, no adverts, no maps in
  the first version.
- **Nothing a visitor types or chooses goes to a server** (§6). Their
  postcode is turned into a position, and the nearest stations picked, inside
  their own browser. The only thing we record is anonymous visit statistics
  (no cookies, no personal data), as on Hindcaster.
- **Prices shown as they are**: the Fuel Finder terms ask for prices to be
  shown without bias, so nothing is hidden to favour a brand and timestamps
  are never altered (§2).
- A calculator, "is it worth driving further?", comes later (§9).

## 2. Data source: the government Fuel Finder scheme (Proposed; unverified)

### 2a. Terms of access, read 24 October (these override the "unconfirmed" statements below)

John pasted the registration text, "Terms and conditions of access", saved unchanged in
`design/fuel-finder-terms-of-access-2026-10-24.md`. In short:

1. **Licence (settled).** Registering means agreeing to "the terms and conditions of the
   Open Government Licence as well as the Fair Use policy of the Aggregator". The version
   isn't stated (v3.0 is the current one; to check on the National Archives page). The OGL
   lets the data be copied, published and distributed with attribution, so **a public repo
   and a trimmed public data file are allowed in principle**, which greatly eases the
   "Don't redistribute raw API data" worry (§2 below); the safeguards still stand (no raw
   responses, no secrets). Credit wording to be agreed (the usual OGL line is "Contains
   public sector information licensed under the Open Government Licence v3.0.", from
   memory, to check).
2. **The freshness rule (this changes the plan).** Anyone using the data "for any purpose
   that promotes fuel retail opportunities to the motoring public" **must "utilise the most
   up to date CSV, or call the API with a frequency that on average in a single day is not
   more than 5 minutes"**, so the page doesn't differ materially from the database.
   **Collecting four times a day does not meet this.** Options, for John (new Q9):
   - **A. Use the CSV, always the latest.** The CSV is updated twice a day, so use each one
     when it appears. Compliant on the policy's own words; two rebuilds a day; simplest and
     cheapest. Prices can be up to about half a day old between files, so each price shows
     its age. **Unknown:** how to fetch the CSV automatically (the portal download may need a
     login; the email route sends a link) and what its columns are.
   - **B. Call the API at least every five minutes on average.** About 288 runs a day, each
     fetching all prices (about one request per 500 stations, one at a time). Far fresher.
     But **288 site rebuilds a day exceeds Vercel's 100 deployments a day**, so the data would
     have to be published somewhere that doesn't rebuild the site (for example a separate
     static host that the page fetches from). More parts, more to break, and the aggregator
     monitors usage and can throttle or suspend.
   - **C. Ask the Fuel Finder team** whether twice-a-day API use, with each price's age shown,
     satisfies the rule. The wording says "must", so don't assume.
   Recommendation: A if the CSV can be fetched automatically, otherwise B. Decide after
   registration shows the CSV route.
3. **"Report a Discrepancy" link (required).** Either link to
   `https://www.fuel-finder.service.gov.uk/motorist/price-report` or pass on complaints about
   prices to the aggregator. A link is simplest. (That address also suggests
   `www.fuel-finder.service.gov.uk` is the API's host.)
4. **Presentation rules.** Don't amend or hide prices to favour or hinder a trader or "present
   a false image"; present prices unbiasedly; "not manipulate, filter, or selectively display
   data to favour certain suppliers"; price comparisons on "objective criteria"; no changes
   "that could mislead"; no altered timestamps or metadata. Nearest-first by distance and
   marking the cheapest are objective. **Three judgement calls for John, each objective but a
   form of filtering, so each is to be disclosed in "About these figures":** leaving out
   prices outside 100p to 300p (Q7), leaving out stations whose position disagrees with their
   postcode (SPEC §4), and showing only unleaded and diesel (Q6).
5. **Outages.** Not a breach if caused by things outside our control (outages, power cuts,
   force majeure), while taking reasonable steps. The plan to keep the last good copy and show
   its age is the right behaviour.
6. **Enforcement.** The aggregator may monitor use, ask for evidence, throttle, suspend or
   terminate access, and report breaches to regulators. So compliance needs to be reliable,
   not approximate.

**Corrections to my earlier notes:** "Collecting four times a day is much lighter than
[the caching advice]" and "four a day likely" ignored this Fair Use rule, and the earlier
"licence not confirmed" and "ask in writing about raw data" points are now largely answered
by the OGL (a short email to confirm the freshness reading is still worthwhile, Q9).

From the handover, not yet checked against the official documents:

- Statutory scheme live since 2 February 2026, run by DESNZ and operated by
  VE3 Global, enforced by the CMA. Stations must report price changes within
  30 minutes. About 99% of UK fuel sold is covered.
- Free registration through GOV.UK One Login, which only John can do (it is
  his identity). Access is by API (OAuth 2.0 client credentials) or a CSV
  download updated twice a day.
- The handover lists endpoints (`/api/v1/oauth/generate_access_token`,
  `/api/v1/pfs?batch-number=N`, `/api/v1/pfs/fuel-prices?batch-number=N`),
  about 500 stations a batch and 15 or more batches, with stations and prices
  joined on `node_id`. **To be confirmed in Stage 1** by a probe run from
  GitHub Actions, as Hindcaster did for the Met Office.
- Fields the handover saw: station name, brand, location (address, postcode,
  latitude, longitude), opening times per weekday with an all-day flag,
  temporary and permanent closure flags, amenities; prices as pence per litre
  with `price_last_updated` and `price_change_effective_timestamp`. Fuel types
  `E10`, `E5`, `B7_STANDARD`, `B7_PREMIUM`, `B10`, `HVO`.
- Known quirks (handover): the supermarket flag is unreliable; prices can be
  stale; the API has outages (often a 503 from the token endpoint) and no
  status page; no price history is kept.

**Checked on 23 October from the official pages (GOV.UK and the regulations,
now reachable; the developer portal is not yet):**

- GOV.UK's guidance page (published 2 February 2026, Department for Energy
  Security and Net Zero) confirms: the data covers retail fuel prices "across
  the UK", with forecourt details (address, operator, brand), amenities, opening
  hours and update timestamps; "prices are published within 30 minutes of any
  change"; three ways in (a CSV "updated twice a day", the same by email, or the
  API); the API follows REST and supports OAuth 2.0 client credentials; you need a
  GOV.UK One Login. Help: the Fuel Finder team at VE3 Global (an email address
  and a phone line on GOV.UK's help page).
- The law behind it is SI 2025/1356, the Motor Fuel Price (Open Data) Regulations
  2025 (made 17 December 2025; the sharing parts in force from 2 February
  2026). Regulation 13: the price API is updated within 5 minutes of a trader
  reporting a change, and the flat file is provided twice a day. Anyone who
  registers to get the data is an "information recipient" (regulation 12).
  **Regulation 13(5) and (6): the aggregator "may specify standards relating to
  the use by information recipients of the price API, the flat file and the price
  information", and may withhold the data from anyone who doesn't comply.** The
  regulations say nothing about the Open Government Licence or attribution.
  Schedule 1 lists what stations report: trading name, brand, address, latitude
  and longitude, usual trading hours, amenities, grades of fuel offered, the
  price of each, and whether temporarily closed.

**So the Open Government Licence claim in the handover is not confirmed, and the
real terms are the aggregator's "standards", which sit on the developer portal
and in the registration process.** The community thread that mentioned an
"Information Recipient" registration and a "Fair Use" policy now looks right
about the registration (it is in law) and probably about a fair-use policy;
neither has been read. The handover's credit ("Contains public sector information
from the Fuel Finder scheme, licensed under the Open Government Licence v3.0.")
and its usage terms (present prices without bias, don't filter selectively to
favour suppliers, don't alter timestamps; sorting by distance or price is fine)
still need checking in the original.

**Second-hand, from search snippets (24 October; not read at source).** A forum
post says registration binds the user to the Open Government Licence and the
aggregator's Fair Use policy; that the policy bars altering or hiding prices to
distort the market, and requires prices to be presented without bias and not
modified in misleading ways; and that recipients must link to a "Report a
Discrepancy" feature or pass on complaints about the price data. **Correction (24 October):** a search snippet suggested the CMA's guidance on its
enforcement functions (18 December 2025) says the fuel data may be reused under
the Open Government Licence. Now that the PDF has been read in full, that
sentence is only the document's own Crown copyright notice, so it says nothing
about the data. The guidance is about enforcement against fuel traders; it does
describe the intended users of the data as "fuel price comparison and
navigational apps and websites which would make this information available to
consumers" (paragraph 11), which is what Refueller is. **Whether the data is under the Open
Government Licence therefore rests only on the forum post, until the portal's
terms are read.** If the forum post is right, a public repo and a trimmed public
data file are fine, and Refueller would need a credit line, a not-endorsed line
and a "Report a discrepancy" link. The portal (`www.developer.fuel-finder.service.gov.uk`) is
reachable by the proxy now, but its CloudFront layer answers an empty 403 to this
container even from a real browser, so it may block requests from outside the UK
or from cloud addresses; the same could apply to the API from GitHub Actions
(Stage 1's probe will show).

**First real probe run (24 October, GitHub Actions run 1).** The checks passed on GitHub and no
secret appeared in the log. **The API host is `www.fuel-finder.service.gov.uk`** (the handover was
right; `api.fuelfinder.service.gov.uk` and `api.fuel-finder.service.gov.uk` don't exist in DNS). But
**the token request got HTTP 403 with an empty body**, not the documented 401 for bad credentials:
the same blank 403 this session's container gets from the developer portal and from the site's own
pages. So the service seems to refuse requests from GitHub's servers (and cloud addresses like it)
before it reads them, probably by location or network. **Second run (same evening), with diagnostics, settles the nature of the block:** *every* request to
`www.fuel-finder.service.gov.uk` from GitHub's server got the same empty HTTP 403 from CloudFront, with
`x-cache: Error from cloudfront` and the edge location `IAD61` (Washington DC area): the site's home page, the
API with no token, and even the public "Report a Discrepancy" page meant for motorists. A control request to
www.gov.uk from the same machine got 200. So **the whole site is closed to that address at the content network,
long before any API or credential check; the credentials are not involved.** Two unrelated networks (this
session's container and GitHub's) are refused in the same way. Still unproven whether the rule is by country or
by type of network (cloud and datacentre addresses); a request from an ordinary UK home connection is the
test, and John can make it by opening the Report a Discrepancy page in his own browser.

**The portal's "Developer Guidelines" (pasted by John, 24 October; saved
unchanged in `design/fuel-finder-developer-guidelines-2026-10-24.md`).** The first
official text from the portal itself:

- **Rate limits:** 100 requests a minute per client and **one request at a time**;
  going over returns HTTP 429. Separate test and live environments, with separate
  credentials for each. A full refresh of about 40 requests (the handover's
  estimate, unverified), sent one after another, is far inside that.
- **Caching advice:** stations 1 hour, prices 15 minutes. Collecting four times a
  day is much lighter than that.
- **Secrets:** "Never expose client secrets or access tokens in client-side code or
  public repositories"; run OAuth on the backend only; rotate secrets regularly;
  never log tokens. A GitHub Actions secret on a public repo meets this (the
  secret isn't in the repo), provided no log ever prints it. Public repos show
  their Actions logs to everyone, so the collector must print no secret, token or
  raw response.
- **Errors:** check status codes, retry with exponential backoff, tidy messages
  for users, validate every field before use.
- **Compliance:** respect rate limits; use data responsibly; respect privacy;
  **"Don't redistribute raw API data"**; "Attribute data sources appropriately".
  The terms of service they refer to, the licence, the Fair Use policy and the
  attribution wording are still not seen.

**The portal's overview and "API Testing" pages (pasted by John, 24 October; saved
unchanged in `design/fuel-finder-developer-docs-overview-2026-10-24.md`):**

- The service is for "authorised information recipients" (so registration may
  include an approval step). The public API is read-only: GET requests with a
  Bearer token, JSON responses, OAuth 2.0 client credentials.
- Token request: a form-encoded POST with `grant_type=client_credentials`,
  `client_id`, `client_secret` and `scope=fuelfinder.read`; the example reply has
  `expires_in: 3600` (one hour). The token endpoint's address is **blank in the
  pasted text**. A new token each run is enough.
- **Token endpoint seen (screenshot, 24 October; transcribed in
  `design/fuel-finder-oauth-generate-token-2026-10-24.md`):** `POST
  /api/v1/oauth/generate_access_token` with a **JSON** body `{client_id,
  client_secret}` (not the form-encoded body in the overview's generic example, and
  no `scope`). The access token lasts 3600 seconds; the refresh token 48 hours
  (`refresh_token_expires_in`). The reply wraps the tokens: `{success, data:
  {access_token, token_type: "Bearer", expires_in, refresh_token,
  refresh_token_expires_in}, message}`. Errors listed: 400, 401 (bad credentials),
  429, 500, 502, 503 (try again later), 504. A second call, `POST
  /api/v1/oauth/regenerate_access_token`, swaps a refresh token for a new access
  token. This matches the handover's path, so the handover's host
  (`www.fuel-finder.service.gov.uk`) is likelier than the overview's
  `api.fuelfinder.service.gov.uk`; the host is still not shown. Collecting four
  times a day needs one token request per run, so the refresh token isn't needed.
- **The addresses and names conflict with the handover.** The portal's examples
  use `https://api.fuelfinder.service.gov.uk/v1/prices/...` and
  `/v1/prices?fuel_type=unleaded`; the handover has `www.fuel-finder.service.gov.uk`
  `/api/v1/pfs?batch-number=N` and fuel codes `E10`, `B7_STANDARD`. The portal's
  examples are plainly illustrative (an invented forecourt ID, "Joe Bloggs"), so
  **neither set is confirmed**; the probe (Stage 1) settles it.
- **Test credentials are not needed for us.** "Because they are read only, you can
  test public data APIs against live or test environment." So one pair of live
  secrets does for the probe and the collector. (This corrects the plan's two pairs.)

**The portal's "API fields guide" (pasted by John, 24 October; saved in
`design/fuel-finder-api-fields-guide-2026-10-24.md`).** Two read-only calls, each
with an "All" and an "Incremental" form: station information and fuel prices,
joined on `node_id` (a 64-character code). It confirms the handover's fields and
adds these, which shape the design:

- **Fuel codes:** `E10`, `E5`, `B7_Standard`, `B7_Premium`, `B10`, `HVO`. The guide
  spells diesel `B7_Standard` (the handover had `B7_STANDARD`), so the code must
  match without regard to case, and the probe will show the real spelling.
- **Prices:** `price` in pence per litre to one decimal (sample 123.9);
  `price_last_updated` and `price_change_effective_timestamp` in UTC with a
  trailing Z. Shown to the visitor in UK time ("9.30am"), never altered.
- **Opening hours** are *usual* hours only: for each weekday `open`, `close` and
  `is_24_hours` (a 24-hour day is given as 00:00 to 00:00 with the flag true), and
  **a bank-holiday entry** (`open_time`, `close_time`, `is_24_hours`). Special
  one-off hours aren't in the data, so "open" can only mean "usually open".
- **Closures:** `temporary_closure` means closed "for a period of three days or
  more", so a shorter closure won't show. `permanent_closure_date` is "the date/time
  the forecourt was/will be closed", so a station flagged permanently closed with a
  *future* date is still open until then.
- **Place:** `country` ("England" in the sample), `county`, `postcode`, `latitude`,
  `longitude`. The sample longitude for a Loughborough station is `1.82469`, which
  is east of Greenwich and so wrong for Leicestershire (the real figure is negative,
  about -1.2). It's only sample data, but it shows coordinates can be wrong, so the
  collector should check each station's position against its own postcode district
  and leave out any that disagree badly.
- **Other flags:** `is_motorway_service_station`, `is_supermarket_service_station`
  (unreliable, per the handover), `amenities` (a list including
  `twenty_four_hour_fuel`), a phone number if public.
- **Endpoints and paging, now seen in screenshots (24 October; transcribed in
  `design/fuel-finder-data-endpoints-2026-10-24.md`):** `GET /api/v1/pfs?batch-number=N`
  (stations) and `GET /api/v1/pfs/fuel-prices?batch-number=N` (prices), both with
  **up to 500 forecourts a batch**, so the whole UK is a few dozen requests at most
  (the handover's 15-plus batches each). The incremental forms add
  `effective-start-timestamp=YYYY-MM-DD`, **a date, not a time**, so "changed since"
  works by day only. These agree with the handover, which makes its host
  (`www.fuel-finder.service.gov.uk`) the likelier; no screenshot shows the host. Replies
  are plain JSON arrays; errors 400, 403, 429, 500, 502, 503, 504.
- **A real prices sample (pasted by John, 24 October; saved in
  `design/fuel-finder-prices-sample-2026-10-24.md`):** each station is
  `{node_id, public_phone_number, trading_name, fuel_prices: [{fuel_type, price,
  price_last_updated, price_change_effective_timestamp}]}`. `price` is a number in pence
  per litre (132.9); timestamps are UTC with milliseconds and a trailing Z; the prices
  call has **no position or address**, so it is joined to the stations call on `node_id`.
  Diesel is spelt **`B7_STANDARD`** here (and `B7_Standard` in the fields guide), so
  matching without regard to case is needed. **A station lists only the fuels it sells**:
  one sample has E5 and diesel but no E10, another E5 and E10 but no diesel, which is
  the "one fuel only" case from Q7.
- **A full station sample (pasted by John, 24 October; saved in
  `design/fuel-finder-stations-sample-2026-10-24.md`) settles the earlier mismatches:**
  - `fuel_types` is a **list of codes** the station sells (for example `["E10", "E5",
    "HVO", "B10"]`), not true/false flags, and diesel is `B7_STANDARD` (and `B7_PREMIUM`).
    The prices call is the better guide to what has a price; the list agrees with it.
  - Opening times are `"HH:MM:SS"`, not `"HH:MM"`, and can be a second out (`06:00:01`,
    `23:00:01`). Parse to minutes and ignore seconds. **The bank-holiday entry is one
    object called `bank_holiday`** (the guide said `bank_holidays`), with a `type` of
    `"bank holiday"` or `"standard"`, `open_time`, `close_time` and `is_24_hours`. The
    meaning of `type` isn't explained: the "standard" sample has its own hours
    (08:00 to 20:00) that differ from the weekday hours, so it is read as "this
    station's hours on bank holidays", not "same as usual".
  - **A 24-hour day is given two ways:** 00:00 to 23:59 with `is_24_hours: true` (this
    sample), and 00:00 to 00:00 with the flag true (the guide). Use the flag.
  - **00:00 to 00:00 with the flag false is ambiguous:** it probably means closed that day
    (or hours not entered). One sample shows it for six days with the seventh 24 hours.
    This is a new question for John (Q14).
  - `location`: `address_line_1` can hold the **whole address**, `address_line_2` and
    `county` can be `null` or empty, `country` is `"England"` or `"ENGLAND"`, names and
    towns come in capitals (so they need tidying for display, with care for BP, ESSO and
    the like), phone numbers come with or without a space, and `permanent_closure` is
    `false` or `null`.
  - **Positions can be badly wrong.** Two of the three sample stations' coordinates are
    far from their own postcodes: a Brough (East Yorkshire) postcode with a position in
    Somerset (about 335 km out), and a Loughborough postcode with a position in Dorset
    (about 260 km out), by my approximate town positions. The third (Taplow, SL6 0AA) is
    right. These are test records, but they justify the position check against the
    postcode district. The Taplow record is a boatyard ("water_filling"): real data may
    include marinas, so a station with only `E10`/`E5` at a boatyard may need a look.
  - The samples include obvious test records ("TEST", "Test 12"); real data may too, so a
    station with a test-like name is worth looking at before it is shown.
- **What this does to the load:** stations change rarely (the portal says cache for an
  hour), so they can be fetched once a day, and only the prices each run: about one
  request per 500 stations, sent one at a time. Incremental fetches save little
  at four runs a day, since they only filter by date. Still for the probe: the real
  number of stations, the host, and the pages not yet seen.

**The sticking point is "Don't redistribute raw API data".** Every design in which
the browser does the search has to send the browser the prices, and a public repo
shows them to everyone. Whether a trimmed, cleaned file of two fuels' prices counts
as "raw" is a judgement the supplier makes, not us. Safeguards that cost little:
never commit or publish raw responses; publish only a derived file (merged
stations and prices, two fuels, fields renamed and cut down, bad prices removed,
prices rounded for display); credit the source; link to "Report a discrepancy" if
the terms ask. **The safe step is to ask the Fuel Finder team in writing** (their
address is on GOV.UK's help page, `fuel.finder@ve3.global`) whether a site like
this may publish such a derived file (Q3). Draft email in the notes, for John to
send or change.

The question they decide is whether we may
keep our own copy and pass the trimmed data on to every browser (Q3); showing
only open stations, nearest first, looks fine on that reading.

## 3. Fuels (Proposed)

- **Unleaded** = `E10`, the standard petrol at nearly every UK pump. Its price
  column says "Unleaded". (`E5` is super unleaded; confirm in Stage 1 that
  these labels are right.)
- **Diesel** = `B7_STANDARD`. (`B7_PREMIUM` is premium diesel.)
- The first version shows only these two, side by side. `E5`, `B7_PREMIUM`,
  `B10` and `HVO` are not shown. A "More fuels" choice can come later.
- Prices are pence per litre. Rounding follows the house style (§15), though
  Fuel Finder prices are probably already whole or to a tenth of a penny
  (to check).

## 4. Finding stations (Proposed)

1. **Postcode to position**, inside the browser (Q4). Recommended: full
   postcode positions from OS Open Names, built into the site in files split
   by postcode area ("RG", "SW" …, about 120), so the browser asks only for the
   area's file and the choice of postcode never leaves the page. (Hindcaster
   used district centres only, which is too coarse for "the eight nearest".)
2. **Distance** is straight-line, in miles, until John decides otherwise
   (Q5). Road distance needs a routing service, and sending positions to one
   would break the "nothing leaves the browser" value.
3. **Open**: not permanently closed (a future closure date still counts as open),
   not temporarily closed, and **usually open** at the moment of the search by UK
   clock time: the station's hours for today's weekday, or its bank-holiday hours on
   a bank holiday, or open all day (Q8). Worked out in the browser when the visitor
   searches, so "open now" is right whenever the page was built. Bank holiday dates
   come from GOV.UK's bank-holidays feed (checked: it covers 2019 to 2028 for
   England and Wales, Scotland and Northern Ireland), fetched by the collector and
   put in the data file, so no visitor request is made. Hours that run past
   midnight, and the nights the clocks change, need worked examples in the checks.
4. **Eight**: the eight nearest that pass the open test, however far away
   (Hindcaster's rule for gauges). If fewer than eight are open, show those,
   with a plain sentence.
5. A station that sells neither unleaded nor diesel is left out; one that
   sells only one shows "No price" for the other (Q7).

## 5. Prices and freshness (Proposed)

- Every station's price shows when it was last updated ("Updated 3 hours
  ago"). A price older than 7 days is flagged, not hidden (handover rule).
- A price outside about 100p to 300p a litre is dropped as a likely error
  (handover rule); the station then shows "No price". Exact limits to check
  against real data in Stage 1.
- The page says when its data was last collected ("Prices collected at
  2.40pm"), and when the collection last failed it keeps the last good copy
  and says how old it is.
- Collection frequency and how it is published are Q9. The API's own limits
  (100 requests a minute, one at a time) don't constrain it; Vercel's 100
  deployments a day does.

## 6. How it is built (Proposed; departs from the handover, Q2)

The handover defaulted to Next.js on Vercel, with a database, a refresh route
on a Vercel cron and a server function that looks up each search. **This file
proposes the house way instead**, because the handover's design sends every
visitor's postcode to a server and to two other services (postcodes.io and
OpenRouteService), which is the opposite of the house value:

- **Vite + React + TypeScript**, no backend, as Hindcaster.
- **A collector** (a GitHub Actions workflow, started by cron-job.org like
  Hindcaster's) fetches stations and prices with the Fuel Finder key (a GitHub
  Actions secret, never in a file, log or chat), cleans them and writes a
  compact data file.
- **The page loads that file** and does the whole search in the browser.
  Nothing about a search reaches a server. The remembered postcode stays in
  `localStorage` (`refueller.choice`, never to be renamed once live), and any
  postcode in the address sits after the "#", which browsers never send, and
  is stripped from the visit statistics (HOUSE-STYLE §8).
- **Open questions about size and cost, to measure in Stage 1:** how big the
  whole-UK station list is once trimmed to what the page needs (the handover
  implies 7,500 or more stations; at roughly 100 to 150 bytes each that is
  about 1 MB, much less than that once compressed, but unmeasured), how many
  rebuilds a day Vercel's free plan allows (not checked; Hindcaster makes
  three or four), and how large the repository grows if a snapshot is
  committed several times a day.
- Vercel's free (Hobby) plan is for non-commercial use only, so no adverts or
  affiliate links (handover). The repository is **public**, in John's own
  account (John, 23 October: all his sites must stay free to run; see §10).
- Keys: `FUEL_FINDER_CLIENT_ID` and `FUEL_FINDER_CLIENT_SECRET`, as GitHub
  Actions secrets. The handover's `ORS_API_KEY` and `CRON_SECRET` are only
  needed if John chooses road distances or a Vercel cron. `.env*` is in
  `.gitignore` from the first commit.

## 7. The page (Proposed; mock-ups come before any build)

- Header: kicker "Fuel prices", title "Refueller", the tagline, then one
  postcode box (`RG4 7HN`) with a **Go** key (HOUSE-STYLE §6 for postcode
  boxes), and a clear message for a postcode it can't find.
- Results: **table on a computer, one card per station on a phone**
  (label-and-value cards, HOUSE-STYLE §5). Columns: station (brand and name,
  town and postcode), distance, unleaded, diesel, open until. The cheapest
  price in the list of eight for each fuel is marked, by price only, never by
  brand.
- Order: nearest first. A choice to reorder by cheapest unleaded or cheapest
  diesel is proposed (Q10); the terms allow sorting by distance or price.
- Footer: the house footer, "More free tools at www.baish.net.", the credit
  lines (Q12), the privacy sentence, and the remembered-postcode note.
- States to mock up: first visit; a postcode in a rural area (nothing close);
  fewer than eight open (late at night); a stale price; no price for a fuel;
  data collection has failed and the copy is old; a postcode outside the
  covered area.

## 8. Credits, notes and wording (Proposed; John decides all wording)

- Fuel Finder credit, from the handover (to check against the terms): "Contains
  public sector information from the Fuel Finder scheme, licensed under the
  Open Government Licence v3.0."
- Postcode positions from OS Open Names carry three lines (OS, Royal Mail,
  National Statistics), read from its licence file, as on Hindcaster. To
  re-check against the OS acknowledgements page.
- A line saying Refueller is an independent project not connected with or
  endorsed by DESNZ or the Fuel Finder scheme.
- Prices are given as reported by stations; a short note that a price may
  have changed since.
- Privacy wording from HOUSE-STYLE §8: "We don't record anything you do here,
  apart from anonymous visit statistics (no cookies, no personal data),
  showing us how the site is used."
- House wording rules (§15): "less than" and "more than", times such as
  "9.30am", dates month first, British spelling.

## 9. The calculator, "is it worth driving further?" (Later; not in the first version)

From the handover, with the arithmetic checked by code:

- Litres per mile = 4.546 ÷ miles per gallon (a UK gallon is 4.54609 litres).
- Extra cost = extra round-trip miles × litres per mile × price per litre.
- Saving = (nearest price − this station's price) × litres bought.
- Net saving = saving − extra cost.
- The handover's example is right: 45 mpg, 3 extra miles each way (6 round
  trip), 135p a litre, 40 litres, 3p cheaper gives fuel to get there 81.8p,
  saving £1.20, net 38p, break-even gap about 2p a litre.
- The visitor's own mpg and litres are typed in the browser and kept on the
  device only. It ignores time and wear, and says so.
- It needs a trustworthy "extra miles" figure. With straight-line distances
  only, the honest version is that the visitor types the extra miles from their
  own sat nav, or accepts a rounded-up estimate labelled "about". This is the
  main reason Q5 matters. Calculator questions come in a later batch.

## 10. Hosting and keeping it free (Proposed)

GitHub (**public**, `JohnBaish/refueller`) → Vercel, deploying `main`, at
`refueller.baish.net`. John creates the Vercel project, adds the domain and
switches on Web Analytics himself (HOUSE-STYLE §9); the baish.net landing
page card comes last.

### Keeping it free (John, 23 October)

**Limits found, from search results quoting the providers' own pages (not
opened directly, and they change, so re-check before relying on a number):**

- GitHub Actions: standard runners are free in a **public** repo; a private
  repo gets 2,000 minutes a month on the free plan. A public Refueller therefore
  adds nothing to the allowance Hindcaster uses.
- Vercel Hobby (free): 100 deployments a day; a cron job at most once a day;
  non-commercial use only; Web Analytics 50,000 events a month, after which
  collection pauses (no charge); other usage overages mean waiting until the
  allowance resets rather than paying. The cron and deployment figures are from
  Vercel's limits page as quoted in search results (its own cron page and limits
  page disagree on the number of cron jobs).

**The two ways of building it, and what each risks costing:**

| | House way (static site + collector) | Handover way (Next.js + database + server search) |
|---|---|---|
| Per-search cost | None: the search runs in the visitor's browser | A server call on every search; popularity uses up the free allowance |
| Scheduler | GitHub Actions (free, public repo) started by cron-job.org | Vercel cron is once a day on the free plan, so an outside scheduler is needed anyway |
| Storage | Committed files, no database | A database from Vercel's marketplace, with its own free caps |
| Limit that could bite | 100 deployments a day (we would use 4 to 8); repo size if snapshots pile up | Function, database and routing-service caps, any of which can stop the site or ask for payment |
| Postcode privacy | Never leaves the browser | Reaches our server (and, in the handover, two other services) |
| Cookies | None | None needed either |

**Recommendation: the house way, public repo.** A site that runs entirely in
the browser can't be overwhelmed by popularity, which is the usual way a free
plan turns into a bill. The handover way would need a decision each time a
free cap was hit.

**What a public repo changes:**

- Everything committed is public, history included. The site already publishes
  whatever data the page needs, so the Fuel Finder terms (Q3) matter either way,
  but a public repo adds a second copy and its history. So: commit only the
  trimmed file the page needs, never raw API responses.
- To stop the history growing with every snapshot, the collector can publish the
  data file to a separate `data` branch that is overwritten each time (history
  squashed), or the data can live outside the repo's main history. Decide in
  Stage 2 once the file's real size is known.
- If the Fuel Finder terms turned out to forbid passing the data on, a public
  repo would not be allowed, and neither would serving the file to browsers. At
  that point the question is bigger than public or private.

**If John later accepts sending something onward** (for example road distances
through a routing service, or exact postcodes from a lookup site): that needs a
small server function to keep any key secret, which uses Vercel's function
allowance and the service's own free cap. Both can be kept to a trickle by only
calling them when a visitor asks for that extra, but it is the first place a
free limit could be hit. Not needed now.

## 11. Questions for John

Each has Claude's recommendation first. Answer by number.

### John's answers, 23 October

John's list ran 1 to 12. His tenth answer is plainly about coverage (Q11), so
Claude has mapped his 10 to Q11, his 11 to Q12 and his 12 to Q13. **That leaves
Q10 (order and marking) unanswered**; John to say if the mapping is wrong.

- **Q1** Yes, except the repo is **public**, not private. His aim: every
  baish.net site stays free to run, and no cookies if avoidable.
- **Q2** The consequences were set out (§10, "Keeping it free"); John then said
  **yes to the house way** (24 October).
- **Q3** Answered: the terms were pasted by John on 24 October (§2a): Open
  Government Licence plus the aggregator's Fair Use policy. A public repo is fine.
- **Q4** **A**, district centres, for now. (Consequence for the mock-ups: the
  eight nearest are ranked from the middle of the postcode district, so the
  order can be slightly out in a big town. The page should say "approximate".)
- **Q5** Straight-line miles; one decimal place for less than five miles.
- **Q6** Yes: unleaded (`E10`) and standard diesel (`B7_STANDARD`) only.
- **Q7** Yes to all three: keep a station with one fuel, flag prices older than
  seven days, treat prices outside 100p to 300p as errors.
- **Q8** Yes to the definition of "open" as drafted. *Amended by Claude, for John
  to confirm:* the data does include bank-holiday hours (my earlier note that it
  didn't was wrong), so they are used.
- **Q9** *Reopened by the terms (§2a): four a day does not meet the Fair Use policy.*
  Earlier: probably four times a day, but it depends on Q2 and the free limits.
  Q2 is settled (house way); the API limits are generous (§2), so four a day
  stands unless John wants fresher prices.
- **Q10** **Nearest first, with the cheapest price marked** (24 October; John's
  apology for the misnumbering noted, none needed). Whether to add a button to
  reorder by price is not yet decided; it is left out of the first version.
- **Q11** Great Britain, excluding Northern Ireland, to start.
- **Q12** Yes to the credit lines as on Hindcaster.
- **Q13** Yes: remember the last postcode on the visitor's device.

John also said this tool may take a **different approach to personal data** from
the others if that is what keeps it free, so long as it is clear what is
collected or sent on, and with no cookies if avoidable. Nothing so far needs
it (Q4 is A), but it matters for road distances and exact postcodes later.

1. **Name and address.** Refueller at `refueller.baish.net`, with the draft
   tagline above, repo public, no adverts? Or another name or tagline?
2. **How it is built.** The house way (Vite + React, no server, a GitHub
   Actions collector, search done in the browser) rather than the handover's
   Next.js with a database and server functions? Recommended: house way, so
   no postcode is ever sent to us or to anyone else.
3. **The data terms.** Will you register for Fuel Finder (GOV.UK One Login;
   only you can) and read its terms for me, or allow the sites below so I can
   read them? Sites to allow in the environment's network settings:
   `developer.fuel-finder.service.gov.uk` (the portal and docs),
   `www.fuel-finder.service.gov.uk` (the API; I can test it only from GitHub
   Actions, as with the Met Office), `www.gov.uk` (the scheme's guidance).
   The answer decides whether we may keep and serve our own copy of the data
   and so whether the repo can be public.
4. **Postcode to position.** A: district centres only (small, but a mile or
   more out in a town). B: ask postcodes.io from the browser (accurate, but
   your visitor's postcode goes to a third party). C: full-postcode positions
   built into the site, split by postcode area so the browser fetches only the
   area (accurate, and the server sees only "RG", not the postcode).
   Recommended: C.
5. **Distance.** Straight-line miles in the first version, labelled as such,
   and a later calculator where the visitor can type extra road miles?
   Alternatively road distances from OpenRouteService, which means sending
   positions to it (not recommended). Also: miles to one decimal place for
   less than five miles, or whole miles as on Hindcaster?
6. **Fuels.** Unleaded (`E10`) and standard diesel (`B7_STANDARD`) side by
   side, nothing else for now?
7. **Gaps in the prices.** Keep a station that has only one of the two fuels
   (showing "No price" for the other), and leave out one with neither? Flag
   prices older than 7 days rather than hide them? Treat prices outside
   100p to 300p as errors?
8. **What "open" means.** Open now by UK time; a station with no opening
   times listed counts as open, with "Opening hours not listed"; show "Open
   until 10pm", "Open 24 hours" and "Closes in less than an hour"? Bank
   holiday hours are in the data (see §2) and will be used.
9. **How fresh.** Collect and rebuild how often? Fuel Finder stations must
   report within 30 minutes, but each collection is a rebuild of the site.
   Recommended: start with four times a day (early morning, late morning,
   afternoon, evening), start from cron-job.org, and tighten once the API's
   limits and the rebuild allowance are known.
10. **Order and marking.** Nearest first, with a choice to reorder by cheapest
    unleaded or cheapest diesel, and the cheapest price of the eight marked?
11. **Coverage.** Great Britain first? OS Open Names has no Northern Ireland
    postcodes (Hindcaster found GB only), so Northern Ireland would need
    another source. Fuel Finder itself is said to cover the whole UK (to
    check).
12. **Credits.** Show each source's credit in a small grey line at the foot of
    the list, plus the not-connected line and the OS lines, as on Hindcaster?
    I'll draft the exact words once the terms are read.
13. **Remember the last postcode** on the visitor's own device, as Hindcaster
    does (with the footer line saying so)?

14. **A station whose hours say 00:00 to 00:00 on a day, not 24 hours** (raised by the
    sample data, 24 October). It probably means closed that day, or that nobody entered
    hours. Recommended: decide once the probe shows how many real stations are like this.
    Until then: treat it as *closed that day* if other days have real hours, and as
    "Opening hours not listed" (shown, not counted as open for the eight) if every day is
    like that. Your call, whenever the real numbers are in.

Not asked yet, by design: dark mode (asked late in the design, HOUSE-STYLE
§16), the calculator's details, the favicon and link-preview image, and the
search title and description.
