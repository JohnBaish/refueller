# First real probe run, from AWS London (27 October 2026)

Run by John from the Lambda function `refueller-probe` (region eu-west-2, Node v24.21.0), using the Stage 1c package
(main `75249db`). The function's Response, pasted by John into the chat, holds **counts and shapes only** (no credentials,
no station codes, no individual prices). The full Response is kept in the session; the figures below are copied from it.

## Result

**A London AWS address is accepted.** Sign-in (HTTP 200), all station and price batches, the three incremental calls and the
refresh call all worked: 41 requests, about 4 seconds of fetching. The probe said `ok: false` only because **the end of each
list is signalled by HTTP 404 on the batch after the last (batch 18)**, not by an empty batch as the probe expected. That is a
fact about the API, not a failure; the collector must treat a 404 after at least one batch as "no more".

## Key figures

- **Stations:** 8,146 (17 batches of up to 500; 10.8 MB raw). No duplicate IDs, no test-like names, every station has a postcode
  and a position (none outside the UK box). `country` is unreliable (ENGLAND 5,135; UNITED KINGDOM 728; SCOTLAND 672;
  missing 506; WALES 413; NORTHERN IRELAND 382; empty 220; single letters 85; UK 5), so Great Britain must be decided by postcode
  (BT is Northern Ireland), not by this field. The probe's rough count: 6,220 in Great Britain.
- **Closures:** `permanent_closure` never true (false 6,742; null 1,404); `permanent_closure_date` always null; 57 temporarily closed.
- **Flags:** 168 motorway, 2,333 supermarket. 448 have the postcode inside address line 1; 4,584 have no county.
- **Fuels listed:** B7_STANDARD 8,047; E10 7,929; E5 6,273; B7_PREMIUM 4,174; B10 63; HVO 56. Spelling is upper case throughout.
- **Opening hours:** every time `HH:MM:SS`; bank-holiday object present for all (standard 5,340; "bank holiday" 2,806).
  Stations: ordinary 4,158; open 24 hours every day 3,530; **some days 00:00 to 00:00 455; every day 00:00 to 00:00 3** (Q14);
  1,798 station-days run past midnight.
- **Prices:** 8,141 records, 26,528 entries, all numbers; none outside 100p to 300p, none in the future.
  Unleaded (E10) 132.9p to 299.9p, middle 172.9p; standard diesel 142.9p to 299.9p, middle 198.9p. The 299.9p maxima and a
  premium diesel at 100.9p look like trader typing errors, inside the agreed range.
- **Price ages:** 18,219 of 26,528 entries (69%) are more than seven days old. Middle age: E10 about 8 days, diesel about 13 days;
  10% are more than about 33 days old; the oldest about 261 days. 358 entries have a change time later than their "last updated" time.
- **Join:** 5 stations have no price record; every price record has a station; 7,849 stations have both E10 and diesel prices.
- **Estimated page data file** (GB stations with E10 or diesel): 6,204 stations, 914 KB as JSON, **238 KB compressed**.
- **Incremental calls:** prices since yesterday and since today both returned a full first batch (500); stations since yesterday 9.
- **Refresh call:** works; gives a new access token but no new refresh token.

## What it changes

1. AWS London works: the collector (Stage 2) can be built as planned.
2. The 404 end-of-list rule (above).
3. **The "flag prices older than seven days" rule (SPEC Q7) would flag most prices.** Probably "last updated" means the last time
   the trader reported a change, so a stable price looks old. Question for John.
4. Great Britain by postcode, not the `country` field.
5. Q14 (00:00 to 00:00) affects 458 stations: still to settle.
