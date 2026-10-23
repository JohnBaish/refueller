# Search (SEO) handover for baish.net tools

What was done for search on Clockmaker, Backtimer and the baish.net hub in
October 2026, why, and a step-by-step checklist for doing the same on a new
tool: **Flowcharter** now, **Hindcaster** when it's finished, and anything
after that. Written 2026-10-17 from what is live in `JohnBaish/clockwheel`.
If this file and the code disagree, the code is right.

**Flowcharter** followed the checklist on 2026-10-18 (its own repo,
`JohnBaish/flowcharter`; details in its `CLAUDE.md`): its row is in the
table below. Its visible text is a "What's a flowchart?" card in the Guide.

**Hindcaster** followed it on 2026-10-20 (its own repo, `JohnBaish/hindcaster`;
details in its `CLAUDE.md`): its row is in the table below. John chose a
description that opens with a question rather than "Free …", and a title without
"free" (it read like a verb there). Its visible text is one paragraph below the
choosers on its first screen, the only screen Google sees (its views are
addressed after "#"). The hub's title became general ("free browser tools") so
it needn't change with each new kind of tool.

Read `HOUSE-STYLE.md` first for everything else (look, phones, privacy,
hosting, how John likes to work). This file only covers search.

---

## 1. What was done, and why

The starting point: every page's `<title>` was just the tool's name, the
pages were empty shells filled in by JavaScript, nothing told Google which
address was the main one, there was no robots.txt or sitemap, and neither
tool linked back to the hub. Done in three steps.

### Step 1: invisible changes (in the page code, not on screen)

| What | Clockmaker | Backtimer | Flowcharter | Hindcaster | Hub |
|---|---|---|---|---|---|
| `<title>` | Clockmaker – free radio hot clock & format clock maker | Backtimer – free backtiming calculator for radio and TV | Flowcharter – free flowchart maker from a simple list | Hindcaster – yesterday's weather in England | baish.net – free browser tools by John Baish |
| `<meta name="description">` | Free hot clock maker for radio. Build a format clock for each hour, see it as a circle or a list, plan your week and print it. Works in your browser. | Free backtiming calculator for radio and TV. Enter your out-time and items, and see exactly when each one needs to start to hit the news on time. | Free flowchart maker. Type your steps as a list, or answer simple questions step by step, and Flowcharter draws the chart. Print it or copy it as an image. | What was the weather yesterday? Free figures for anywhere in England by postcode or county: highs, overnight lows, wind and rainfall, compared with a year ago. | Free browser tools by John Baish: Clockmaker for radio clocks, Backtimer for backtiming, Flowcharter for flowcharts and Hindcaster for yesterday's weather. |
| `<link rel="canonical">` | https://clockmaker.baish.net/ | https://backtimer.baish.net/ | https://flowcharter.baish.net/ | https://hindcaster.baish.net/ | https://www.baish.net/ |

Why each part:
- **Title and search description** are what Google shows in its results.
  They name the tool and say, in the words people actually search for,
  what it does and that it's free.
- **The search description is separate from the link-preview description.**
  Only `<meta name="description">` changed. `og:description` and
  `twitter:description` (what WhatsApp etc. show) kept their shorter
  wording, because that wording is also drawn into the preview picture.
