# Our Bucket List

A shared bucket list for two people, styled like a passport.

- **Next up**: your soonest planned activity is shown as a travel document, with the date, a countdown and a "Before we go" checklist. If nothing is planned, "Pick one for us" suggests a random activity (from the selected category, if you've filtered by one).
- **Add activities**: type in the add box (press <kbd>N</kbd> from anywhere) and choose a category. Paste a list with one activity per line to add them all at once. Every new activity sets off a short celebration for whoever has the page open: snowfall on the Winter list, confetti on the 2027 list. It's skipped for people who turn on reduced motion on their device.
- **Plan from the list**: every To do row has a **Plan** button on its right. It moves the activity to Planned and opens its planning view with the calendar showing.
- **Swipe to delete**: swipe a row left (or drag it with the mouse, or two-finger swipe on a trackpad) to reveal **Delete**; swipe all the way to delete straight away. This is the only way to delete, and every delete can be undone. Done activities can be swiped from the **All** tab.
- **Calendar**: dates are picked from a month calendar styled after Apple Calendar, and the Next up card shows the date like Apple's Calendar icon.
- **Tick things off**: tap the circle on any row. It animates, moves to your Stamps page, and the message at the bottom lets you undo.
- **Stamps**: every completed activity becomes an ink stamp in its category's color, with the date and the line you wrote to remember it by.
- **Reschedule or undo**: on the Next up card, "Reschedule" opens the date and "Cancel plan" moves the activity back to To do (its notes and checklist are kept). Each stamp has an undo button to remove it if you ticked something off by mistake; the activity goes back to Planned if it had a date, otherwise To do. The same "Cancel plan" and "Remove stamp" buttons are at the bottom of every activity's details, and each one can be undone from the message that appears.
- **Details**: tap any activity to open its details. A line above the name says where it stands ("To Do", "Plan" or "Completed"), and the bottom bar has **Plan this**, **Cancel plan** or **Remove stamp** to move it along. Change its name, category, date, notes, memory and checklist. Typed changes (name, notes, memory, dates) are saved with the **Save** button (or Ctrl/Cmd+S), and closing with unsaved changes asks first. Status, category and checklist changes save right away.
- **Pull down to close**: on a phone, details (and the other panels) close by dragging the handle at the top down. Only a pull that starts right at the handle counts, so scrolling or touching the content never moves the panel. A short pull springs back, and unsaved changes still ask first. On a phone, tapping the dimmed area above a panel doesn't close it (on a computer, clicking outside still does).
- **No zooming on phones**: pinch and double-tap zoom are turned off (the layout already fits the screen), which also stops iPhones zooming in when a text box is tapped. On the Firebase site this is set in the page's viewport; Safari ignores that, so the app also blocks the pinch gesture itself.
- **While you were away**: when you open the list, a card above Next up lists what the other person did since your last visit (added, planned, moved, ticked off, cancelled, deleted), newest first. Tap a line to open that activity. **Got it** hides it.
- **Planning checklist**: planned activities have steps you can tick off, plus quick-add suggestions.
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
| `status` | `todo`, `planned` or `done` |
| `plannedFor` | Planned date (`YYYY-MM-DD`, or empty if not decided). Older activities may have a `planNote`; the app moves it into `notes` |
| `doneOn`, `memory` | Date it was done and a short memory |
| `addedBy`, `doneBy` | Who added it / ticked it off |
| `createdAt`, `doneAt` | Timestamps used for ordering |
| `checklist` | Planning steps, keyed by step id: `{ text, done, order, who, doneBy }`. A removed step is set to `null`. |

Each category is one document in the `categories` collection: `{ name, color, order }`, where `color` is 1–8.

The **While you were away** card reads two more collections:

- `events`: one entry per meaningful change, `{ type, itemId, title, by, at, date }`, where `type` is `add`, `plan`, `move`, `done`, `unplan`, `unstamp` or `delete`. A change reversed by the same person within 15 minutes is taken back out (ticked then un-ticked, planned then cancelled, added then deleted, deleted then typed back in, a date moved and moved back), even after a reload. Move entries keep the previous date in `from`. Entries older than 30 days are cleared.
- `seen`: one document per person (`{ at }`), the last time they had the list open. The card shows the other person's changes since then; **Got it** or leaving the page moves it forward.

## Copies for other lists

Each published copy is a separate page with its own link, its own list and its own sharing. Copies are built from `bucketlist.html` by `make_copies.py`, which only changes the page title, the heading and the celebration played when an activity is added (`DEFAULT_EFFECT`, either `snow` or `confetti`):

| Copy | File | Celebration |
| --- | --- | --- |
| 2027 Bucket List | [`copies/2027-bucket-list.html`](copies/2027-bucket-list.html) | Confetti |

To add a copy, add a line to `COPIES` in `make_copies.py`. After changing `bucketlist.html`, run `python3 make_copies.py` and republish each copy so they all stay on the same version of the app.

## Hosting on Firebase

The same app can also run on Firebase (project `winter-bucket-list`), with sign-in through Firebase Authentication and lists stored in Cloud Firestore.

- `web/` is the site that gets published. Build it with `python3 build_web.py`. It wraps `bucketlist.html` and adds `firebase/firebase-shim.js`, which handles sign-in and connects the app to Firestore.
- Each list has its own link: `https://winter-bucket-list.web.app/#<list id>`. People sign in with Google or an email and password, and only the emails added under **People** (the account icon in the top corner) can open the list. An email and password account has to confirm its email (from a link we send) before it can open a list. The first person to open a new list becomes its first member. The rules are in `firestore.rules`.
- Each list's link is private, so it isn't written here. The site names each list and picks its celebration (`snow` or `confetti`) using `LISTS` in `firebase/firebase-shim.js`, which is keyed by a SHA-256 hash of the link id (first 16 hex characters) so the links can't be read from the site's code. The first person to open a new list's link becomes its first member, so open a new list yourself before sharing it.
- **Owner and deleting a list**: whoever opened a list first owns it (`createdBy`), and People marks them "Owner". Only the owner sees **People → Delete this list**, which removes every activity, category and member, then leaves an empty marker (`deletedAt`) so the link shows "This list was deleted" instead of starting a new list. `firestore.rules` enforces that only the owner can do this.
- `firebase/exports/` holds each list as saved from claude.ai. Import one from **People → Bring over a list**.
- **Home screen app**: the site can be added to a phone's home screen (Safari: Share → Add to Home Screen; Chrome: the install prompt, or **People → Add to home screen**). It opens full screen at `/`, which shows **Your lists** after sign-in, or goes straight to the list opened last. **People → All lists** switches lists. The files are `firebase/manifest.webmanifest`, `firebase/sw.js` (a network-first offline copy) and `firebase/icons/` (PNGs rendered from `icon.svg`).
- Inside the installed app, Google sign-in goes to Google and back instead of using a pop-up, through the site's own address (`authDomain` is set to the site's domain there). That needs `https://winter-bucket-list.web.app/__/auth/handler` in the authorized redirect URIs of the project's OAuth web client in Google Cloud Console. Email and password sign-in works without it.
- To publish: `npm install -g firebase-tools`, `firebase login`, then `firebase deploy` from this folder.
