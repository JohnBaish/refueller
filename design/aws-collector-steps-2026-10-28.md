# The collector on AWS: step by step (for John)

**What this does:** sets up the collector, a second function next to `refueller-probe` in your AWS account (London). Twice a
day, at 10.15am and 4.15pm UK time, it fetches every station and price from Fuel Finder, keeps what the page needs, and saves
it into the `JohnBaish/refueller` repo on GitHub. Nothing on the website changes yet: the page comes in a later stage.

**What it needs:** the two Fuel Finder values you used for the probe, and a new **GitHub key** so it can save files into the
repo. Like the Fuel Finder values, the key is typed only into AWS, never into a chat.

These steps are written from general knowledge of the AWS and GitHub screens, which change. If a screen doesn't match, stop
and tell me what you see.

## Part 1: get the package

1. On GitHub, open the repo's **Actions** tab, choose **Build Lambda packages** on the left, then **Run workflow** (branch
   `main`), then the green **Run workflow** button.
2. When it finishes (green tick, about a minute), open the run and scroll to **Artifacts**. Download
   **refueller-collector-lambda**.
3. In Downloads, right-click it and choose **Extract all**, then **Extract**. In the folder that opens is **refueller-collector**
   (a "Compressed (zipped) Folder"). That's the file to upload. Don't extract that one.

## Part 2: the GitHub key

4. On GitHub, click your picture (top right), then **Settings**, then **Developer settings** (bottom of the left-hand list),
   then **Personal access tokens**, then **Fine-grained tokens**, then **Generate new token**.
5. Fill in:
   - **Token name:** `refueller-collector`
   - **Expiration:** a custom date one year from today (GitHub may limit how far ahead you can choose; pick the furthest
     it allows). **Write the date down and tell me it** (the date only), so I can note when it needs renewing.
   - **Repository access:** **Only select repositories**, then choose **JohnBaish/refueller** only.
   - **Permissions:** under **Repository permissions**, set **Contents** to **Read and write**. Leave everything else as
     it is (GitHub adds "Metadata: Read-only" by itself, which is fine).
6. Click **Generate token**. GitHub shows the key **once**. Copy it, and keep the page open until Part 3 step 12 is done.
   Don't paste it anywhere except AWS.

## Part 3: the function

7. In the AWS console, check the region at the top right says **Europe (London)**.
8. Open **Lambda**, then **Create function**, **Author from scratch**. Function name `refueller-collector`. Runtime
   **Node.js 24.x**. Leave the rest, and click **Create function**.
9. Under **Code source**, click **Update**, then the zip upload option, then **Upload**, pick **refueller-collector** (from the
   folder you extracted), and **Save**. The editor should then show `index.mjs` starting with a comment line, not the
   "Hello from Lambda" sample.
10. Open the **Configuration** tab, then **General configuration**, then **Edit**: **Memory** `512` MB, **Timeout** `5` min
    `0` sec. **Save**.
11. In **Configuration**, open **Environment variables**, then **Edit**, then **Add environment variable**, three times:
    - Key `FUEL_FINDER_CLIENT_ID`, value: your Fuel Finder client ID.
    - Key `FUEL_FINDER_CLIENT_SECRET`, value: your Fuel Finder client secret.
    - Key `REFUELLER_GITHUB_TOKEN`, value: the GitHub key from step 6.

    Leave "Enable helpers for encryption in transit" unticked. Click **Save**.
12. You can now close the GitHub page with the key on it.

## Part 4: one test run

13. Open the **Test** tab, **Create new event**, name it `run`, leave the event JSON as `{}`, **Save**, then **Test**. It takes
    about a minute.
14. Copy the **Response** box and paste it into the chat. It holds counts only. It should begin `"ok": true` and end with a
    `"commit"`. On GitHub, the repo's front page should show a new commit "Data: … UTC" with a `data` folder.

If it says `"ok": false`, paste it anyway: it says what went wrong, and nothing in the repo has been damaged (a failed run
only adds one line to the run log).

## Part 5: the timetable (only after the test run looks right)

15. In the console's search box type **EventBridge** and open **Amazon EventBridge**, then **Scheduler**, then
    **Schedules** in the left-hand list (check it still says London), then **Create schedule**.
16. **Schedule name** `refueller-twice-daily`. Under **Schedule pattern** choose **Recurring schedule**, then
    **Cron-based schedule**, and fill the boxes:
    - Minutes `15` · Hours `10,16` · Day of month `*` · Month `*` · Day of the week `?` · Year `*`
17. **Flexible time window:** **Off**. **Time zone:** **Europe/London** (so the clock changes look after themselves). Leave
    the start and end dates empty. **Next**.
18. **Target:** **AWS Lambda** ("Invoke"), then choose the function **refueller-collector**. Leave the payload as it is, or
    `{}`. **Next**.
19. On the settings page leave the defaults, including **Create new role for this schedule**. **Next**, check the summary
    says 10:15 and 16:15 Europe/London, then **Create schedule**.
20. Tell me when it's done. I'll check the repo after the next run.

## Afterwards

- **Cost:** about 60 short runs a month, far inside AWS's free allowances; the zero-spend budget emails you if anything ever
  costs money.
- **To pause it:** EventBridge, Scheduler, the schedule, **Disable**. Nothing else needs changing.
- **The GitHub key expires** on the date you chose; I'll note it and remind you before then. When renewed, only step 11's
  third value changes.
- `refueller-probe` can stay as it is: it only runs when you press Test, and it's useful if Fuel Finder ever changes.
