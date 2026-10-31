# Does Fuel Finder hold earlier prices? The answer (31 October 2026)

John ran the history check (`{"history": true}`, branch `probe-price-history`) on the `refueller-probe` function in AWS London
at about 8.50am on 31 October. Counts only; nothing identifying a station.

| | Current prices call | "Changed since 17 October" call |
|---|---|---|
| Records | 8,143 (17 batches) | 6,204 (13 batches) |
| Stations appearing more than once | | 0 |
| Station-and-fuel entries | | 20,908, each exactly once |
| Entries with a price or "set" time different from the current call | | 0 |
| Entries set before 17 October | | 7,110 |
| Earliest and latest "set" dates | | 6 February 2026 to 31 October 2026 |

**Conclusion: no.** The "changed since" call returns each station once, with exactly its current prices, for any station where
something changed since the date (its other fuels come too, even if set long before: 7,110 of them). It holds no earlier prices.
With the portal keeping no past CSV files (John, 31 October), the only source of history is our own collections, which started on
30 October 2026 (two a day). 14 days of history are complete on about 13 November.

**What is known already:** for the 1,939 or so stations not in the "changed since 17 October" list (8,143 less 6,204), no price
changed in the last 14 days, so a flat line over the fortnight is real. For the rest, the current price and the moment it was set
are known, but not the price before.

**A limit of our own record:** a station's price is collected twice a day, with the time it was set. A price that changes twice
between collections loses the middle price; every price we do have is drawn at its own "set" time, never moved.
