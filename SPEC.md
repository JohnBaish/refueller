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

**Status, 23 October 2026. Nothing here is agreed yet.** Everything is marked
**Proposed**: Claude's draft for John to confirm, change or turn down. §11
lists the numbered questions. Nothing is built.

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

**Licence: needs reading before anything is stored or shown (Q3).** The
handover says Open Government Licence v3.0 with this credit: "Contains public
sector information from the Fuel Finder scheme, licensed under the Open
Government Licence v3.0." A web search turned up a community thread arguing
the scheme is *not* plain open data, quoting a requirement to register as an
"Information Recipient" and a "Fair Use" policy. That is third-hand and
unconfirmed, but it is exactly the kind of term that decides whether we may
keep our own copy of the data and serve it to every browser. The handover's
usage terms (present prices without bias, don't selectively show data to
favour suppliers, don't alter timestamps; sorting by distance or price is
fine) also need checking in the original. Showing only open stations nearest
first looks fine on that reading, but the wording should be checked.

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
3. **Open**: not permanently closed, not temporarily closed, and open at the
   moment of the search by UK clock time (opening times for today's weekday,
   or open all day). Worked out in the browser when the visitor searches, so
   "open now" is right whenever the page was built (Q8).
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
- Collection frequency and how it is published are Q9.

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
  affiliate links (handover). The repository is private, in John's own
  account.
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

## 10. Hosting (Proposed)

GitHub (private, `JohnBaish/refueller`) → Vercel, deploying `main`, at
`refueller.baish.net`. John creates the Vercel project, adds the domain and
switches on Web Analytics himself (HOUSE-STYLE §9); the baish.net landing
page card comes last.

## 11. Questions for John

Each has Claude's recommendation first. Answer by number.

1. **Name and address.** Refueller at `refueller.baish.net`, with the draft
   tagline above, repo private, no adverts? Or another name or tagline?
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
   and so whether the repo can stay private.
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
   holidays aren't in the data as far as we know.
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

Not asked yet, by design: dark mode (asked late in the design, HOUSE-STYLE
§16), the calculator's details, the favicon and link-preview image, and the
search title and description.
