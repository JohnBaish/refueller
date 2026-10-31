# Refueller — build plan

Staged so John can see and approve each stage before the next begins. Each
stage is built on its own branch and merged to `main` only when John says so
(HOUSE-STYLE §10; notes and documents may be merged without asking, with a
word afterwards). Read `SPEC.md` and `HOUSE-STYLE.md` before starting any
stage. **Nothing past Stage 0 starts until John has answered SPEC §11 (his first
answers are recorded there) and agreed the next stage.** The repo is public
(John, 23 October: every site must stay free to run).

At the end of every stage:

- `npm run build`, `npm run lint` and `npm run check` are clean (once they
  exist).
- Anything with a screen has been checked in a real browser (Playwright,
  Chromium at `/opt/pw-browsers/chromium`) at 1200px and at 390px with touch
  emulation, with no sideways page scroll at 390px. Screenshots are shown to
  John.
- There is a dated entry in `CLAUDE.md`: what was built, why, what was left
  alone, how it was verified, and what couldn't be checked.
- John gets a short plain-English summary, and a preview link where there is
  something to see.

The order below follows Hindcaster: real data first, so the page is designed
against real figures. It changes with John's answers (for example Q2 and Q3).

---

## Stage 0 — spec and plan

Branch: `stage-0-spec`

`SPEC.md`, `PLAN.md`, `CLAUDE.md` and `README.md`, with the handover moved to
`design/handover-2026-10-22.md` (words unchanged) and `HOUSE-STYLE.md`,
`SEO-HANDOVER.md` and `.claude/skills/fresh-look/` copied from clockwheel
(`36378ed`). John answers SPEC §11.

## Stage 1c status, 27 October: built and merged to `main`; waiting for John to do the AWS test (`design/aws-test-steps-2026-10-27.md`)

`lambda/` (the handler), `scripts/lib/run-probe.ts` (the probe, split out of `scripts/probe.ts`), `scripts/build-lambda.mjs` (esbuild: one
26 KB JavaScript file, only Node built-ins imported), `.github/workflows/lambda-package.yml` ("Build Lambda package", Run workflow only, read-only,
no secrets; leaves `refueller-probe.zip` as a download on the run page), `scripts/check-lambda.ts`. John's steps: `design/aws-test-steps-2026-10-27.md`.
Merged at John's word; the "Build Lambda package" button now exists. John will come back to this later.

## 27 October 2026, later: John chose AWS (London) for the twice-daily UK collector

**Decided by John:** twice a day (agreed); a card and a billing-enabled cloud account are acceptable, with no charge expected; **route: AWS London**
(region eu-west-2), a small scheduled function. **The CSV's publication times:** about **10am and 4pm** (16:00 on 26 October from the portal; John found 10am,
27 October; taken as UK time, not yet confirmed). The API is near-real-time and each price has its own timestamp, so these only set the two run
times: shortly after each, e.g. 10.15am and 4.15pm UK time.

**Proposed design (not started; John to agree before anything is built):**
- **Stage 1c, a small feasibility test on AWS.** A GitHub workflow builds a ready-to-upload zip of the existing probe as a Lambda function (kept as a
  downloadable artifact, no secrets in it). John creates the AWS account, makes one function in London, types the two Fuel Finder values into the
  function's settings (never into a chat), uploads the zip, presses Test, and pastes back the function's log (it holds counts and shapes only, as now).
  Green proves a London AWS address is accepted and finally shows the real data. Red ends the route cheaply.
- **Stage 2, the collector as a function.** The same code, trimmed to the page's data file, run twice a day by **EventBridge Scheduler** (it can use the
  `Europe/London` time zone, so summer time looks after itself), saving the data file into this repo through GitHub's API so Vercel rebuilds. It needs a
  GitHub token limited to this one repo with write access to contents (**an expiry date to write down; GitHub allows at most a year**).
