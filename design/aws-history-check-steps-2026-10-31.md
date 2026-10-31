# Does Fuel Finder hold earlier prices? A one-off check from AWS (for John, 31 October 2026)

**What this does:** uses the test function you already have, `refueller-probe`, to ask Fuel Finder for every price that
changed in the last 14 days and compare that with the current prices. If a station turns up more than once, or with a
price different from today's, the system holds earlier prices and the 14-day graph could start with real history.
It only reports **counts and dates**: no station names, codes or prices, and nothing secret. It changes nothing, saves
nothing and runs only when you press Test. The collector and its timetable are not touched.

**You will need:** about 15 minutes. Your Fuel Finder values are already stored in the function, so you won't need them.

## Part 1: get the new package (GitHub)

1. Open `https://github.com/JohnBaish/refueller/actions` and click **Build Lambda packages** on the left.
2. Click **Run workflow**. In the box that opens, change **Branch: main** to **probe-price-history** (this check isn't on
   `main`), then click the green **Run workflow** button.
3. Wait for the green tick (about a minute) and click the run's name. Scroll to **Artifacts** and click
   **refueller-probe-lambda** (not the collector one) to download it.
4. Safari unzips downloads by itself, so in Downloads you will probably find a file called **index.mjs** (about 30 KB),
   perhaps inside a folder. Right-click **index.mjs** and choose **Compress "index.mjs"**. That makes **index.mjs.zip**:
   that's the file to upload. (If instead you see **refueller-probe.zip**, use that one as it is.)

## Part 2: upload it to the test function (AWS)

5. Sign in to the AWS console and check the region at the top right says **Europe (London)**.
6. Search for **Lambda**, open it, and click **refueller-probe** (not refueller-collector).
7. On the **Code** tab, under **Code source**, click **Update** (or **Upload from**), choose the .zip option, click **Upload**,
   pick the zip from step 4, then **Save**.

## Part 3: run the check

8. Open the **Test** tab. Choose **Create new event** and name it `history`.
9. In the **Event JSON** box, replace everything with exactly this, then click **Save**:

   ```
   {"history": true}
   ```

10. Make sure `history` is the event selected, and click **Test**. It takes one to three minutes; leave the page open.
11. When it finishes, copy the whole **Response** box and paste it into the chat. Glance through it first: it should hold
    counts and dates only.

## Afterwards

- Nothing needs undoing. The old `run` event still runs the usual probe (`{}`), and the new code does the same for it.
- If it says "Task timed out", tell me: the check may need splitting in two.
