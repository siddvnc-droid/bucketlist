# Our Bucket List

A shared bucket list for two people. You can:

- **List activities**: add them one at a time with a category, or paste your whole list (one per line; bullets and numbers are removed for you).
- **Categories**: pick from a shared list of categories. Open the tag button next to the category filter to add, rename, recolor or delete them. Filter the list by category, and "Pick one for us" picks from the filtered category.
- **Track progress**: tick an activity off with the date you did it and a line to remember it by. Done items get a "DONE" stamp, and the header shows how far through the list you are.
- **Plan the next one**: pick a date for any activity. The soonest planned one appears at the top as your "Next up" card with a countdown. If nothing is planned, "Pick one for us" suggests a random activity.
- **Planning checklist**: every planned activity has a checklist of steps (book flights, set a budget, …). Tick steps off, claim one with "I'll do it", or use the quick-add suggestions. It shows on the Next up card and under "steps" on planned rows.

## How it works

The whole app is one file: [`bucketlist.html`](bucketlist.html).

- **Published as a Claude artifact**, it saves to the artifact's shared database, so both of you see the same list and changes show up live. Share the artifact with your friend as an **Editor** so they can add and tick off activities too.
- **Opened directly in a browser**, it falls back to saving in that browser only (handy for trying it out, but not shared).

Each activity is one document in the `activities` collection:

| Field | Meaning |
| --- | --- |
| `title`, `notes` | What the activity is |
| `categoryId` | Id of a document in `categories` (older activities may have a plain `category` name instead) |
| `status` | `todo`, `planned` or `done` |
| `plannedFor`, `planNote` | Planned date (`YYYY-MM-DD`, or empty if not decided) and plan notes |
| `doneOn`, `memory` | Date it was done and a short memory |
| `addedBy`, `doneBy` | Who added it / ticked it off |
| `createdAt`, `doneAt` | Timestamps used for ordering |
| `checklist` | Planning steps, keyed by step id: `{ text, done, order, who, doneBy }`. A removed step is set to `null`. |

Each category is one document in the `categories` collection: `{ name, color, order }`, where `color` is 1–8.
