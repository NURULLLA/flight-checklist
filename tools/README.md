# AviaBit ↔ Flight Checklist integration

Two userscripts connect the Loadmaster Flight Summary to AviaBit
(`ab-web.aviastartu.ru`). You can install either or both — they do the same
job from opposite directions.

| Script | Where it runs | What it gives you |
|---|---|---|
| `aviabit-bridge.user.js` | the checklist app | **Flight History** button inside the checklist — pick a flight, form fills |
| `aviabit-export.user.js` | AviaBit flight card | **Export to Checklist** button on AviaBit — opens the checklist pre-filled |

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open the Tampermonkey dashboard → **Utilities** → **Import from file**, or
   click **+** to create a new script and paste the file contents in.
3. Save. Reload the checklist app (or the AviaBit page).
4. Stay logged in to `ab-web.aviastartu.ru` in the same browser — the scripts
   reuse that session and never ask for your password.

Tampermonkey may ask you to confirm the cross-domain request the first time
(`@connect ab-web.aviastartu.ru`). Allow it — that permission is what lets the
checklist read your flight list.

## What gets filled

| Checklist field | Source in AviaBit |
|---|---|
| A/C REG | `pln` |
| FLIGHT NO | `flight` |
| DATE | scheduled departure date |
| EMBARK / DISEMBARK | leg departure / arrival IATA |
| CREW 1, CREW 2 | crew list, in roster order |
| ED | STD — scheduled departure |
| AD | ATD — off-block, else actual airborne |
| EE | STA − STD (scheduled time enroute) |
| AT | ATA − ATD (actual time enroute) |
| AA | ATA — on-block, else actual landing |
| DELAY REASON | delay reason on the departure airport record |
| REMARKS (row 36) | stand number |

**EA** and **DELAY TIME** are not written — the app derives them from ED/EE and
AD−ED, exactly as it does for manual entry.

### What does *not* get filled

**Payload, fuel and loading compartment times.** These fields exist in the
AviaBit schema (`preFuelInfo`, `preLoadInfo`, `payLoad`) but are empty on every
flight checked, so there is nothing to import. Enter them by hand as before.

### Flights that have not operated yet

For a future flight, AviaBit fills its `*Calculation` timestamps with the
scheduled time. Neither script reads those fields, so AD / AT / AA stay **blank**
until real block times exist. A future flight therefore fills only ED and EE,
and shows no delay — which is correct, rather than a fabricated zero.

## Legs

The history list shows **one row per leg**, matching the AviaBit plan-flight
page. A flight like SGA-2562 flying HKG→DAC→BAH appears as two rows; pick the
leg you are working.

## Security notes

The bridge is deliberately narrow:

- **GET only** — it cannot modify anything in AviaBit.
- Only these endpoints are permitted: `plan-flight`, `flight-airports`,
  `flight-card`, `preliminary-crew-load`. Anything else is refused.
- It runs only on the checklist page and talks only to `ab-web.aviastartu.ru`.
- It never reads, stores or transmits your credentials — it relies on the
  session cookie the browser already holds.
