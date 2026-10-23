# Fuel price finder — project brief

A web app: the user enters a UK postcode and sees the nearest petrol stations, ranked by
**road distance in miles** (not straight-line), with current prices and an estimate of
whether a further, cheaper station is worth the drive.

Owner: John. New project, nothing built yet. Planning was done in a Claude.ai chat
(Oct 2026); this file carries that work over. Treat anything marked "unverified" as a
starting point to check, not fact.

## Hosting and repo
- Deploy on **Vercel**. Default to Next.js (App Router, TypeScript) unless John says otherwise.
- GitHub repo is **private, in John's personal account** (Vercel Hobby can't deploy private
  repos owned by a GitHub organisation).
- Vercel Hobby is **non-commercial use only**. No ads/affiliate links without moving to Pro.
- Possibly served later from a subdomain of John's domain baish.net (registrar names.co.uk).

## Secrets — always
- All keys live in Vercel environment variables and a local `.env.local`.
- `.env*` must be in `.gitignore` from the very first commit. Never commit or log secrets.
- Expected variables: `FUEL_FINDER_CLIENT_ID`, `FUEL_FINDER_CLIENT_SECRET`,
  `ORS_API_KEY` (OpenRouteService), `CRON_SECRET` (protects the refresh route).

## Data source: UK government Fuel Finder
- Statutory scheme live since 2 Feb 2026 (Motor Fuel Price (Open Data) Regulations 2025).
  Run by DESNZ, operated by VE3 Global, enforced by the CMA. Stations must report price
  changes within 30 minutes. ~99% of UK fuel sold is covered.
- Licence: Open Government Licence v3.0. The app must credit it, e.g.
  "Contains public sector information from the Fuel Finder scheme, licensed under the
  Open Government Licence v3.0."
- Access: free registration via GOV.UK One Login at
  https://www.developer.fuel-finder.service.gov.uk — OAuth 2.0 client credentials.
  Also a CSV download (updated twice daily) as a fallback.
- Usage terms: present prices without bias; don't filter or selectively show data to favour
  suppliers; don't alter timestamps. Sorting by distance or price is fine.

### Endpoints (unverified — from developers' published code; check the official docs)
- Base: `https://www.fuel-finder.service.gov.uk`
- Token: `POST /api/v1/oauth/generate_access_token`
- Stations: `GET /api/v1/pfs?batch-number=N` (≈500 stations per batch, ≈15+ batches)
- Prices: `GET /api/v1/pfs/fuel-prices?batch-number=N`
- Incremental prices: add `&effective-start-timestamp=<ts>`
- Join stations and prices on `node_id` (64-char hash).

### Fields seen (unverified)
- Station: `node_id`, `trading_name`, `brand_name`, `public_phone_number`,
  `is_motorway_service_station`, `is_supermarket_service_station`, `temporary_closure`,
  `permanent_closure`, `permanent_closure_date`, location (address lines, postcode,
  `latitude`, `longitude`), opening times per weekday incl. `is_24_hours`, amenities
  (AdBlue pumps/packaged, LPG, car wash, air/screenwash, water, toilets, 24-hour fuel).
- `mft_organisation_name` was removed from responses in late Feb 2026.
- Prices: `fuel_prices[]` with `fuel_type`, `price` (pence per litre),
  `price_last_updated`, `price_change_effective_timestamp`.
- Fuel types: `E10`, `E5`, `B7_STANDARD`, `B7_PREMIUM`, `B10`, `HVO`.

### Known data quirks
- `is_supermarket_service_station` is unreliable — don't depend on it.
- Prices can be stale: flag anything older than 7 days; drop prices outside ~100–300p.
- Exclude permanently closed stations; show temporary closures.
- The API has periodic outages (often 503 on the token endpoint) and no status page.
  Keep serving the last good copy and show its age.
- No price history in the API — store snapshots ourselves if we want trends.

## Architecture
1. **Refresh job** — pulls all stations + prices, stores a copy in a small database
   (pick via the Vercel Marketplace). Never call Fuel Finder per user search.
   - Vercel Hobby cron runs **at most once a day** (more frequent schedules fail to deploy).
     Options: Vercel Pro, or a free external scheduler hitting the refresh route.
   - Protect the route with `CRON_SECRET`; reject requests without it.
   - Use incremental price fetches between full refreshes.
2. **Search function**
   - Postcode → lat/long via postcodes.io (free, no key).
   - Shortlist the nearest ~20–30 stations by straight-line (haversine) distance.
   - Get real driving distance + time for the shortlist from **OpenRouteService**'s matrix
     endpoint (one request). Convert km → miles. Re-sort by road miles.
   - Self-hosted OSRM is a possible later move but can't run on Vercel.
3. **Front end** — postcode box, fuel-type selector, results list; map optional.

## "Is it worth driving further?" calculation
- Inputs from the user: real-world mpg (not the official figure) and litres they usually buy.
- Litres per mile = 4.546 ÷ mpg (UK gallon).
- Extra cost = extra round-trip miles × litres per mile × price per litre.
- Saving = (nearest price − this station's price) × litres bought.
- Show **net saving** per station, plus drive time. Note it ignores time and wear.
- Sanity check: 45 mpg, 3 extra miles each way, 135p/litre, 40 litres, 3p cheaper
  → fuel to get there ≈ 82p, saving £1.20, net ≈ +38p; break-even gap ≈ 2p/litre.

## Working with John
- He's not a full-time developer: explain steps plainly, especially GitHub/Vercel setup.
- Accuracy over speed. Say clearly what's verified and what's a guess.
- Prefer a clear recommendation over a menu of options when one answer is best.

## Suggested first steps
1. Check the official Fuel Finder developer docs and correct the endpoint/field notes above.
2. Scaffold the Next.js app with `.gitignore`, `.env.example`, and a README.
3. Build the Fuel Finder client and refresh job; confirm data lands in the database.
4. Build the search function, then the front end, then the net-saving calculation.
