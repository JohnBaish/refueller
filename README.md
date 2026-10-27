# Refueller

**Find the cheapest fuel near you at a glance** (draft tagline). Enter a
postcode and see the eight nearest open petrol stations with their unleaded and
diesel prices, from the government's Fuel Finder scheme. A free-to-use personal
project by John Baish, intended for `refueller.baish.net`.

- `SPEC.md` is what it does, `PLAN.md` is the staged build, `CLAUDE.md` is the
  working notes and dated log, and `HOUSE-STYLE.md` is the look shared with
  Clockmaker, Backtimer, Flowcharter and Hindcaster.
- `design/handover-2026-10-22.md` is the original planning handover.

**Stage 1 (the probe) is on the branch `stage-1-probe`; there is no page yet.**

- `npm run check` tries the probe's rules, and runs the whole probe against a fake Fuel Finder server on this machine.
- `.github/workflows/probe.yml` ("Probe Fuel Finder", Run workflow only) reads the real API using the two GitHub secrets and prints counts and shapes only.
- `.github/workflows/lambda-package.yml` ("Build Lambda package", Run workflow only) builds the same probe as one small file for AWS Lambda in London (`lambda/`, `scripts/build-lambda.mjs`); the steps for John are in `design/aws-test-steps-2026-10-27.md`.
- `npm run lint`, `npm run typecheck`.
