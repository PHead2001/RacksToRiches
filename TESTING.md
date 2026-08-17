# Testing Racks to Riches

This guide is written for players and testers. You do not need to know the game
code, but you do need Node.js 22.16 or newer and npm 11.4.2 or newer.

## Install and launch

Open PowerShell in the repository folder and run:

```powershell
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`.
Do not double-click or directly open `index.html`. The app uses TypeScript,
React modules, and Vite build-time flags that a raw file open cannot process.

For a release-like browser build:

```powershell
npm run build
npm run preview
```

For the explicit QA build with F10 tools:

```powershell
npm run build:qa
npm run preview -- --port 4174 --outDir dist-qa
```

## Complete quality gate

Run the same authoritative gate used by CI:

```powershell
npm run check
```

It checks formatting, strict linting, TypeScript, coverage, dead code,
architecture boundaries, release and QA builds, and browser end-to-end flows.
Run the separate high-severity dependency check with:

```powershell
npm run audit:high
```

## Playwright setup

The first browser-test run needs the pinned Chromium binary:

```powershell
npx playwright install chromium
npm run test:e2e
```

Use `npm run test:e2e:ui` to inspect or replay tests interactively.

## Saves, backups, import, and export

The browser owns five independent local save bays. A safe write validates a
temporary record, keeps the previous valid current record as the slot backup,
promotes the temporary record, verifies it, and only then reports success.
Closing or hiding the page requests a save, as does returning to the menu.

From **Load Game**, use **Export** to download a slot as JSON. Use **Import** on
the destination slot and select that JSON file. An occupied destination asks
for confirmation. Malformed or unsupported imports show an error and do not
replace the current slot. If current data becomes invalid while its backup is
valid, the slot is marked **recoverable** and offers **Restore backup**. Invalid
records are preserved for diagnostics until you explicitly delete that slot.
Version-one saves migrate through version two to save version three without
changing cash. Version-two active tutorials preserve completion and consumed
SLA-buffer percentages while moving to the 30-second tutorial. Starter
equipment infers a $0 acquisition price; other old equipment infers its Phase 2
definition price. Legacy 10- or 30-second autosave options migrate to one minute, and
the legacy 60-second option remains one minute.

Autosave choices are 1, 5, 10, 15, and 30 minutes; new installs default to five
minutes. Success and information notices disappear after five seconds; warning
and error toasts disappear after eight seconds while diagnostics retain errors.

## QA panel

Run the development server or QA build, enter a game, and press **F10**. The QA
control deck can be dragged by its yellow handle, resized from its corner,
minimized, reset, and used entirely with the keyboard. Each command creates one
undo snapshot and validates its output. Saving after a command marks the slot as
modified by QA tools. Press F10 again to close it.

The F10 panel is intentionally absent from a normal `npm run build` release.

## Manual test checklist

1. Start with empty browser storage and confirm Continue is disabled.
2. Change options, refresh, and confirm they remain changed.
3. Create a company in Slot 1 and confirm the bedroom shows $0, an empty 12U
   rack, four inventory items, and Gravy's Garden Blog.
4. Use Tab, Enter, and Space to select rack units and install every starter item.
   Confirm the tutorial cannot be accepted before its requirements are ready.
5. Drag an inventory item onto the rack, grab an installed rack face to move it,
   use Enter or Space on that rack face for keyboard movement, press Escape to
   cancel a drag, and drop installed equipment on the inventory return zone.
   Confirm IDs, position, and power state remain correct.
6. Confirm the tutorial shows 30 seconds and a five-second duration-derived SLA
   buffer. Accept it and confirm cash, gross income, net income, fulfillment,
   actual revenue, and time remaining change.
7. Confirm electricity remains waived during the tutorial. Complete it in the
   QA build and confirm the store, three market offers, and normal electricity
   expense unlock.
8. Consume part of the SLA buffer, restore healthy service, and confirm the
   remaining buffer recovers at the displayed rate.
9. Trigger tutorial failure in QA, save, refresh, and Continue. Confirm the
   tutorial game-over screen returns and its delete/start-over action identifies
   the affected slot.
10. Test debt at -$9,999.99 and confirm play continues with a warning. Test
    exactly -$10,000 and below and confirm the bankruptcy screen persists.
11. Buy an affordable item, confirm its resale is exactly half the paid price,
    sell it from inventory, and confirm cash and inventory change atomically.
    Confirm starter items are sale-locked before tutorial completion.
12. Pause, save, return to the menu, refresh, and Continue. Confirm rack progress
    returns.
13. Create a second slot, delete only that slot, and confirm Slot 1 remains.
14. Export a valid slot, import it elsewhere, and then try malformed JSON. Confirm
    the malformed file does not replace the existing company.
15. Preview compact and large interface scale, leave without saving to confirm
    reversion, then save and refresh to confirm persistence.
16. With 30 inventory items and a full 12U rack, confirm Inventory and Installed
    Controls scroll independently and do not move the outer page during drag.
17. Accept one marketplace contract and confirm another offer immediately uses
    residual capacity, reports exact shortages, and cannot overcommit the pool.
18. At 390x844, confirm the save manager, options, and separate Contracts count
    badge work without horizontal scrolling. Rack editing may remain desktop-oriented.
19. At 1280x720, 1440x900, and 1920x1080, inspect the menu, facility, contracts,
    store, pause menu, error fallback, and QA panel for clipping and overlap.

## Known Phase 2 limits

- Progress advances only while the game is open; offline earnings begin later.
- Research points can be displayed and manipulated for QA, but research gameplay
  is not implemented yet.
- Only the bedroom, starter marketplace, and Phase 1-compatible hardware are
  playable.
- There is no scrapping, negotiation, auto-renewal, customer growth,
  cloud save, backend, desktop packaging, audio, telemetry, or final artwork.
