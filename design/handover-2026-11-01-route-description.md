# Handover: the journey planner's route description and tidy-ups (November 1st 2026)

For a thread that ran a Fresh Look on Refueller and may want to look again. Everything below is on `main` (merged November 1st 2026,
commit `9c5b95c`), live at refueller.baish.net. The full log is in `CLAUDE.md`, entries dated 2026-11-01 from "the journey notes
describe the route" onwards.

## What John asked for, and why

John wanted the journey planner ("Find cheaper fuel near the route") to say which way it has routed you, so a visitor can tell whether
it matches the way they'd drive, and to point them to the Via box if not. His example: Wokingham to Horsham.

## What the journey page now says

The notes under the heading open with one sentence about the route, then the hint:

> Refueller has planned a route of about 49 miles from Wokingham to Horsham, via the M25 and Dorking. For a different route, add a
> nearby place in Via.

With the visitor's own Via, no other places are named:

> Refueller has planned a route of about 44 miles from Wokingham to Horsham, passing near Guildford. For a different route, add a
> nearby place in Via.

Then, as before, the count of stations close to the route, and (John's new wording) "The cheapest of the stations near the beginning
and end of the journey are also shown."

## The rule for naming places and roads (`src/lib/routeWords.ts`)

1. The route is split into stretches. A motorway stretch is named by its number (M25). Any other road is named by the town or city it
   passes through or close by (within about two miles), a city first; only if there's none, by its number.
2. The planner also works out the next-best route (the chosen route's roads made 60% slower, so the quickest way avoids them if it
   can). If that takes nearly as long (within 15% of the time), up to two stretches it doesn't use are named (at least 5 miles, or a
   tenth of the journey): first those in the middle three-fifths of the journey, a city first, then the longest; then those near the
   ends to fill the second place.
3. Otherwise the single longest stretch is named: "mainly by the M4" for a road, "via Bodmin" for a place.
4. At most two names, in the order you'd reach them; never a town within about five miles of either end.

Examples (checked in `scripts/check-route.ts`): Wokingham to Horsham "via the M25 and Dorking"; Caversham to Downham Market "via the
A1(M) and Ely"; Reading to Bristol "mainly by the M4"; Bath to Southampton "via Salisbury"; Guildford to Brighton "via Horsham and the
A272"; London to Birmingham "via the M1 and M6"; Cardiff to Bristol "via the M49 and A4". The experiments behind the rule are kept in
`design/mock/route-towns-experiment.ts`, `route-mix-experiment.ts` and `route-middle-compare.ts`.

Known weak spots: York to Scarborough says "via Norton-on-Derwent" rather than Malton (OS Open Names gives no town sizes); Cardiff to
Bristol's "the M49 and A4" is correct but not very telling; a town just beside an A road counts as on it (Diss on the A140).

## Data changes

- `data/route-roads.json` now carries each main-road link's road number from OS Open Roads (`r`, the 5,099 numbers; `k`, each link's),
  rebuilt by `npm run route-roads` from the October 2026 download. The same 76,543 points and 113,204 links, so routes are unchanged.
  The file the page loads for a journey is now 1.34 MB compressed (was 1.16 MB).
- The page data has `towns-<made>.json` (the 1,426 cities and towns from `data/places.json`, 19 KB compressed), loaded with the road
  map. `PageIndex.towns` points to it.
- `journey()` in `src/lib/route.ts` now returns its path, its links and its end points; `tree()` records the link each point was reached
  by. `mainRoads()` and `roadList()` remain (checked) though the page now uses `routeWords()`.
- Cost: a second route is worked out for each journey (not when the visitor gives a Via). With the processor slowed four times to
  phone speed, a journey took about 3.5 to 4.8 seconds from pressing Find, including loading the map.

## Smaller changes made at the same time

- Via's faint placeholder is "Add a place near your route" (was the example "Andover", which looked like part of the route once a
  journey was shown). From and To keep "Reading, RG1 or RG1 8FR" and "Exeter, EX4 or EX4 6TJ".
- Under the "Today" heading (phone cards and the computer table), hours read "Open 6am to 10pm", "Open 24 hours" and "Closed" (was
  "Today 6am to 10pm", "Open 24 hours today", "Closed today").
- Phone cards: the detour moved from the top right ("1.8 miles / extra") to its own line under "On the way": label "Detour", text "1.8
  miles extra". The computer table keeps its "Extra miles" column.
- The sentence "It's the quickest by main roads at typical speeds, so it may not be the way you'd go." was tried and dropped (John).
- A place whose name is unique can be typed with its area in full ("Horsham, West Sussex"); before, only "Horsham" was found.
  `findPlace()` in `src/lib/places.ts`.

## Earlier the same day (already merged before this work)

Place names in the main search and the journey planner; "via" meaning "passes near"; stations must be within about two miles of the
drawn route; a cheaper members-only Costco shown at the journey's ends; the journey planner open at the bottom of the main page; "The
wider picture" (average prices). See `CLAUDE.md` for each.

## Not checked

A real phone's speed (only simulated); every route in Great Britain (21 journeys were compared); iPhone's "AutoFill Contact" bar above
the keyboard on the journey boxes (John isn't worried by it).
