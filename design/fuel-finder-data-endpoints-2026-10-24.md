<!-- Transcribed by Claude on 24 October 2026 from screenshots John pasted of the Fuel
     Finder developer portal's "Fetch PFS information", "Fetch incremental PFS fuel
     prices" and "Fetch all PFS fuel prices" pages (partial: the full list of fields is
     in fuel-finder-api-fields-guide-2026-10-24.md). Not re-checked at source (the portal
     blocks the session's container). The sample records on the pages (names such as
     "TEST", "TEST FORECOURT 1", "Test 12") are documentation samples. -->

# Data endpoints (version 1), all `GET`, all OAuth 2.0 (Bearer token)

The host is not shown in any screenshot; only paths.

## Fetch PFS information

`GET /api/v1/pfs?batch-number=1`

"API used to fetch all the PFS (Petrol Fuel Station) information. Note: Each API response
returns data for up to 500 forecourts. To retrieve additional forecourts, the consumer
must pass the query parameter `batch-number`. For example, the first call returns
forecourts 0-500, and the second call with `batch-number=2` returns forecourts 501-1000."

| Query parameter | Type | |
|---|---|---|
| batch-number | integer | required. Example `batch-number=1`. (The page's own description reads "Batch number of fuel prices to fetch", probably copied from the prices page.) |

Responses: 200 PFS info fetched successfully; 400 Unauthorized; 403 Forbidden; 429 Too
Many Requests; 500 Internal server error; 502 Bad gateway; 503 Service temporarily
unavailable (please try again later); 504 Gateway timeout.

Sample 200 body: a JSON **array** of stations, each with `node_id`, `public_phone_number`
(a string or `null`), `trading_name`, `is_same_trading_and_brand_name`, `brand_name`,
`temporary_closure`, `permanent_closure` (`false` in one sample, `null` in another),
`permanent_closure_date` (`null`), `is_motorway_service_station`,
`is_supermarket_service_station`, and the folded groups `location: { … }`,
`amenities: [ … ]`, `opening_times: { … }` and **`fuel_types: [ … ]`** (shown as an
**array**, not the object of true/false flags the fields guide describes).

## Fetch all PFS fuel prices

`GET /api/v1/pfs/fuel-prices?batch-number=…` (the path is inferred from the incremental
page's address bar and the handover; this page's own address and parameters were not
visible). Same error list, with 400 Unauthorized and 403 Forbidden.

Sample 200 body: a JSON **array** of `{ node_id, public_phone_number, trading_name,
fuel_prices: [ … ] }`.

## Fetch incremental PFS fuel prices

`GET /api/v1/pfs/fuel-prices?batch-number=1&effective-start-timestamp=…`

"API used to fetch all fuel prices incrementally based on the provided effective start
timestamp."

| Query parameter | Type | |
|---|---|---|
| effective-start-timestamp | string, date | required. Example `effective-start-timestamp=2025-09-05`. "Start date in YYYY-MM-DD format" (a date, not a time) |
| batch-number | integer | required. Example `batch-number=1`. "Batch number of fuel prices to fetch" |

Responses: 200 Incremental fuel prices fetched successfully; 400 Bad Request; 403
Forbidden; 429; 500; 502; 503; 504.

## Fetch incremental PFS information (second batch of screenshots, 24 October)

`GET /api/v1/pfs?batch-number=1&effective-start-timestamp=…`

"API used to fetch PFS information incrementally based on the provided effective start
timestamp."

| Query parameter | Type | |
|---|---|---|
| effective-start-timestamp | string, date | required. Example `effective-start-timestamp=2025-09-05`. "Start date in YYYY-MM-DD format" |
| batch-number | integer | required. Example `batch-number=1`. (Described, as on the other pages, as "Batch number of fuel prices to fetch".) |

Responses: 200 Incremental PFS info fetched successfully; 400 Bad Request; 403 Forbidden;
429 Too Many Requests; 500 Internal server error; 502 Bad gateway; 503 Service temporarily
unavailable; 504 Gateway timeout.

Sample 200 body: the same station records as "Fetch PFS information". The records visible
across the screenshots have names such as "TEST", "Yono" and "csvprice"; one has
`is_supermarket_service_station: true` and an **empty** `amenities: [ ]`; several have
`permanent_closure: false`, others `null`. The folded `location`, `amenities`,
`opening_times` and `fuel_types` groups were not expanded in any screenshot.

## Still not seen

The "Fetch all PFS fuel prices" page's own text; the expanded `location`, `amenities`, `opening_times`, `fuel_types` and
`fuel_prices` samples; the host.
