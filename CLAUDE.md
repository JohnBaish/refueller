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
