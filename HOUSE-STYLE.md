# baish.net house style

The shared look, behaviour and ways of working behind John Baish's tools
(Clockmaker, Backtimer, Flowcharter, Hindcaster, the baish.net landing
page), written so a new project can match them without re-deriving
anything. Most of it is taken from what is live in this repo
(`JohnBaish/clockwheel`); what Hindcaster added (outside data, scheduled
jobs, a site built over many threads) was agreed with John on 2026-10-22.

**These are models, not laws.** In John's words, a basic structure "we can
vary depending on the task and mood". Where something here doesn't fit, say
so and suggest the better way.

**Rule of thumb: copy, don't reinvent.** Copy the files listed below into
the new project and build on them. If something here and the code
disagree, the code is right; update this file.

`CLAUDE.md` in this repo is the full dated history of Clockmaker and
Backtimer — long, and mostly about those apps. Read it only for the
"why" behind a specific decision.

---

## 1. Files to copy into a new project

| File | What it gives you |
|---|---|
| `src/styles/organic.css` | The design system: colour, type, spacing, radius and shadow tokens, plus buttons, inputs, cards, tags, nav, tables. Self-hosted fonts are imported at the top. |
| `src/styles/global.css` | App-level additions: `.plain-input` / `.outlined-input` (edit-in-place boxes), `.link-card`, `.list-cards` (phone list layout), the hamburger nav at ≤720px, iPhone no-zoom and 44px tap-height rules, print rules (`[data-noprint]`, `.print-only`). Drop the Clockmaker-specific bits (`.week-*`, `.library-clock-name`, `.callout-label`, `.print-clock-card`). |
| `src/lib/icons.tsx` | Pattern for icons: Lucide (`lucide-react`) wrapped at stroke width **2.75**. |
| `src/lib/responsive.ts` | `useIsNarrow(720)` — the phone/computer switch. |
| `src/lib/timeInput.ts` | Phone keyboard helpers (`isTouch`, `toColon`, `selectAllSoon`). Only if the new tool has time or number entry. |
| `src/lib/useDragReorder.ts` | Drag-to-reorder by a grip handle, mouse and touch. Only if needed. |
| `src/lib/words.ts` | `numberWord` / `countOf`: the number rule for running text (§13). |
| `src/lib/staleCopy.ts` and `.stale-bar` in `global.css` | The "changed in another tab" warning (§14). The matching code in `state/store.tsx` and `App.tsx` is small; copy the pattern. |
| `public/favicon*.svg` | Favicon style to adapt (see §7). |
| `design/og-clockmaker.html` | Link-preview image source; use it as the template for a new tool (see §7). |
| `SEO-HANDOVER.md` | How search (titles, descriptions, canonical, robots.txt/sitemap, visible text, Search Console) was done, with a checklist for each new tool (see §12). |
| `design/overview/` | The baish.net overview PDF: every site described, with screenshots, for discussing themes and ideas in other chats; its source and a script that rebuilds it. Lives here only, not copied (see §16). |
| `HOUSE-STYLE.md` and `.claude/skills/fresh-look/` | This file, and the "fresh look" review procedure with its PDF template and script (see §11). Copy both into every project, new or existing. |

Dependencies these rely on: `@fontsource/caprasimo`, `@fontsource/figtree`,
`lucide-react`, React. Stack is **Vite + React + TypeScript**, `oxlint`
for linting, no backend.

## 2. Colour

Core tokens (all in `organic.css` `:root`):

| Token | Value | Used for |
|---|---|---|
| `--color-bg` | `#f5ead8` cream | page background |
| `--color-surface` | `#ebddc5` | cards, nav bar, inputs being edited |
| `--color-text` | `#201e1d` ink | text |
| `--color-accent` | `#c67139` terracotta | primary buttons, links, focus rings, kickers |
| `--color-accent-2` | `#7a8a5e` olive | secondary accent (rarely used) |
| `--color-divider` | ink at 16% | hairlines, button outlines |

Each of neutral, accent and accent-2 has a 100–900 ramp
(`--color-neutral-700` `#645c50` is the standard muted text colour;
`--color-accent-700` `#8c491a` is the darker terracotta used for
text-style action buttons and links).