- **Keeping AWS free (checks to make against AWS's own pages before relying on any of this):** stay in London; do not put the function in a private network
  (that brings charges); do not use AWS Secrets Manager (it is paid; the function's own settings, or the free SSM Parameter Store, are enough); set a
  budget alert at a pound or so; choose the plan on sign-up carefully (new accounts start on a credit-based "free plan" that ends after about six months
  unless moved to a paid plan, per secondary sources). John reads AWS's own sign-up screens, since they change.
- **What Claude can't do:** use AWS. John does the console steps, one at a time, with instructions from Claude; the function's log is how Claude sees results.

## 27 October 2026: the team says twice a day is fine (`design/fuel-finder-team-reply-2026-10-27.md`)

**Twice a day, in step with the CSV publication times, with each price's age shown, is what the team recommends; the five-minute
rule is not ours.** This removes the 288-runs-a-day design and the "publish data without a Vercel rebuild" problem: the collector commits
the trimmed data file twice a day, Vercel rebuilds twice a day (limit 100), as first planned. **What is still needed is a UK address for those
two short runs a day** (the API and the CSV both refuse other countries). Candidates, all needing an account with a card, all unverified here:
- **Oracle London machine plus a GitHub self-hosted runner.** One machine to look after; a twice-a-day job leaves it "idle" by Oracle's
  rule (CPU, network, memory all below 20% over seven days), so it risks being reclaimed unless the account is upgraded to Pay As You Go.
- **A small scheduled function in AWS London** (Lambda plus EventBridge Scheduler). Nothing to maintain and no idle-reclaim rule. EventBridge
  Scheduler has 14 million free invocations a month (AWS's page) and Lambda 1 million free requests a month (a third-party figure, to check).
  Needs the collector ported into a function, its own copy of the Fuel Finder secrets, and a GitHub token to commit the data. AWS's new
  accounts (since July 2025, secondary sources) start on a "free plan" with $100 to $200 of credit that ends after about six months unless
  upgraded to a paid plan; the always-free services stay free but billing would be on.
- **Other London serverless services** (Google Cloud, Azure) work the same way.
**Both routes need John to accept a card on file and, in the end, a billing-enabled account with no expected charge.** Decide this before
anything is set up. **Also to find out:** the CSV's two publication times (found 27 October: about 10am and 4pm).

## 26 October 2026, night: the freshness question asked directly (John sent it)

The team never answered the Fair Use question in John's first email (what to do for a scheduled site). The policy's wording allows only
"the most up to date CSV" or "the API ... on average ... not more than 5 minutes" for a site that promotes fuel retail to motorists;
once a day via the API is neither. **Third email sent** (`design/email-fuel-finder-team-2026-10-26-third.md`): would refreshing
twice a day, in step with the CSV, with each price's age shown, meet the policy? **Whatever they say, the API and the CSV both need a
UK address, so a UK machine is still needed;** their answer decides how heavy the setup is (twice a day: one small job and a
rebuild each time; every five minutes: 288 runs a day and data published without a rebuild). **Do not start the Oracle test until they
answer.**

## 26 October 2026, evening: the team's second reply (`design/fuel-finder-team-reply-2026-10-26-b.md`)

**API: "requests can be made from UK-based data centres, including cloud servers hosted in the UK."** **CSV: "you will need to
subscribe", and "access to the CSV file is restricted to UK IP addresses"**, at the portal page
`.../fuel-finder/access-latest-fuelprices`. So **outcome 1 below is gone** (the CSV is closed to GitHub's servers too), and
**outcome 2, a collector on a UK cloud machine, is the only route that keeps Refueller free and automatic.**

**The Oracle Always Free London route: what is known (web search; Oracle's own pages not read directly, so re-check):**
- Sign-up needs a **payment card for identity verification**; Oracle says it is not charged unless the account is upgraded.
- **Idle machines can be reclaimed:** Oracle deems an Always Free machine idle if, over seven days, CPU (95th percentile),
  network and (for ARM machines) memory are all below 20%. A collector that wakes every five minutes is almost certainly
  "idle" by that test. Oracle's suggested cure is to **upgrade to Pay As You Go**, with no charge while usage stays inside the
  Always Free limits. That means billing switched on, which John may not want.
- Free ARM capacity in London is not guaranteed at sign-up (third-party reports); the home region can't be changed later.
- Whether an Oracle London address counts as "UK" for the CloudFront rule is likely but unproven.

**Proposed next step (not started; needs John's yes): a feasibility test with little sunk cost.** John creates the Oracle account
and one machine in London; installs a GitHub "self-hosted runner" on it (Claude gives the steps; the secrets stay in GitHub);
a manual-run copy of the probe workflow runs on that machine. Green would prove the address is accepted and show the real data
(station count, field quality, hours, file size). Red would end the route cheaply. Only then design the five-minute collector and how
fresh prices reach the page without a Vercel rebuild each time (a data file published somewhere the page can read it at run time).

## 26 October 2026, later: John's answers, and the decision tree

John has **no home machine to leave on and won't buy one** (so option A is out), would "potentially" set up an Oracle
account (option B), and so the comparison is not needed. **What happens depends only on the Fuel Finder team's answer to the
follow-up email:**
1. ~~If the CSV can be fetched automatically from an address that isn't closed to GitHub's servers~~ (**ruled out 26 October**): the collector stays on
   GitHub Actions, twice a day, when each CSV is published. Free, simple, and compliant (SPEC §2a, Q9 option A). Best case.
2. **Otherwise, if UK data centres are accepted:** the collector runs on a free Oracle machine in London (John's account). More to
   look after (updates, free capacity in London not guaranteed, the machine can be reclaimed if idle), and the API every five
   minutes needs prices published without a Vercel rebuild each time.
3. **Otherwise (UK home and business broadband only):** Refueller can't be built within "free, with nothing for John to look
   after", and John would move on to his next project. The notes and saved documentation stay on `main`.

## 26 October 2026: the Fuel Finder team replied (`design/fuel-finder-team-reply-2026-10-26.md`)

Their reply (probably automatic) lists "an IP address outside the UK" as the first reason for a 403, and offers
whitelisting for a service outside the UK **if it has a single static public outbound IP address**. GitHub's free
servers have no fixed address (fixed addresses come only with GitHub's paid "larger runners"), so whitelisting
GitHub is not possible for free. **So the collector has to run from a UK address.** Choices for John (not decided):
- **A. A computer at John's home** (one already on all the time, or a Raspberry Pi, a one-off purchase). Shown to
  work: the site loads from his home broadband. He looks after it; it stops if the power or broadband does.
- **B. A free cloud machine in London** (Oracle's Always Free tier). No hardware, always on, but an account to set
  up, free capacity in London is not guaranteed, and it works only if the block is by country, not by data-centre
  network (follow-up question 1 asks exactly this).
- **C. Other London cloud services** (for example AWS Lambda): free tiers exist but need a card, with a small risk of
  charges if misconfigured; not recommended given "must stay free".
**Still to design, whichever is chosen:** getting fresh prices to the page every five minutes without a Vercel
rebuild each time (Vercel allows 100 deployments a day). A follow-up email asking whether UK data centres are
accepted, and where the CSV is, is drafted in `design/email-fuel-finder-team-2026-10-26-followup.md`.

## PAUSED (24 October 2026) until the Fuel Finder team reply

John will send `design/email-fuel-finder-team-2026-10-24.md` on Monday 26 October. **To resume:** start a new thread on
`main`, paste their reply, and say "resuming Refueller". Nothing is running or scheduled; the two secrets exist in GitHub;
the "Probe Fuel Finder" workflow runs only when John presses Run workflow. Their answer decides how the collector runs
(SPEC §2a Q9, PLAN Stage 1 options A to C).

## UNPARKED (24 October 2026): John has registered and holds a client ID and secret

John's next step is to add them to GitHub as secrets (step 4 below). He has not seen a CSV link or
an API host in registration, only the credentials; the probe (Stage 1) will have to find the host.
The original parking note follows.

### Original parking note: waiting for John to register

Everything is paused until John registers for Fuel Finder. **When he does**, he should:

1. Start at `https://www.developer.fuel-finder.service.gov.uk/access-latest-fuelprices`
   and sign in with GOV.UK One Login.
2. ~~Read and paste the terms~~ **Done 24 October** (SPEC §2a): the Open Government
   Licence plus the Fair Use policy, which requires the latest CSV or API calls at least
   every five minutes on average. **Instead, look for how the CSV is downloaded** (a
   fixed web address? a login? the emailed link?), its column names, and how often it
   appears, and paste what you find (SPEC §2a, Q9).
3. Note the **host** (the base web address of the API) if registration shows it. The
   paths are known (`/api/v1/...`); the host is not, and the handover's guess is
   `www.fuel-finder.service.gov.uk`.
4. Put the client ID and client secret **straight into GitHub** as repository secrets
   `FUEL_FINDER_CLIENT_ID` and `FUEL_FINDER_CLIENT_SECRET` (Claude gives the steps
   when the time comes). Never paste either into a chat or a screenshot.
5. Email `fuel.finder@ve3.global` about "Don't redistribute raw API data" only if the
   terms leave the question open (SPEC §2, Q3).

Then Stage 1 (below) starts, in a new thread on `main`.
**The collector's design now depends on Q9** (CSV or five-minute API; SPEC §2a): the CSV
route collects twice a day; the API route needs about 288 runs a day and a data host that
doesn't rebuild the site (Vercel allows 100 deployments a day).

## Stage 1 — find out what the source really gives

**Status, 24 October (night):** the probe is on `main` with diagnostics and has been run twice by John. **Result: the
whole of `www.fuel-finder.service.gov.uk` answers GitHub's servers with an empty HTTP 403 from CloudFront
(Washington edge), including the public Report a Discrepancy page and the API with no token** (SPEC §2). The control
page at www.gov.uk answered 200. So no sign-in has been attempted at all, and the credentials are not the problem.
**Blocked on the Fuel Finder team** (John plans to email on Monday 26 October) and on John's one-click test below.
Nothing more can be learned from GitHub's servers.

**If the API is closed to GitHub's servers** (decide after the next run; nothing here is chosen yet):
- **A. Ask the Fuel Finder team** (`fuel.finder@ve3.global`): is the API limited by country or network, can it
  be opened to GitHub's runners, and where does the CSV download automatically? Draft email in CLAUDE.md.
- **B. The CSV route** (SPEC §2a, Q9 option A), if the CSV is served from somewhere that isn't blocked.
  John to look in the portal for a CSV link (not a signed address).
- **C. Run the collector from a UK address.** Candidates, all unverified: John's own computer or a
  Raspberry Pi as a GitHub "self-hosted runner" (free, must stay on, and a self-hosted runner on a public repo
  needs care); a free cloud machine in London (for example Oracle's Always Free tier, or AWS Lambda in
  London); or a Cloudflare Worker. Each may still be refused if the block is on cloud networks, not on
  countries, and each is more to look after than GitHub.
- **Not an option:** hiding where requests come from (a VPN or proxy to look British). The Fair Use terms
  forbid circumventing security measures, and a suspended account would end the project.

Branch: `stage-1-probe`

Needs John's yes to Q2 and Q3 first.

1. **John registers** for Fuel Finder (GOV.UK One Login), reads the terms and
   adds the two secrets `FUEL_FINDER_CLIENT_ID` and `FUEL_FINDER_CLIENT_SECRET`
   to the repo's GitHub Actions secrets (Claude gives step-by-step
   instructions, with each box named; the values go only into GitHub, never
   into a chat). Write the secrets' expiry dates here once known.
2. **John allows the sites** in SPEC Q3 in the environment's network settings
   (and removes any that were needed only once, later).
3. **Read the portal's Developer Guidelines**
   (`design/fuel-finder-developer-guidelines-2026-10-24.md`). The public API is read-only,
   so the probe and the collector can both use the **live** credentials (the
   portal says read-only calls may be tested against live or test): one pair of
   secrets, one request at a time, one access token per run, reused for every request in it and never requested per
   call (the portal asks for tokens to be reused until close to expiry; they last an
   hour), 429 and errors
   handled with a backoff, nothing from the API or the secrets ever printed to a
   public Actions log, and no raw response committed.
4. Scaffold `package.json` and `tsconfig` to match Hindcaster (Node runs `.ts`
   scripts directly), `.env.example`, and a "Probe Fuel Finder" workflow (Run
   workflow only).
5. `scripts/probe.ts`: gets a token, fetches one batch of stations and one of
   prices, and records **shapes only** (field names, types, counts, batch
   sizes, status codes, timings, response headers about limits), never the
   token or secrets. Writes `design/probe-<date>.md`.
6. From the real answers, correct SPEC §2–§5 (endpoints, fields, fuel codes,
   opening-times format, closure flags, price ranges, how many stations, the
   size of the trimmed list, rate limits, outage behaviour) and list what
   changed.

## Stage 2 — the collector

**Built 28 October on `stage-2-collector` and merged to `main` the same day, as an AWS Lambda function in London** (the GitHub Actions and cron-job.org
design below is superseded: the API refuses non-UK addresses). John's answers, 28 October: runs at **10.15am and 4.15pm
UK time** (AWS's scheduler, Europe/London); old prices marked after **30 days** (Q7, B); 00:00 to 00:00 read as agreed
(Q14); **the collector's commits go straight to `main`**; unusual prices shown with a note, never marked cheapest (B).

What it is: `scripts/lib/clean.ts` (the rules), `scripts/lib/collect.ts` (Fuel Finder, GOV.UK bank holidays, and one
commit to `main` through GitHub's API: `data/stations.json`, `data/prices.json`, `data/bank-holidays.json`,
`data/runs/YYYY-MM.jsonl`), `lambda/collector.ts` and `lambda/make-collector.ts`, `scripts/check-collect.ts`; the
"Build Lambda packages" workflow makes both packages. John's steps: `design/aws-collector-steps-2026-10-28.md` (a
fine-grained GitHub key for this repo only, Contents read and write, about a year): **expires 28 January 2027** (GitHub's 90-day default, made 30 October 2026; renew before then).
Left for Stage 3: the check of each station's position against its postcode.

*The original plan, kept for the record:*

1. `scripts/lib/clean.ts`: plain functions (kept apart from fetching, so they
   can be checked without the network) that join stations and prices, drop
   permanently closed stations, flag temporary closures, drop prices outside
   the sensible range, flag old prices, and trim to what the page needs.
   Rules the field guide adds: Great Britain only (drop Northern Ireland by country
   and `BT` postcode); a future `permanent_closure_date` stays open until then;
   fuel codes matched without regard to case; a station whose position is far from
   its own postcode district is left out; unusable opening hours are kept but marked
   "hours not listed". The collector also fetches GOV.UK's bank-holidays feed and
   writes the dates for England and Wales and for Scotland into the data file.
   From the station sample: opening times are `HH:MM:SS` (ignore seconds), the
   24-hour flag beats the times, 00:00 to 00:00 with the flag false is ambiguous (SPEC
   Q14), `bank_holiday` is one object, `country` and names come in capitals, `county`
   may be null, `fuel_types` is a list of codes. Tidy names for display (BP, ESSO etc.).
2. `scripts/collect.ts`: fetch (one retry at most, polite to the API's limits),
   clean, write the data file, keep the last good copy when a run fails, and
   log each run (counts, newest price time, failures) in `data/runs/`.
3. `.github/workflows/collect.yml`: Run workflow, started by cron-job.org at
   the times agreed in Q9 (no GitHub schedule, as Hindcaster); commits `data/`
   to `main` (the collector's own commits go straight to `main`, as
   Hindcaster's do, if John agrees). John sets up cron-job.org and its GitHub
   token (expiry date written here).
4. `npm run check` (`scripts/check-clean.ts`): the cleaning rules on real
   examples from the probe, an outage run keeping the old copy, duplicate
   stations, a station with one fuel.
5. John merges once the first real runs look right.

## Stage 3 — places and the search rules

Branch: `stage-3-search`

1. Postcode positions per Q4 (OS Open Names; `scripts/build-postcodes.ts`,
   the download kept out of the repo), with a check that known postcodes land
   within tens of metres of where they are, and the credit lines read from the
   licence file.
2. `src/lib/search.ts`: nearest eight open stations (UK clock time, clock
   changes, opening times that run past midnight, 24-hour stations, no hours
   listed, fewer than eight open), distance in miles (Q5) and the
   wording/rounding helpers copied from Hindcaster (`format.ts`).
3. `npm run check` covers all of it, with worked examples checked by hand.

## Stage 4 — mock-ups

Branch: `stage-4-mockups`

Computer and phone mock-ups from real collected data for John's approval, for
every state listed in SPEC §7, with labelled options where there is a choice.
No wiring in before approval.

## Stage 5 — the page

Branch: `stage-5-page`

1. Scaffold Vite + React + TypeScript; copy `organic.css`, `global.css`
   (trimmed), `icons.tsx`, `responsive.ts`, `words.ts` from clockwheel and the
   `SafetyNet` pattern from Hindcaster.
2. Build the agreed page; remembered postcode in `localStorage`
   (`refueller.choice`); statistics stripped of anything after "#".
3. **Dark mode, built in from the start** (John, 29 October; HOUSE-STYLE §2
   and §16): the agreed colours and switch, following the device's setting;
   mock-ups in both themes.
4. Browser checks as above, plus every real data state (old copy, missing
   price, nothing open).

## Stage 6 — launch

**Status, 30 October 2026:** done and merged: favicon, link-preview image and tags, canonical, robots.txt, sitemap.xml.
**Held back by John until more features are built** ("some of the fancy stuff" first): the `refueller.baish.net` domain,
Web Analytics, Search Console, the baish.net landing card with the hub's description, and the overview PDF. Until then the
page is only on Vercel's own address.
**31 October 2026:** the domain is live (John): `refueller.baish.net` added to the Vercel project (Valid Configuration) and a CNAME
at names.co.uk; checked with Google's lookup tool and opened on John's phone. Web Analytics, Search Console, the landing card and
the overview PDF still held back.

Branch: `stage-6-launch`

Favicon options and a link-preview image (shown to John before wiring in,
HOUSE-STYLE §7); the search title, description, canonical, robots.txt and
sitemap, and the visible explanation (SEO-HANDOVER checklist, John's wording);
the credit lines and privacy wording as agreed; Vercel project, domain and Web
Analytics (John); Search Console (John); then, last, the baish.net landing card
with the hub's description updated, and the overview PDF
(`design/overview/` in clockwheel). A **fresh look** review after launch.

**Link-preview tagline:** "Nearby petrol and diesel prices" (John, 30 October), on the image (`design/og-refueller.html`) and in the
`og:`/`twitter:` descriptions. **Update it when Refueller gains more features** (the calculator, "may be close to the route").

## Stage 7 — the calculator (merged to `main` 30 October 2026)

Branch: `stage-7-calculator`

"Is it worth driving further?" (SPEC §9). Its own questions, mock-ups and
checks first; the arithmetic in `npm run check`, including the handover's
worked example (net 38p, break-even about 2p a litre).

**Decided by John (30 October 2026):**
- **Where:** a small "Worth driving here?" link under each station's prices, opening a panel beneath that station.
- **Compared with:** the nearest station that is open and sells the chosen fuel.
- **What the visitor types:** how much they'll spend, in £, starting at **£50**; and their car's mpg, starting at a typical
  figure for the chosen fuel, which they can type over. Defaults (C4 option a): **petrol 36 mpg, diesel 43 mpg**, from
  NimbleFins's figures based on drivers' own fill-ups (seen only in a search summary; the page couldn't be opened from here).
  Overall figures, not town-only. Labelled "a typical figure; change it to your car's".
- **Litres** = £ ÷ the nearest station's price; **saving** = litres × the difference in price per litre.
- **Extra miles** from road routes (OS Open Roads, `design/road-routing-feasibility-2026-10-30.md`), there and back, shown as
  "about N miles" in a box the visitor can type over.
- **Fuel:** Unleaded and Diesel buttons, starting on the one used last time.
- **Remembered on the device:** fuel, mpg and £ amount (the footer's privacy sentence to say so).
- **Wording (C6, agreed):** "Worth it: you'd save about £1.20 on 40 litres. The extra 6 miles would use about 82p of fuel, so
  you'd be about 38p better off." / "Not worth it: the extra 6 miles would use about 82p of fuel, more than the 40p you'd save."
  / "It's worth the trip if this station is at least 2.1p a litre cheaper. This doesn't count your time or wear on the car."
  (to be adapted to £ spent rather than litres).
- **Still to come:** an "About these figures" paragraph on the calculator and the OS credit for the road map, drafted with the
  mock-up. Fair Use: no problem (prices as reported, compared on price and miles).

---

## Needed from John, and when

| When | What |
|---|---|
| Now | Answer SPEC §11 |
| Stage 1 | Register for Fuel Finder, read the terms, add the two secrets, allow the network sites |
| Stage 2 | cron-job.org job and GitHub token; re-save `collect.yml` on github.com after Claude changes it |
| Stage 6 | Vercel project, domain, Web Analytics, Search Console, DNS |

## Dates to remember

- **28 January 2027:** the collector's GitHub key (`refueller-collector`, fine-grained, this repo only, Contents read and
  write) expires. Renew it a week or two before, and put the new key into the AWS function's `REFUELLER_GITHUB_TOKEN`.
- **Late April 2027:** the AWS free plan ends (six months from 27 October 2026, or sooner if the credit runs out).
  Upgrade to the paid plan before then if Refueller is running, after checking the Lambda and Scheduler free limits.
- **10 March 2028:** GitHub API version `2022-11-28`, used by the collector, is switched off (date from Hindcaster's notes).

Still to find: the Fuel Finder secrets' expiry and rotation dates (the portal says to rotate client secrets regularly;
none shown at registration).

## Ideas logged for later

Not to be worked on yet: a "More fuels" choice (super unleaded, premium
diesel, HVO); a map; price history from our own snapshots; filters (motorway
services, supermarkets, 24 hours); Northern Ireland; the cheapest station
within a chosen distance; county or region pages for search.

**Asked for by John (30 October 2026), to come after launch:**

1. **A 14-day price graph for a station (built and merged 31 October 2026 as "Price history"):** how its unleaded and diesel prices have changed over the last 14 days,
   beside the average of the eight stations shown. Notes from checking:
   - *Fair Use policy:* nothing in it forbids history or comparisons. What applies: comparisons must be "based on
     objective criteria" and not "misleading", prices shown "in an unbiased manner", timestamps not altered. An
     average of the same eight stations, with each price drawn as reported and stepping at its own "price set"
     time, meets that. The graph should say what the average is of, and treat a station with no price for a fuel
     plainly (left out of that fuel's average, and said so), so no trader looks better or worse than the data shows.
   - *Where the history comes from:* every collection is already a commit to `data/prices.json` on `main`, from 30
     October 2026, so the build can rebuild 14 days of prices from git history (about 28 collections). Nothing new to
     collect. Until 14 days have passed, the graph has less to show.
   - *Size:* 14 days for every station would roughly double the page's area files, so it should load only when a
     visitor opens a station's graph (still the same files for every visitor, so nothing about a search reaches the
     server).
   - Follow the house rules for charts (HOUSE-STYLE §5; the dataviz skill), and agree a mock-up first.
2. **"Centre on this station":** a button on each station that searches again from that station's own position (not
   its postcode district, whose middle can be a mile or more away), so a visitor heading that way can see if anything
   further on is cheaper. Worked out in the browser like every search; the address after "#" would need a form for a
   station, e.g. `#station/<id>`.
   **Built and merged 30 October as "Find stations near this one"; link hidden 31 October (John):** it adds clutter, and the
   other two features ("Worth driving here?" and "Price history") are better. John would like to give it more thought much
   later on. All the work stays in the code: `SHOW_FIND_NEAR` in `src/components/Results.tsx` brings the link back, and
   `#station/<area>/<code>` addresses still open a station's eight.
3. **Cheapest on the way (John, 30 October):** type where you're going as well as where you are, and see the three cheapest
   prices roughly on the way, compared with the station nearest the start, and the same at the other end. Notes from
   checking:
   - *No routing service:* a real road route would mean sending both postcodes to a routing company (against "nothing a
     visitor types goes to a third party") and, for most, a key and limits. Instead, worked out in the browser: a station
     counts as on the way when going via it adds only a little straight-line distance (start to station to destination,
     less start to destination; for example no more than 3 miles). Wording (John, 30 October): "may be close to the route",
     with the rule explained in "About these figures". John is not sure about the straight-line ("as the crow flies")
     approach (30 October): to be discussed before any mock-up. **Tested the same day:** real road routes in the browser
     from a slimmed OS Open Roads network are feasible and private (`design/road-routing-feasibility-2026-10-30.md`). It will sometimes be wrong where roads bend a long way from the straight line (estuaries, the
     Highlands, crossing water), so the wording must make the approximation clear.
   - *What to show:* for each fuel, the three cheapest on the way with their extra distance, against the station nearest
     the start; and the three cheapest near the destination against the one nearest it. Ranking by price and extra distance
     is objective, so it sits within the Fair Use policy.
   - *Data:* a long journey crosses many postcode areas, so either more area files load, or the index carries each
     station's two prices (it would grow a little). Decide with a mock-up.
   - The calculator (stage 7) fits here: whether the cheaper price pays for the extra miles.
4. **Full postcodes (John, 30 October; built and merged 31 October 2026):** search from the whole postcode ("RG1 8FR") when it is
   typed, not just the middle of its district. Positions from OS Open Names (the same download as `data/outcodes.json`), one
   file per postcode area, loaded only for the area typed, so nothing leaves the browser. The wording needs thinking about with
   and without the second half (headings, "Straight-line distances from …", the hint "Only the first half (RG1) is used.", About).
   The calculator's road miles would still start from the district middle (road figures for every postcode would be far too big).

