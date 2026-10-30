# Road routes in the browser: feasibility test (30 October 2026)

John asked whether anything better than "as the crow flies" is possible for "may be close to the route" without sending
postcodes anywhere. Test: build a slimmed road network from **OS Open Roads** (OS OpenData, downloaded from `api.os.uk`,
October 2026 edition, GB shapefile, 586 MB zipped, 3.4 GB unpacked) and time routes in the browser. Notes and figures only;
nothing on the site changed. Scripts were scratch only.

## What was built

Road links of the chosen classes; chains joined into single edges at nodes with exactly two links; positions to 10 m; lengths
from OS's own `length` field. No one-way streets or turn rules (Open Roads doesn't carry them).

| Roads kept | Links | Network after joining chains | Compressed size |
|---|---|---|---|
| Motorways and A roads | 299,547 | 55,746 points, 81,133 edges | **0.82 MB** |
| + B roads | — | 76,543 points, 113,204 edges | **1.16 MB** |
| + "classified unnumbered" roads | — | 152,127 points, 221,156 edges | **2.39 MB** |

(For comparison the page's station index is about 0.11 MB compressed.) The whole of Great Britain has about 4 million road links;
most are minor roads ("unclassified", "not classified", "unknown").

## Routes (district middle to district middle, motorways + A + B roads)

| Route | Straight line | By road | Road ÷ straight |
|---|---|---|---|
| RG4 → RG1 (Caversham to Reading) | 2.2 mi | 2.9 mi | 1.34 |
| RG1 → OX1 (Reading to Oxford) | 23.8 mi | 26.4 mi | 1.11 |
| RG1 → BS1 (Reading to Bristol) | 70.1 mi | 77.6 mi | 1.11 |
| CF10 → BS1 (Cardiff to Bristol) | 25.1 mi | 39.6 mi | **1.58** (round the Severn) |
| TR1 → PL1 (Truro to Plymouth) | 40.5 mi | 53.7 mi | 1.32 |
| IV1 → PH33 (Inverness to Fort William) | 56.5 mi | 64.5 mi | 1.14 |
| LL65 → CH1 (Holyhead to Chester) | 69.2 mi | 79.2 mi | 1.15 |
| SW1A → EH1 (Westminster to Edinburgh) | 331.9 mi | 370.4 mi | 1.12 |

**The point:** the road-to-straight ratio varies from 1.1 to 1.6, so no single "winding roads" allowance fits; real routes fix
the worst cases (estuaries, coasts, mountains). **Caution:** the road figures are probably a little short of a sat nav's, because
the network has no one-way streets and treats some crossings as junctions; Westminster to Edinburgh looks low (a usual figure is
nearer 400 miles, from memory, not checked). Short local trips start and end off the main roads (the "snap" to the nearest main
road was up to 1.3 miles, e.g. Holyhead), so for the eight-nearest list straight lines stay as they are.

## Speed (browser, 390 px phone size, the longest route, Westminster to Edinburgh)

| Network | Normal speed: load / route | Slowed 4× (roughly a mid-range phone): load / route |
|---|---|---|
| + B roads (1.16 MB) | 0.27 s / 0.05 s | 0.86 s / 0.23 s |
| + classified unnumbered (2.39 MB) | 0.33 s / 0.11 s | 1.8 s / 1.0 s |

Shorter routes are much quicker (most under 10 ms at normal speed). Loaded only when a visitor uses the route feature, never for
the ordinary search.

## Conclusions

- **Feasible and private:** a motorways + A + B roads network (about 1.2 MB, loaded once and then cached by the browser) gives real
  road routes in well under a second on a phone, entirely on the visitor's device.
- **Good for:** "may be close to the route" (stations within a short distance of the actual road route, and the extra miles of a
  detour by road) and the calculator's "extra miles".
- **Not for:** the eight-nearest list's distances (local trips start on minor roads); those stay straight-line.
- **Licence:** OS OpenData; the download's licence file asks for "Contains Ordnance Survey data © Crown copyright and database right
  2026" (the footer already carries an OS line, worded slightly differently, from Open Names; to tidy when built).
- **Upkeep:** OS updates Open Roads twice a year (April and October, from memory); rebuild the network then, by hand or with a
  scheduled job.
- **Open questions for later:** how to describe the remaining approximation in "About these figures"; whether to add one-way
  information (OpenStreetMap has it, under a different licence, ODbL, which needs its own credit and share-alike terms).
