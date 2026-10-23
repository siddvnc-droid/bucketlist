# Our Bucket List

A shared bucket list for two people. You can:

- **List activities**: add them one at a time, or paste your whole list (one per line; bullets and numbers are removed for you).
- **Track progress**: tick an activity off with the date you did it and a line to remember it by. Done items get a "DONE" stamp, and the header shows how far through the list you are.
- **Plan the next one**: pick a date for any activity. The soonest planned one appears at the top as your "Next up" ticket with a countdown. If nothing is planned, "Pick one for us" suggests a random activity.

## How it works

The whole app is one file: [`bucketlist.html`](bucketlist.html).

- **Published as a Claude artifact**, it saves to the artifact's shared database, so both of you see the same list and changes show up live. Share the artifact with your friend as an **Editor** so they can add and tick off activities too.
- **Opened directly in a browser**, it falls back to saving in that browser only (handy for trying it out, but not shared).

Each activity is one document in the `activities` collection:

| Field | Meaning |
| --- | --- |
| `title`, `category`, `notes` | What the activity is |
| `status` | `todo`, `planned` or `done` |
| `plannedFor`, `planNote` | Planned date (`YYYY-MM-DD`, or empty if not decided) and plan notes |
| `doneOn`, `memory` | Date it was done and a short memory |
| `addedBy`, `doneBy` | Who added it / ticked it off |
| `createdAt`, `doneAt` | Timestamps used for ordering |
