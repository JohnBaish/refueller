# AWS London test: step by step (for John)

**What this does:** runs the probe we already built, once, from an AWS address in London, to find out whether the Fuel
Finder service accepts it (the team have said UK cloud servers are fine) and to see the real data's shape for the first time.
It only runs when you press **Test**. It has no web address, no schedule and no way in from outside. It changes nothing.

**You will need:** about 45 minutes; a payment card; your phone (AWS texts or calls a code); and your two Fuel Finder values
(the client ID and secret) from wherever you saved them. **Type or paste them only into the AWS box named below, never into
this chat.** If any screen differs from what I describe, or asks for something I haven't mentioned, stop and tell me what it
says: AWS changes its screens often and I can't see them.

---

## Part 1: get the package (GitHub)

1. Open `https://github.com/JohnBaish/refueller/actions` and click **Build Lambda package** in the left list.
2. Click **Run workflow**, keep the branch as `main`, and click the green **Run workflow** button.
3. Wait for the green tick (about a minute). Click the run's name to open it.
4. Scroll to the bottom to **Artifacts** and click **refueller-probe-lambda** to download it.
5. The download is a zip containing another zip. **Unzip it once** (double-click it); you should then see a file called
   **refueller-probe.zip**. That inner file is what AWS wants. Don't unzip that one.

## Part 2: create the AWS account

**Use AWS's full ("advanced") sign-up, not the new quick one (found 27 October).** The quick sign-up, with a Google, GitHub,
Apple or Amazon login and a "project", puts every European account in **Stockholm** (eu-north-1) and doesn't let you choose
London; Fuel Finder would refuse a Swedish address. The full sign-up asks for an email, account name and password, and lets
you choose London afterwards in the console. John's first, Stockholm project is left alone for now (close it later).

6. Go to `https://portal.aws.amazon.com/billing/signup` (AWS's full sign-up).
7. Fill in your email, a password and an account name (for example "John Baish personal"). Choose the **Personal** account
   type if asked. Add your address, card and phone details when asked.
8. **If AWS offers a choice of plan** (a "Free plan" and a "Paid plan"), read the descriptions on screen. For this test I'd
   choose the **Free plan** if it says you can't be charged, but **tell me which options you see and what they say before you
   choose.** If it asks you to pick a support plan, choose **Basic support (free)**.
9. Sign in to the **AWS Management Console** when it's ready. If it suggests switching on **multi-factor authentication (MFA)**
   for your main account, do it: it protects the card on file.
10. At the top right of the console, click the region name and choose **Europe (London) eu-west-2**. **Check it says London
    before every step below.**

## Part 3: a safety net against unexpected charges

11. In the search box at the top, type **Budgets** and open **Billing and Cost Management > Budgets**.
12. Click **Create budget**. If you see a template called **Zero spend budget**, choose it; give it your email address and
    create it. This emails you if anything costs more than a few pence. **If you can't find it, skip this and tell me.**

## Part 4: create the function

13. Search for **Lambda** and open it. (Check the region still says London.)
14. Click **Create function**. Choose **Author from scratch**.
15. Function name: `refueller-probe`. Runtime: **Node.js 22.x**. Leave the architecture and permissions as they are, and click
    **Create function**.
16. In the **Code** tab, click **Upload from**, choose **.zip file**, click **Upload**, pick **refueller-probe.zip** (the inner
    one), then **Save**.
17. Still on the Code tab, scroll to **Runtime settings**: the **Handler** should read `index.handler`. If it doesn't, click
    **Edit**, type `index.handler`, and **Save**.

## Part 5: the settings (this is where the secrets go)

18. Open the **Configuration** tab, then **General configuration**, then **Edit**. Set **Memory** to `512` MB and **Timeout** to
    `5` min `0` sec. Click **Save**. (The default timeout of 3 seconds is far too short.)
19. In **Configuration**, open **Environment variables**, then **Edit**, then **Add environment variable**, twice:
    - Key `FUEL_FINDER_CLIENT_ID`, value: your client ID.
    - Key `FUEL_FINDER_CLIENT_SECRET`, value: your client secret.

    Leave "Enable helpers for encryption in transit" unticked. Click **Save**.
20. **Don't** add a function URL, an API gateway or any trigger. The function must only run when you press Test.

## Part 6: run it

21. Open the **Test** tab. Choose **Create new event**, name it `run`, leave the event JSON as `{}`, and click **Save**.
22. Click **Test**. It takes one to three minutes; **leave the page open**.
23. When it finishes you'll see **Execution result: succeeded** (or failed) with a **Response** box and a **Log output**. Even if
    the probe was refused by Fuel Finder, AWS will say "succeeded"; the answer is inside the Response.
24. **Copy the whole Response box** and paste it into the chat. It holds counts, shapes and the AWS region only, with no
    credentials, but glance through it first. If it's very long, copy the Log output instead, or both.

## If something goes wrong

- **"Task timed out after 3.00 seconds":** the timeout in step 18 wasn't saved. Redo it.
- **"Cannot find module" or "Runtime.ImportModuleError":** you uploaded the outer zip. Upload the inner `refueller-probe.zip`
  (step 5), or tell me.
- **Response says the two environment variables are not both set:** recheck the two names in step 19 (capital letters,
  underscores).
- **The Response shows `ok: false` and a refusal (403):** that's a real answer, not a mistake. Paste it to me.
- **Anything about charges, a card or an unexpected plan:** stop and tell me before clicking anything.

## Afterwards

Nothing runs by itself, so it costs nothing while idle. Leave it as it is until we know the result. To remove it later: Lambda,
select `refueller-probe`, **Actions**, **Delete**.