**Every tool has a dark mode** (John, 2026-10-29, replacing "optional,
tool by tool"). New tools are built with it from the start, not asked about
late in the design; tools in development get it too. Hindcaster and
Lightreader have it (Hindcaster's is the one to copy); for Clockmaker,
Backtimer, Flowcharter and the landing page, mock-ups went to John on
2026-10-29, and nothing goes live until he agrees. The agreed dark
colours (Hindcaster's "option B"; a first, near-black version was too
dark and harsh on John's phone and laptop):

| Token | Dark value |
|---|---|
| `--color-bg` | `#2a2723` warm dark grey |
| `--color-surface` | `#37332e` |
| `--color-text` | `#e8dfcf` soft cream |
| `--color-accent` | `#dd8a56` terracotta, a shade lighter |
| `--color-divider` | text at 16% |
| `--color-neutral-100` / `-700` / `-800` | `#423d36` / `#b0a593` (muted text) / `#e3d9c7` |
| `--color-accent-100` / `-300` / `-600` / `-700` / `-800` | `#4a2a14` / `#b2622d` / `#e8935d` / `#f2a573` / `#ffc6a5` |
| `--color-accent-2-100` / `-800` | `#2f3a20` / `#d4e4b8` |
| shadows | a 1px hairline in text at 6–8%, plus a dark shadow |

Contrast on the background: text 11.2:1, muted text 6.1:1, terracotta
5.6:1. Don't go lighter than this: a step further brought the small
terracotta labels below 4.5:1. How it's built (Hindcaster's
`src/styles/global.css`, `src/lib/theme.ts`,
`src/components/ThemeSwitch.tsx`, `index.html`):

- The dark values sit in the tool's `global.css` under
  `@media screen { :root[data-theme="dark"] { … } }`, with
  `color-scheme: dark`; `organic.css` stays as it is. Screen only, so a
  printed page is always light.
- **Finer text smoothing in dark mode**, in the same screen-only block,
  straight after the dark colours:
  `:root[data-theme="dark"] body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }`.
  Macs draw light text on a dark page with heavier, soft edges, most of all
  the Caprasimo headings; this made it "way better" (John, October 30th
  2026, on a MacBook). Only browsers on macOS use it (iPhones, Windows and
  Android ignore it), and light mode is left as it is.
- A switch at the top right of the nav bar (like DPD's tracking page): a
  pill with a sun or moon, `role="switch"`, a small "DARK" label on a
  computer only, 44px tall to tap on a phone.
- The choice is kept in `localStorage` (`<tool>.theme`), and a few lines
  in `index.html` set it before the page draws, so there's no flash of
  the light page. Blocked storage just means light.
- **It follows the device's own setting** (light or dark) until the
  visitor uses the switch (John, 2026-10-29; until then it was light by
  default). Only a choice that differs from the device is kept, as
  `'light'` or `'dark'`; setting the switch back to match the device
  removes it, so the page follows the device again. While nothing is kept,
  the page changes live when the device does (for example a phone that
  turns dark at dusk). The `index.html` script works out the same before
  the page draws: a kept choice wins, otherwise
  `matchMedia('(prefers-color-scheme: dark)')`. Blocked storage just means
  following the device.
- The footer's privacy wording mentions it. Hindcaster's: "Your device,
  rather than the website, stores your last choices (location and light
  or dark mode), so the page opens the same way next time."
- Charts: re-check their colours in both themes ("Charts" in §5).

## 3. Type

- **Headings and buttons:** Caprasimo, weight 400 — the only weight that
  exists. Don't ask for bold or italic Caprasimo: the browser fakes it and
  John found the result "mushy". This includes anything that inherits
  Caprasimo from a heading or button and is then set bold (a small tag or
  label inside a heading, say): such labels use the body font, Figtree
  (John, October 30th 2026, after a faked-bold tag in Riverwatcher's
  mock-up looked blurry).
- **Body:** Figtree 400 / 600 / 700, base size 15px, line-height 1.55.
- Heading sizes: h1 42, h2 32, h3 25, h4 20 (px).
- Both fonts are **self-hosted** through `@fontsource` (imported at the top
  of `organic.css`), never loaded from Google Fonts — that would send every
  visitor's IP address to Google. This was a deliberate privacy decision.
- Numbers that line up in columns get `.mono` (tabular figures).

## 4. Spacing, shape, elevation

- Spacing: `--space-1` 4.4, `-2` 8.8, `-3` 13.2, `-4` 17.6, `-6` 26.4,
  `-8` 35.2 (px). Most gaps are `-2` to `-4`.
- Radius: `--radius-sm` 8, `--radius-md` 16, `--radius-lg` 28.
- Shadows: `--shadow-sm/md/lg`, soft and ink-tinted.

## 5. Layout and components

**Page frame**
- Nav bar: `--color-surface` background, padding `--space-3` × `--space-6`.
  Brand name on the left in Caprasimo 18px; links on the right, 14px,
  terracotta when current. At ≤720px the links collapse behind a hamburger
  (`.nav-menu-toggle` / `.nav-panel`); a tool with only one screen skips
  the hamburger entirely.
- Content column: max-width **1100px**, centred; each screen has padding
  `0 var(--space-6) var(--space-6)`.
- Page header: a small uppercase terracotta kicker (`.card-kicker`, 10px,
  letter-spaced) above an `h2`.
- Action row (top right of a screen): text-style buttons —
  `btn btn-ghost` in `--color-accent-700` with a 15px Lucide icon, e.g.
  "🖨 Print", "+ Add item"; destructive ones ("Clear") in
  `--color-neutral-700`. Print lives on each screen that can print, not in
  the nav.

**Buttons** (`.btn` + one of): `btn-primary` (terracotta fill, cream text —
the main action, e.g. Next/Done), `btn-secondary` (hairline outline —
e.g. Duplicate, the full-width "+ Add item" under a phone list),
`btn-ghost` (text only — light actions). All rounded `--radius-md`,
Caprasimo 14px.

**Cards:** `.card` — surface background, radius 16, padding `--space-3`
(use `--space-6` when a card holds paragraphs, so text clears the rounded
corners). `.card-kicker`, `.card-title`, `.card-body` inside.

**Tags / chips:** `.tag` + `tag-neutral` / `tag-accent` — small rounded
pills for counts and status ("2 items", "saved just now").

**Tables:** `.table` — uppercase 11px headers, faint row lines, row hover.
Fixed column widths rather than stretching to full width.

**Edit-in-place boxes:** `.plain-input` looks like plain text until hovered
or focused (accent border + surface fill when editing). Add
`.outlined-input` where a box should always look editable (durations).

**Footer notice** (bottom of a tool's main screen):
`marginTop: 64`, `paddingTop: var(--space-3)`, top border
`1px solid var(--color-divider)`, 12px text, line-height 1.6,
`--color-neutral-700`, centred, `data-noprint`. Links in it are
`--color-accent-700`, underlined.

**Step-through cards** (Backtimer's getting-started walkthrough,
`src/components/BacktimerWalkthrough.tsx`): a `.card` with a border and
`0 12px 32px` shadow; "Step N of M" kicker with **Skip** top right; title
in Caprasimo 20px; one question, one box, one "You can change this later
in…" line; **Back** (ghost) and **Next/Done** (primary) bottom right;
"Don't show this again" tickbox. On a computer it sits in the page under
the content; on a phone it sits at the top (see §6).

**Confirmations:** destructive actions with no undo (Clear, Delete) use a
plain `window.confirm()` that says exactly what will be lost.

**Safety net:** wrap the screens in a React error boundary, so a fault shows
a plain message ("Sorry, this page couldn't be shown. …") with a way back,
never a blank page. Patterns: `SafetyNet` in Hindcaster's `src/App.tsx`, and
`src/components/SafetyNet.tsx` here and in Flowcharter ("Sorry, this screen
couldn’t be shown. Your … still saved in this browser." with Go to the Library,
or Reload the page where there's no Library).

**Label-and-value cards on phones:** labels in one narrow fixed column, and
every value starting at the same left edge beside it (a two-column grid),
not values pushed to the right edge. Chosen as "option B" in Hindcaster
(2026-10-20).

**Charts:** use fixed scales, so a small difference looks small and a
large one large; don't let each chart stretch to fit its own figures.
Things that can be "none" (rain, counts) start at zero; temperatures
don't, since 0°C isn't "nothing" and the dots are read by their gaps.
Check the colours for colour-blind readers and against both backgrounds
(the dataviz skill's validator). Pattern: Hindcaster's year-ago charts,
`scaleFor()` in `src/lib/yearAgo.ts`.

**Printing:** besides `data-noprint` and `.print-only`, keep table rows,
cards, headings with what follows them, and any self-contained section whole
across pages (`break-inside: avoid`, `break-after: avoid`); a long table may
still split between rows.

## 6. Phones (≤720px)

Every screen must work on a 390px-wide phone with no sideways scrolling.

- Use `useIsNarrow(720)` to render genuinely different markup when needed
  (e.g. a table on a computer, a stack of `.list-card`s on a phone) —
  render one or the other, never both hidden with CSS.
- Text in input boxes is **16px** on phones, or iPhone zooms the page when
  a box is tapped (handled by `global.css` for `.plain-input` and `.input`;
  anything with an inline font size needs it set explicitly). The same goes
  for **any touch screen**, whatever its width: an iPad or an iPhone Duo
  opened out gets the computer layout but is tapped like a phone, so
  `global.css` also sets 16px under `@media (pointer: coarse)`, and inline
  sizes use `isNarrow || isTouch()` (John, 22 October 2026).
- **Tablets get the computer layout** (every iPad is wider than 720px). Check
  touch-only features there too: a phone-only button or panel may also be
  wanted on a touch screen of any width (Flowcharter's Full screen and its
  "change the words" panel use `isNarrow || isTouch()`).
- Tap targets at least **44px** tall. A small icon button (e.g. a bin on a
  phone card) can keep its small icon inside a 44px tap area
  (`.list-card-delete` in `global.css`).
- **Phones have no Shift key.** Where Shift-click adds to a selection on a
  computer, make a tap add or remove that item on a touch screen.
- **Back must stay inside the tool.** If a tool has more than one screen,
  give each its own address (`…/#week`, see `src/lib/screenHash.ts`), so
  the phone's Back gesture returns to the previous screen instead of
  leaving the site.
- **Keyboards only open when focus happens during a tap.** If a button
  should open the keyboard (Add, Next), update state with `flushSync` and
  focus the new box inside the same click handler. Never auto-focus a box
  on page load on a touch screen — it looks ready to type but no keyboard
  appears.
- Time/number boxes: `inputMode="decimal"` (digits keypad with a "." key)
  and convert "." / "," to ":" as typed (`toColon`). The number keypad
  has no ":" and no Return key.
- Phones have no Tab key: if Tab adds a row on a computer, give phones a
  visible button for it (a full-width "+ Add …" under the list).
- Keep important buttons in the top ~60% of the screen while a keypad is
  open (it covers roughly the bottom 40%).
- Drag-to-reorder uses `useDragReorder` on a grip handle only (never the
  browser's own drag-and-drop, which ignores touch).
- Text boxes for codes (postcodes and the like): `autoCapitalize="characters"`,
  `autoCorrect="off"`, `spellCheck={false}`, `autoComplete="off"`, and
  `enterKeyHint="go"` when Return starts something.
- Lists of choices (a county list, say): a mouse click or a tap goes straight
  to the choice; the keyboard's arrow keys move through the list without
  jumping, with "Press Enter to show it." beneath (Hindcaster's `AreaList`).

## 7. Icons, favicons and link previews

**Favicons** are hand-written SVGs on a 48×48 viewBox: a circle `r="21"`,
either cream fill with a 2.5px terracotta ring (Clockmaker, baish.net) or
solid terracotta (Backtimer), with two 4.5px round-capped strokes in ink and
terracotta/cream. Each tool gets its own variation on that recipe, so they
read as a family but are easy to tell apart in a row of browser tabs.
Check every new one at a real 16px before using it. Keep to the two-stroke
recipe where it can say something meaningful; if it can't (Hindcaster's sun
behind a cloud needed shapes), keep the same disc and ring with any simple
drawing. Show the options at 16, 32, 48 and 96px in a row of browser tabs
beside the other tools' icons (Hindcaster's `design/favicon-options.html`),
and check at 16px which ones still read.

**Link-preview images** (`og:image`, 1200×630): cream background,
illustration 440×440 at (96, 95), tool name in Caprasimo 72px and a
one-line tagline at (592, 225). Start from `design/og-clockmaker.html`
(`design/` also holds the Backtimer and baish.net sources).
Both fonts must be loaded from `node_modules` by file path — loading from
Google Fonts fails silently without network access and the title falls
back to a plain serif (this happened once). Each HTML entry point needs
its own `og:title`, `og:description`, `og:image`, `og:url` and `twitter:*`
tags; any tagline baked into the image must be updated too whenever the
description changes.

**Status (2026-10-15): done for every existing site.** Clockmaker,
Backtimer and baish.net all have finished preview images, rebuilt from the
`design/` sources with both brand fonts, and their tags are in place
(baish.net: title "baish.net", description "John Baish’s websites"). A new
tool like Flowcharter only needs its own image: copy
`design/og-clockmaker.html`, swap the drawing and words, screenshot it,
and add its tags. Nothing else needs fixing or remaking first.

## 8. Data and privacy

- No accounts and no backend. Everything a person makes is saved
  automatically in their own browser (`localStorage`), with Export /
  Import of a JSON file for backups and moving between devices.
- Once a tool is live, **never rename its storage key** — that would make
  every existing user's work silently disappear.
- Vercel Web Analytics is on (anonymous visit counts, no cookies):
  `<Analytics />` from `@vercel/analytics/react` in React entry points,
  `inject()` from `@vercel/analytics` in non-React pages.
- **Not sending data is a core value of every tool** (John). Nothing a
  person types or chooses goes to a server. Where a choice has to be in the
  page's address (Hindcaster's `#postcode/RG4`), keep it after the "#",
  which browsers never send, and strip that part from the visit statistics
  (`beforeSend` in Hindcaster's `src/main.tsx`).
- Saved preferences (`localStorage`) must survive a private window or blocked
  storage: wrap every read and write in `try`/`catch` and fall back to the
  default.
- Privacy wording is scoped to the person's content, not "your data"
  generally, because visit statistics *are* collected. Approved wording,
  for reuse:
  - "The clocks you build here are not collected; they're only saved in
    your browser. We collect anonymous visit statistics (no cookies, no
    personal data) to see how the site is used."
  - "The data you enter here is not collected; it's only saved in your own
    browser and you can clear it at any time."
  - For a tool where nothing typed in is kept (Hindcaster): "We don't
    record anything you do here, apart from anonymous visit statistics (no
    cookies, no personal data), showing us how the site is used."
- **Other people's data** (weather, maps, postcodes): read each source's
  licence and copy its attribution word for word. Hindcaster puts each in a
  small grey source line at the foot of the section it belongs to, plus a
  "not connected with or endorsed by …" line. **Ask John** how and where
  credits appear before adding them to a new tool.
- Each tool says it is "a free-to-use personal project by John Baish" and
  gives the shared contact address `workshop@baish.net` (one address for
  every tool, since 2026-10-17), as plain text, not a mailto link.

## 9. Hosting

- GitHub (`JohnBaish/…`) → Vercel, which deploys `main` automatically.
- Each tool lives at its own `*.baish.net` subdomain. John adds domains in
  Vercel and DNS himself; ask Vercel's dashboard for the exact DNS record.
- One Vercel project can serve several domains from one build (this repo
  serves clockmaker, backtimer and baish.net, chosen by hostname in
  `src/lib/hostMode.ts` and `middleware.ts`). For a large new tool a
  separate repo and Vercel project is cleaner.
- Vercel lessons: a domain attached to the wrong project shows that
  project's site (Vercel picks the project the domain is attached to);
  Web Analytics has to be switched on in each project's dashboard; a
  private GitHub repo still deploys.
- **Keys and tokens** live only where they're used (GitHub Actions secrets,
  or the outside service). John pastes a token only into the service that
  needs it, never into a chat, and Claude never writes one into a file, a
  log or a commit. Write every expiry date into the project's plan.
- **Jobs on a timer:** start them from **cron-job.org** (it calls the
  workflow's "Run workflow" through GitHub's API), which has been reliable
  where GitHub's own schedule started late or not at all. If a GitHub
  schedule is kept as well, it registers under whoever last saved the
  workflow file, so John re-saves the file on github.com after Claude
  changes it. Make every run safe to repeat.
- The baish.net landing page (`landing.html` here) has a card per tool;
  add one for each new tool when it goes live, and update the hub's
  `<title>` and search description to match (see §12).

## 10. Working with John

- John is not a developer. Explain in plain English, briefly, and say what
  he needs to do (if anything) and what to expect. Instructions for him to
  follow go step by step, giving each box's name and what goes in it
  separately (an arrow like "Key → value" was once typed in literally).
- He decides wording; draft text for him to edit, and use his words
  exactly once agreed. British spelling ("colour", "visualise").
  "Out-time" is hyphenated.
- Propose and agree before building anything significant. For images and
  icons, show a rendered preview for approval before wiring it in. Where
  there's a choice, show labelled options (A, B, C …) as pictures, on a
  phone and on a computer.
- **Starting a project:** a written spec (what it does, with open questions
  numbered at the end) and a plan in stages, one branch per stage. A
  structure to vary as the work needs, not a fixed rule. Step by step in
  §16.
- **Questions in numbered batches** (Q1–Q19, then B1–B6 …), with John's
  answers recorded beside them in the notes, so he can reply by number.
  Break from it when it helps, e.g. "before I start, can you clarify …".
- **Handing over to a fresh thread:** a dated handover file in `design/`
  with everything agreed, what's open and where things are, listed in the
  notes' "read these first" order.
- **The project tracker** (`JohnBaish/baish.net-directory`, private;
  John, 2026-10-29): one file per project in `projects/`, one line each
  in `INDEX.md`, and the outside services in `SERVICES.md`. Its
  `README.md` has the rules. When something significant changes (a stage
  finished, a decision made, something goes live or is parked), update
  the project's file and its `INDEX.md` line, straight to `main`. Before
  committing there, run `node site/check-tracker.mjs` in that repo
  (nothing to install) and fix anything it lists: the `INDEX.md` line
  must keep its exact pattern, `- [Name](projects/name.md) · status ·
  Next: … · Updated …`, with one of five status words (idea, planning,
  building, live, paused), or the tracker website can't read it (John,
  2026-10-31). Each tool's `CLAUDE.md` says so in its key points.
- **Accuracy:** never stand in made-up figures for real ones; anything made
  up is labelled "Illustration only", and test data comes from real
  examples. Work facts out (weekdays, clock-change dates, sunrise times,
  distances) with code rather than from memory. When Claude gets something
  wrong, log it openly as a "Correction:" entry.
- In the notes, mark Claude's own wording or choices "for John to confirm".
- Build new features on a **branch**, not `main`. Vercel gives every
  branch a private preview at
  `https://<project>-git-<branch>-john-baish.vercel.app` (append
  `?host=…` overrides as needed).
- **When to merge** (agreed with John, 2026-10-22):
  - *Without asking:* notes and documents (logs, plans, specs, this file,
    handovers, mock-ups and previews), the fresh-look review files, and
    checking scripts. Say afterwards what was merged.
  - *Only when John says so:* anything a visitor could see or feel (page
    code, styles, wording, images, search tags, the rules that make the
    figures), and anything on a prototype branch.
  - *Also only when John says so,* though visitors don't see them
    directly: scheduled jobs and collectors (they change live data, and
    John re-saves them on GitHub), and anything touching secrets,
    settings, other services or deleting.
  - A small change John has already agreed in so many words can go
    straight to `main` once it's checked.
- **Automatic checks:** a tool with rules worth getting right (sums,
  rounding, dates, sentences built from figures) gets an `npm run check`
  of plain scripts that try the rules on known examples and fail loudly
  if an answer changes (Hindcaster's `scripts/check-*.ts`, no test
  library). Prove a new check works by breaking the thing it checks and
  seeing it fail. Clockmaker and Backtimer's are `scripts/check-sums.ts`.
- Check work in a real browser (Playwright) at 1200px and at 390px with
  touch emulation — not just "it builds". Say plainly what couldn't be
  checked (e.g. a real iPhone keyboard).
- Keep a dated entry in the project's `CLAUDE.md` for every change: what,
  why, what was deliberately left alone, how it was verified.
- Ask before anything destructive or outside the repo.
- Note every site John allows in the environment's network settings, and
  suggest removing any that were needed only once.

**Git safety (Claude's checks, every time):**
- At the start of a thread, check the repo is on an up-to-date `main` (or
  the intended branch), not a fixed snapshot of an earlier point, before
  changing anything (`git status -sb`, then `git fetch` and compare).
- If a merge stops with a conflict, stop: resolve it, and never commit a
  file with conflict markers. Check `git status` before any push to `main`.
- After every push, ask GitHub what it holds (`git ls-remote origin <branch>`)
  rather than trusting "sent": a push from the wrong place can report
  success and send nothing (2026-10-22).

**Preview servers (Claude's checks):** start `vite preview` directly with
`node node_modules/vite/bin/vite.js preview --port <n> --strictPort` (not
through `npx`, whose child can outlive it), and stop it by its process
number, found with `ps -eo pid,args`. Never `pkill -f <pattern>`: the
pattern is in the shell's own command line, so it stops the shell too (this
has happened three times, the last on 2026-10-22). `ss` isn't installed in
these containers.

## 11. Fresh look (a full review)

When John asks for a **fresh look** (or types `/fresh-look`), give the whole
project a long, careful review on a computer and a phone, and report back
**without changing anything**. The full procedure is in
`.claude/skills/fresh-look/SKILL.md`. Claude Code loads it as the
`/fresh-look` command in any repo that has the file on `main`. In short:

- Read the notes first, so agreed decisions aren't reported as faults.
  Review the live `main`.
- Use it like a real person at 1200px and at 390px with touch: first visit,
  every screen, realistic and extreme content, abandoning and going back.
  Run an automatic sweep for errors, sideways scrolling and small tap targets.
  Look at every screenshot.
- Read the code for suspects, then prove or drop each one with a targeted
  test. Report nothing unconfirmed without saying so.
- Report in numbered sections and sub-sections. Start with the overall verdict.
  Then for each area give faults first, then usability points, each with
  **size · priority**, "What happens" and "Recommendation" (options where it's a
  choice). Then "Looked at and would leave alone", "What I couldn't check" and
  "Suggested order". Plain English, British spelling.
- Number every point, never bullets, in every section, including "would
  leave alone" and "couldn't check", so John can reply by number.
- "Suggested order" must place **every** numbered item: quick fixes,
  decisions, optional items, or left alone, ending with a coverage line.
  Check this before sending.
- Send the report as an A5 PDF too, in the brand fonts, so John can read it on
  his phone alongside Claude (`report-template.html` and `make-pdf.mjs` sit
  beside the skill).
- Where the tool shows data, test with every real state the data can be in
  (early and final, older saved formats, a missing source), not only today's.
- Where the tool writes sentences, check all of them across real data, not a
  sample.
- Build nothing until John picks. Then log the findings and his decisions in
  `CLAUDE.md`.

Clockwheel holds the master copy of the skill, like this file. If it
changes, re-copy it to the other projects.

## 12. Search (SEO)

Done for Clockmaker, Backtimer and the hub on 2026-10-17; the full record
and a step-by-step checklist for a new tool are in **`SEO-HANDOVER.md`**
(copy it into the new project). In short:
- `<title>` "Name – free <what it is> for <who>" and a search description
  starting "Free …", both John's wording, as a default that can be broken on
  purpose (Hindcaster's title is "Hindcaster – yesterday's weather in
  England" and its description opens "What was the weather yesterday?"). The
  hub's title is general ("baish.net – free browser tools by John Baish"),
  so it needn't change for each new tool. The search description is
  separate from the link-preview (`og:`) description.
- A tool whose screens live after "#" in the address is one page to Google:
  only its first screen is ever indexed. Put a sentence there that says
  what the tool does, for first-time visitors and for search.
- A canonical tag naming the tool's one main address; the hub's is
  `https://www.baish.net/`. If the app sets `document.title`, it matches.
- robots.txt and a one-address sitemap.xml (plain files in `public/` for a
  one-domain project).
- A short visible explanation a first-time visitor sees, folded parts
  allowed, no FAQ; and "More free tools at www.baish.net." just before
  "Contact:".
- Search Console: one Domain property for baish.net covers every
  subdomain, so a new tool only needs its sitemap submitted and its main
  address inspected and requested.

## 13. Numbers in running text

John's rule: **one to nine as words, 10 and above as digits**, wherever a
number is counted inside a sentence. Decided for Flowcharter (2026-10-18)
and applied to Clockmaker the same day. Check each tool by searching every
file that holds words people see, including messages built in code
(`${count}`), listing every case with its surrounding words, and showing John
before changing anything. Helpers: `numberWord(n)` and `countOf(n, 'hour')`
in `src/lib/words.ts`.

| Kind of number | Rule | Examples |
|---|---|---|
| Counted inside a sentence (pop-up boxes, messages, explanatory text) | Follows the rule | "assigned to three hours … those hours will become unassigned"; "all 12 items" |
| Names, labels and controls: anything that must match what is on screen | Digits | row numbers, "Step 2 of 4", "Mon 06:00", a clock called "Daytime 1", a box you type a number into |
| Times, durations and dates | Digits | "saved 5 min ago", "29:30", "18 Oct" |
| Short count tags (small pill labels) and short count lines | Digits | "3 clocks", "8 songs", "18 segments", "12 of 83 active hours assigned", "used 3 times" |

- **One** is written "one hour", not "the one hour" or "the only hour": the
  latter reads as if it were the single one that exists. (Flowcharter uses
  "the only item" where it really is the only row. Choose for readability,
  not mechanically.) Where a plural verb follows, make it agree: "that hour
  will become unassigned".
- Zero is "zero" only inside a sentence; tags keep "0".

## 14. Two tabs: warn, and stop saving

A tool that saves its whole state to `localStorage` lets an old tab silently
overwrite a newer one (even just by clicking between screens in the old
tab). Pattern, from Flowcharter 7.1 and Clockmaker (2026-10-18):

- The browser sends a `storage` event to a tab only when **another** tab
  changes storage. Compare the new saved text with this tab's own state
  (`savedCopyDiffers`): only the person's **work**, never which screen or item
  is open, and not the last-edited stamp. Compare with sorted keys, and
  treat unreadable or missing text as "nothing to warn about".
- On a difference, show a dark bar across the top ("X was changed in another
  tab. Reload to see the changes. Until you do, this tab won’t save
  anything.") and **stop saving** in this tab. Stopping is the point: a quiet
  refresh could change the screen under someone typing, and warning without
  stopping would still let the next click overwrite the newer copy.
- Hide any "saved … ago" tag while saving is stopped. Bar: one row on a
  computer, stacked on a phone with a 44px Reload button, hidden in print.
- Known tiny gap, accepted: a second tab opened in the same few milliseconds
  as the first one's save can make the first show the bar. Not checkable
  here: Safari and real iPhones.
- Test with two pages in one Playwright browser context (they share
  storage); wait about half a second after the second loads.

## 15. Wording

John decides wording; these are his standing preferences, from Hindcaster
(2026-10-19 to 2026-10-22). Use judgement, and ask when in doubt.

- **"Less than" and "more than", not "under" and "over",** for amounts in
  ordinary sentences ("less than 1 mile"). Other senses stay ("the night
  isn't over", "just over the borders"), and so does a compact, more
  mathematical comparison like Clockmaker's "over, under or exactly on
  60:00".
- **Don't end a sentence with a preposition.** "We'll have to put up with
  it", not "It's something we'll have to put up with"; "There are no
  figures for these places for last year to compare", not "… to compare
  with".
- **Dates in running text:** month first, with an ordinal: "Friday October
  16th", "October 18th to 20th 2025". Existing places that do otherwise are
  left as they are unless John asks (Clockmaker's Summary "18 Oct").
- **Ranges:** "12 to 15°C", not a dash, so a range can't be read as a minus.
- **Temperatures:** "20°C", with no space before the degree sign, as the
  Met Office writes it (John, 23 October, after seeing "20 °C", the SI
  rule, mocked up). Other units keep their space: "3.5 mm", "16 mph".
- **Times:** each tool keeps one style. Clock times written for reading
  use a full stop between hours and minutes, the British way: "5.50am",
  "9.15pm"; on the hour "3pm", "midday", "midnight" (John, 23 October;
  Hindcaster changed from "5:50am"). New tools do the same. Clockmaker's
  24-hour "06:00" stays, as it suits broadcasting, and so do minutes and
  seconds ("29:30", "60:00") in Clockmaker and Backtimer, which are
  timings, not times of day.
- **Rounding** (any tool showing decimals): halves away from zero, so 4.55
  shows as 4.6 and −0.05 as −0.1, never "−0.0". Don't use JavaScript's
  `toFixed` or a plain `Math.round` for this; work in whole hundredths
  (Hindcaster's `src/lib/format.ts`).

## 16. Starting a new tool

How a new baish.net tool begins, from an idea worked out in a Claude chat
to the first agreed stage. Agreed with John on 2026-10-22; Hindcaster was
started this way.

**John, before the first thread:**

1. Create the repo on GitHub. Decide public or private first: the tools
   are public, but Hindcaster is private because it stores another
   organisation's raw data.
2. Put the handover from the Claude chat in the repo, under any name
   except `CLAUDE.md` (for example `idea_handover_from_claude_chat.md`).
   `CLAUDE.md` is special: Claude Code reads it at the start of every
   session as standing instructions, and in these projects it holds
   Claude's working notes and log.
3. Start a cloud thread on the new repo, on its `main` branch.
4. Paste the prompt below, with the tool's name and today's date.

**The prompt:**

> This is a new tool for baish.net, a sister to Clockmaker, Backtimer,
> Flowcharter and Hindcaster. My ideas are in the handover file in this
> repo. Please:
> 1. Add `JohnBaish/clockwheel` to this session (read only) and read its
>    `HOUSE-STYLE.md` and `SEO-HANDOVER.md`. Look at how
>    `JohnBaish/hindcaster` was started too, if it helps.
> 2. Move my handover to `design/handover-<date>.md` without changing its
>    words. Copy in `HOUSE-STYLE.md`, `SEO-HANDOVER.md` and
>    `.claude/skills/fresh-look/` from clockwheel, noting the commit.
> 3. Write `SPEC.md` (what the tool does, with numbered open questions at
>    the end), `PLAN.md` (stages, one branch each) and `CLAUDE.md`
>    (working notes and a dated log, with a reading list, and the project
>    tracker line from §10 in its key points).
> 4. Then ask me the open questions in a numbered batch. Don't build any
>    of the app until I've answered and agreed the first stage.

**Claude, in the first thread:**

5. Copy the files in §1 from clockwheel rather than writing them again,
   and note the commit in `CLAUDE.md` (clockwheel holds the master copy).
6. Check the handover's facts with code or the real sources before relying
   on them (§10, "Accuracy"); say what couldn't be checked.
7. Draft the spec and plan, ask the numbered questions, record John's
   answers beside them, and build nothing visible until he agrees.
8. Before building pages, show mock-ups at 1200px and 390px; before wiring
   in a favicon or preview image, show the options (§7).
9. Build dark mode in from the start (§2; John, 2026-10-29, so don't ask):
   the agreed dark colours and switch, following the device's setting, and
   mock-ups in both themes.
10. Add the tool to the project tracker (§10): a file in `projects/` and a
    line in `INDEX.md` in `JohnBaish/baish.net-directory`. If it was
    planned in a Claude chat and already has a starter file there,
    update that file rather than starting a new one.

**John's own jobs later, when each comes up:** the Vercel project, its
domain and Web Analytics (§9); any keys, as GitHub secrets, never pasted
into a chat; Search Console near the end (§12); and, last, the card on the
baish.net landing page, with the hub's title and description updated to
match (in this repo, with his OK).

**After the hub card, update the baish.net overview** (`design/overview/` in
this repo; its `README.md` has the steps): a written page and screenshots for
the new tool, and the shared pages brought up to date. It's for John to share
with Claude in other chats. Before that thread, John adds `baish.net` and its
subdomains to the environment's Allowed domains, so the screenshots can come
from the live sites (without them, Claude builds each site from `main` and
serves it locally, and the PDF says so).
