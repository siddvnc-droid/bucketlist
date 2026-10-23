# Our Bucket List

A shared bucket list for two people, styled like a passport.

- **Next up**: your soonest planned activity is shown as a travel document, with the date, a countdown and a "Before we go" checklist. If nothing is planned, "Pick one for us" suggests a random activity (from the selected category, if you've filtered by one).
- **Add activities**: type in the add box (press <kbd>N</kbd> from anywhere) and choose a category. Paste a list with one activity per line to add them all at once. Every new activity sets off a short snowfall, for whoever has the page open (it's skipped for people who turn on reduced motion on their device).
- **Tick things off**: tap the circle on any row. It animates, moves to your Stamps page, and the message at the bottom lets you undo.
- **Stamps**: every completed activity becomes an ink stamp in its category's color, with the date and the line you wrote to remember it by.
- **Reschedule or undo**: on the Next up card, "Reschedule" opens the date and "Cancel plan" moves the activity back to To do (its plan notes and checklist are kept). Each stamp has an undo button to remove it if you ticked something off by mistake; the activity goes back to Planned if it had a date, otherwise To do. The same "Cancel plan" and "Remove stamp" buttons are at the bottom of every activity's details, and each one can be undone from the message that appears.
- **Details**: tap any activity to open its details. Change its status (Someday, Planned or Done), name, category, date, plan, notes, memory and checklist. Changes save on their own.
- **Planning checklist**: planned activities have steps you can tick off or claim with "I'll do it", plus quick-add suggestions.
- **Categories**: a shared list you pick from. Use "Manage categories…" in any category menu to add, rename, recolor or delete them. Filter the list by category from the toolbar.

## How it works

The whole app is one file: [`bucketlist.html`](bucketlist.html).

- **Published as a Claude artifact**, it saves to the artifact's shared database, so both of you see the same list and changes show up live. Share the artifact with your friend as an **Editor** so they can make changes too.
- **Opened directly in a browser**, it falls back to saving in that browser only (handy for trying it out, but not shared).

Each activity is one document in the `activities` collection:

| Field | Meaning |
| --- | --- |
| `title`, `notes` | What the activity is |
| `categoryId` | Id of a document in `categories` (older activities may have a plain `category` name instead) |
| `status` | `todo` (shown as "Someday"), `planned` or `done` |
| `plannedFor`, `planNote` | Planned date (`YYYY-MM-DD`, or empty if not decided) and plan notes |
| `doneOn`, `memory` | Date it was done and a short memory |
| `addedBy`, `doneBy` | Who added it / ticked it off |
| `createdAt`, `doneAt` | Timestamps used for ordering |
| `checklist` | Planning steps, keyed by step id: `{ text, done, order, who, doneBy }`. A removed step is set to `null`. |

Each category is one document in the `categories` collection: `{ name, color, order }`, where `color` is 1–8.

## Copies for other lists

Each published copy is a separate page with its own link, its own list and its own sharing. Copies are built from `bucketlist.html` by `make_copies.py`, which only changes the page title and heading:

| Copy | File |
| --- | --- |
| 2027 Bucket List | [`copies/2027-bucket-list.html`](copies/2027-bucket-list.html) |

To add a copy, add a line to `COPIES` in `make_copies.py`. After changing `bucketlist.html`, run `python3 make_copies.py` and republish each copy so they all stay on the same version of the app.

## Hosting on Firebase

The same app can also run on Firebase (project `winter-bucket-list`), with your list stored in Cloud Firestore.

- `web/` is the site that gets published. Build it with `python3 build_web.py` (it wraps `bucketlist.html` and adds `firebase/firebase-shim.js`, which connects the app to Firestore).
- Each list is opened with a private link: `https://winter-bucket-list.web.app/#<list id>`. Anyone with the link can view and edit that list; nobody can browse other lists. The rules are in `firestore.rules`.
- To publish: `npm install -g firebase-tools`, `firebase login`, then `firebase deploy` from this folder.
