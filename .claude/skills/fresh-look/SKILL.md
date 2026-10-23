---
name: fresh-look
description: A full, careful review of one of John Baish's baish.net tools (Clockmaker, Backtimer, Flowcharter, or a new one) as it really behaves on computers and phones — functional snags, usability, and recommended changes — delivered as a numbered report (in chat and as a phone-friendly PDF), changing nothing. Use when John types /fresh-look, or asks for a "fresh look", a full review, a snag hunt, or a review of the whole project. Anything typed after the command narrows the focus (e.g. "/fresh-look phones only", "/fresh-look the List screen").
---

# Fresh look

A long, careful review of the whole project as people actually use it, on a
computer and on a phone. It ends in a structured report for John. It is part of
the baish.net house style (`HOUSE-STYLE.md` §11). The master copy is in
`JohnBaish/clockwheel`.

**The one rule: change nothing.** No code, no branches, no commits, no file
edits in the repo. Throwaway test scripts and screenshots go in the session's
scratchpad. If a fix is tempting, it goes in the report as a recommendation.
John decides what's built, and it's then built the usual way (branch, preview,
his say-so).

If John typed something after the command, review only that area, but still
follow every step that applies.

Take your time. Accuracy matters more than speed. Report nothing you haven't
confirmed, or clearly mark it as unconfirmed.

## 1. Get ready

1. Read the project's `CLAUDE.md` (the layout notes and the log, especially
   recent entries and anything "left alone deliberately"), then `SPEC.md`,
   `PLAN.md` and `HOUSE-STYLE.md` if they exist. This shows what was agreed, so
   agreed behaviour isn't reported as a fault.
2. Make sure you're reviewing what's live. Check the working tree is clean, you're on
   `main`, and `main` is up to date with `origin/main`. Say which commit you
   reviewed.
3. Run the project's own checks (`npm run build`, `npm run lint`, and
   `npm run check` if it exists) and note anything new beyond known warnings.
4. Serve the built app (`npx vite preview --port <free port> --strictPort`) and
   use Playwright with Chromium (`executablePath: '/opt/pw-browsers/chromium'`).
   List every way in. Clockmaker, for example, has `index.html`,
   `?host=backtimer` / `backtimer.html` and `landing.html`.

## 2. Use it like a real person, at both sizes

Do every pass twice: at **1200×860**, and at **390×844 with
`hasTouch`, `isMobile`, `deviceScaleFactor: 2`**. Use `tap()` on the phone.

1. **First visit**, with empty storage: what a newcomer sees and what they'd
   try first.