- **Canonical tag:** tells Google which address is the real one. It
  stops clockwheel.baish.net (Clockmaker's old name, still working)
  counting as a duplicate of Clockmaker.
- **www.baish.net is the hub's main address**, because typing baish.net
  ends up there (Vercel redirects it). Every link to the hub uses
  `https://www.baish.net/`.
- **robots.txt and sitemap.xml** for each site. robots.txt says "anything
  may be crawled" and where the sitemap is; the sitemap lists the site's
  one main address. In this repo they come from `middleware.ts`, because
  several domains share one build and one `public/` folder (see §3 for
  why a separate project doesn't need this).
- **Tab title fix:** standalone Backtimer's app code used to reset the tab
  title to plain "Backtimer" after loading (`Nav.tsx`). It now sets the
  same title as the page file. **If an app sets `document.title`, it must
  match the `<title>`.**

### Step 2: visible text (on screen, John's wording)

Google reads text people can see. The tools had very little, so each got a
short explanation, kept deliberately small:
- **Clockmaker:** a new last-but-one section in the Guide, "Format clocks,
  hot clocks and broadcast clocks", explaining the terms people search
  for in different countries ("hot clock" is American, also used in
  Spanish-language radio; the UK says "format clock" or "the clock").
  A first-time visitor lands on the Guide, and Google's crawler is always
  a first-time visitor, so the Guide is what Google sees.
- **Backtimer (backtimer.baish.net only):** between the list and the
  footer, a heading "A free backtiming calculator for radio and TV" and
  two folded parts that open on click: "What is backtiming?" and "How do I
  use Backtimer?" (three numbered steps). Built with plain HTML
  `<details>`/`<summary>`; Google reads folded text too. Styles:
  `.backtimer-about` in `src/styles/global.css`.
- **Link back to the hub:** "More free tools at www.baish.net." (the
  domain linked to `https://www.baish.net/`, opening in a new tab), just
  before "Contact:" in Backtimer's footer and in the Guide's "About
  Clockmaker".
- **The hub got no new text.** Its cards already describe each tool.

Position on the page doesn't need to be high up: Google indexes the whole
page, and on a page this short any effect of position is negligible (not
confirmed either way by Google). Put the text where it reads best.

### Step 3: Google Search Console (John, done 2026-10-17)

- **One "Domain" property for baish.net**, verified with a DNS TXT record.
  A Domain property covers every subdomain, so **a new tool at
  `something.baish.net` needs no new verification or DNS record.**
- Sitemaps submitted: clockmaker, backtimer and www.baish.net.
- For each main address: URL Inspection → **Test live URL** (should say
  "URL is available to Google") → **View tested page** (check the new text
  is there) → **Request indexing**. "URL is not on Google" before that is
  normal for a page Google hasn't crawled yet.

### Deliberately not done

- **No FAQ section.** Google stopped showing FAQ dropdowns in results for
  most sites in 2023, so it would only add words to the page.
- **No structured data** (schema.org markup). Skipped for now; could be
  revisited.
- **No extra pages written just for search**, and no keyword-stuffing.
  Short, honest text only.

---

## 2. Checklist for a new tool (Flowcharter, Hindcaster, …)

Check what the project already has before changing anything; Flowcharter
was built before this work, so some of it may be missing or different.
Do the code parts on a branch; John merges.

**Wording first (John decides, Claude drafts):**
1. A `<title>` in the pattern **"Name – free <what it is> for <who>"**
   (en dash, as above). Google may shorten or rewrite long titles; around
   60 characters is a common rule of thumb.
2. A search description starting **"Free …"**: what it does, for whom,
   in the words people search for. Roughly 150–160 characters at most
   (Google cuts it off by width, not a fixed count, and sometimes writes
   its own).
3. A short visible explanation (see step 9).

**Page code (the tool's HTML file, `index.html` in a one-page Vite app):**

4. Put in the new `<title>` and `<meta name="description">`. Leave
   `og:description` / `twitter:description` as the link-preview wording.
5. Add `<link rel="canonical" href="https://<tool>.baish.net/" />`
   (full address, ending in `/`).
6. If the app's code sets `document.title` anywhere, make it match the
   `<title>` exactly (search the code for `document.title`).
7. Add a short comment in the HTML saying the title/description are for
   search and the og: tags are for link previews, like Clockmaker's.

**robots.txt and sitemap.xml:**

8. If the project serves **only its own domain** (its own repo and Vercel
   project, which is the plan for Flowcharter and Hindcaster), just add two
   plain files to `public/`; Vite copies them to the site root:

   `public/robots.txt`
   ```
   User-agent: *
   Allow: /

   Sitemap: https://<tool>.baish.net/sitemap.xml
   ```
   `public/sitemap.xml`
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url><loc>https://<tool>.baish.net/</loc></url>
   </urlset>
   ```
   Only if one project serves several domains (like this repo) are
   per-host files needed; then copy the `MAIN_ADDRESS` approach in this
   repo's `middleware.ts`.

**Visible text:**

9. A short explanation people would find useful: what the tool is, the
   terms people search for (including other countries' words for the same
   thing), and how to use it in a few steps. Put it where a **first-time
   visitor** sees it without doing anything (Google always arrives with
   nothing saved), e.g. a Guide screen or a section below the main tool
   with folded parts. Folded `<details>` is fine. No FAQ.
10. "More free tools at www.baish.net." with the domain linked to
    `https://www.baish.net/` (new tab, `rel="noopener noreferrer"`), just
    before "Contact: workshop@baish.net." wherever the tool shows that.

**The hub (in this repo, `JohnBaish/clockwheel`, not the tool's):**

11. Add a card for the tool to `landing.html` (alphabetical among the
    tools, before John's Blog). *Flowcharter: already done. Hindcaster:
    done 2026-10-20.*
12. **John's standing reminder: when a tool is added or changed, update the
    hub's `<title>` and search description to match.** Since 2026-10-20 the
    title is general ("free browser tools"), so usually only the description
    needs the new tool added. *Flowcharter and Hindcaster: named.*

**Check before merging** (Playwright, 1200px and 390px with touch):

13. Tab title, description, canonical and link-preview tags correct in the
    built page, including after the app has started (catches a
    `document.title` reset).
14. The visible text appears for a fresh visitor, folded parts open on
    click/tap, nothing runs off the side on a phone, the link works.
15. `/robots.txt` and `/sitemap.xml` load from `vite preview` (for plain
    `public/` files; per-host middleware can only be checked live).

**After merging (live site):**

16. Open `https://<tool>.baish.net/robots.txt` and `/sitemap.xml` and
    check they show the right text, not the app.
17. John, in Search Console (the existing baish.net property): Sitemaps →
    add `https://<tool>.baish.net/sitemap.xml`. Then URL Inspection on
    `https://<tool>.baish.net/` → Test live URL → View tested page (look
    for the new text) → Request indexing. Expect a few days, not
    guaranteed.
18. Log it all in the project's `CLAUDE.md`, and add the tool's row to the
    table in §1 of this file (in this repo) so it stays a full record.

---

## 3. Notes for whoever picks this up

- **Why middleware here but plain files elsewhere:** this repo's one build
  serves clockmaker, backtimer, baish.net and the old clockwheel address,
  all sharing one `public/` folder, so a static robots.txt would be
  identical on every domain and name the wrong sitemap on most of them.
  A project with one domain has no such problem.
- **Preview addresses** (`*-git-<branch>-john-baish.vercel.app`) aren't
  listed in any sitemap, and the canonical tag points at the live address,
  so they don't compete with it.
- **Live checks can't be done from Claude's sandbox** (it can't reach the
  live sites), so John opens the addresses and reports back.
- **Things only John can do:** Search Console, DNS, Vercel domains.