2. **Every screen and every button**, with realistic content: the project's
   test or example data (e.g. Flowcharter's `design/test-charts.json`) loaded
   into localStorage.
3. **Stress content**: empty, one item, very many items, very long names and
   words, accented letters, the largest or deepest example. Where the tool
   shows data, use every real state the data can be in (Hindcaster's early
   and final updates, older saved formats, a source that's missing), not
   only today's: Hindcaster's worst fault showed only with real early-morning
   data. Where the tool writes sentences, check all of them across real data
   (every county, every day available), not a sample.
4. **The paths people wander down.** Abandon something halfway. Press Back, or
   change your mind. Delete things. Reload mid-task. Import a wrong or damaged
   file. Use the empty states. Use the keyboard only. Use the phone's own
   back gesture. Print, and copy an image.
5. **An automatic sweep on each screen.** Look for page errors and console
   errors (ignore Vercel's `/_vercel/insights` 404 locally), sideways page
   scrolling (`scrollWidth > innerWidth`), phone tap targets under 44px, and
   phone input boxes under 16px text.
6. **Look at the screenshots yourself.** Numbers miss things like cramped
   layouts, buttons in an odd order, a main button hidden at the bottom, or
   headers taking half a phone screen.

## 3. Read the code for suspects, then prove each one

1. Read the screens and the rules (state store, list/chart/clock logic) and
   write down **suspects**: cases the code doesn't seem to handle, such as dead
   ends, empty lists, leftovers after a change, or things that only show on hover.
2. Write a small, targeted Playwright probe for each suspect and **confirm or
   drop it**. Keep the exact steps that reproduce it. Measure where you can,
   for example "the chart is 382px wide in a 355px frame".
3. Before calling something a fault, check it isn't an agreed decision (step
   1.1). If it is, it can still be a usability suggestion, worded as one.

## 4. Sort what you found

For each finding decide:

- **Kind:** a *snag* (it misbehaves), *usability* (it works, but could be
  easier), or *leave alone* (looked at, fine, or not worth the change).
- **Size:** *small*, *medium* or *larger*, from how much would have to change.
- **Priority:** *worth doing*, *optional*, or *leave*.
- **Recommendation:** what to change and roughly how, in plain words. Where
  it's a real choice, give options (a) and (b) and say which you'd pick.

## 5. The report

Write in plain English for John, who is not a developer. Use British spelling
and no code jargon. Name files only where it helps a later thread. Use numbered
sections and numbered sub-sections, in this order.

**Number everything, never bullets, for anything John might want to discuss.**
Every point in every section gets its own number (2.1, 2.2 … 7.1, 7.2 …),
including "would leave alone" and "couldn't check", so he can reply briefly by
number ("7.2: let's talk about this"). Bullets are fine only inside a single
numbered item, e.g. its options (a) and (b).

1. **Overall verdict.** A few lines: what's in good shape, how many genuine
   faults there are, and that **nothing was changed**. State what was reviewed
   (commit, sizes, data used).
2. **One section per area** (e.g. each screen, then "across the whole site"),
   with genuine faults before usability points. For each item:
   - a heading with **size · priority**,
   - **What happens:** steps and what you see,
   - **Recommendation:** with options if it's a decision.
3. **Looked at and would leave alone.** Each point numbered (e.g. 7.1, 7.2),
   with a reason each, so nobody raises them again by accident.
4. **What I couldn't check.** Each point numbered (e.g. 8.1, 8.2): a real
   iPhone or Safari, a real printer, slow phones, the live domain, and so on.
5. **Suggested order, if you'd like to go ahead.** John likes this
   section. It's a numbered list of next steps that places **every**
   numbered item from the area sections in one of these groups:
   - **Quick fixes, in one branch:** the small, low-risk *worth doing* items.
     Promise before-and-after screenshots.
   - **Decide on …:** each item with options (a)/(b), naming the options.
   - **Optional, separately:** the bigger optional items, each previewed
     first.
   - **Optional extras that could go into the quick-fix branch:** tiny
     *optional* items.
   - **Left alone for now:** *leave* items, with a word on when to revisit
     ("unless you notice lag"), and the "would leave alone" items by number
     (e.g. 7.1–7.4).

   Leave out any group that would be empty. Finish with a **coverage line**:
   "Every item in sections 2–N now appears in this list: 2.1–2.5, 3.1–3.2, …,
   7.1–7.4." (the area sections and the "would leave alone" section).

   **Coverage check (required before sending).** List every numbered item
   in the area sections and the "would leave alone" section, then tick each
   one off against the
   Suggested order. Every item must appear exactly once. If any is missing
   or appears twice, fix the list before sending; don't leave it for John to
   spot. (The first Flowcharter report missed three items. That is why this
   rule exists.)

End by asking which items John would like built. Use the section numbers so
he can reply briefly ("2.3 option a, 5.2 not now"). Don't start building until
he says.

## 6. The PDF

John often reads on his phone and switches between the report and Claude, so
always send the report as a PDF too, in the same words as the chat version
and including everything up to and including Suggested order.

1. Copy `report-template.html` (next to this file) to the scratchpad and fill
   it in. Keep its styles: A5 pages, Caprasimo headings, Figtree text, the
   cream "Nothing has been changed" box at the top, and size · priority in
   terracotta after each item heading. Each item goes in a
   `<div class="item">` so it doesn't split across pages.
2. In a scratchpad folder with Playwright installed (`npm i playwright`; never
   `playwright install`), copy in `make-pdf.mjs` from next to this file. It
   must sit beside that folder's `node_modules`, or Node can't find
   Playwright. Then run
   `node make-pdf.mjs report.html <Project>-fresh-look-YYYY-MM-DD.pdf <repo>`.
   It stops if the brand fonts didn't load. (Run `npm ci` in the repo first
   if `node_modules` is missing.)
3. Check it before sending. Turn the first and last pages into pictures
   (`pdftoppm -r 50 -png`) and look at them: fonts, nothing cut off, page
   numbers, the coverage line present.
4. Send it with SendUserFile (`display: 'attach'`) with a one-line caption
   saying what it is and how many pages. Keep the PDF in the scratchpad, not
   the repo.
5. If the report changes afterwards, rebuild the PDF from the same HTML, keep
   the same file name, resend it, and say which pages changed.

## 7. Afterwards

Once John has replied, add a short dated entry to the project's `CLAUDE.md`
log. Include the review's commit, the numbered findings in one line each, and
his decision on each, so a later thread knows what was reviewed and decided.
This is a notes-only change, made when John agrees, the same as any other.
