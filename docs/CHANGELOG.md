# Changelog

What changed, newest first. This file feeds the **What's new** popup in the
editor (the star in the header, D58): every `## YYYY-MM-DD` heading opens a day,
every bullet under it becomes one note. Anything else here — like this
paragraph — is read by people, not by the build.

**English, deliberately.** The project's documentation is German (CLAUDE.md),
but this file is shown *inside the product*, whose interface speaks nine
languages. Like the shipped plan and `llms.md` it is a delivered artefact with a
worldwide audience (D22, D43). Keep the notes short — one line, what changed,
from the reader's side rather than the commit's. `Backticks` become code in the
popup; no other markup is honoured, so write plain sentences.

The node highlighting per day does **not** come from here: it is computed from
the git history of `docs/examples/werkbaum.werkbaum`. A day can therefore carry
a link without having a note (someone forgot to write one) — but never the
reverse.

## 2026-08-27

- A benefit rating per node recorded as planned: a 0-9 digit inside the size token (`M/9`), and a third path mode that picks alternatives by benefit over cost — spelled out in SPEC §11 before it is built
- A people bar below the diagram shows each `@person` with their share of the open work on the cheapest path — plus an entry for what is assigned to nobody
- Tapping a person filters the diagram to their nodes: everything else folds, their packages stand collapsed as `▸ n`, their pills turn teal — a view-only lens that never writes into the text
- Folding regions in the text editor recorded as an idea in the plan — view-only and local, unrelated to the diagram's fold marks, deliberately not sized yet
- Fix: the root node's fold chip was white-on-pastel and barely visible — it now looks like every other node's, and the description mark and id line on a coloured root are readable too
- The caret on a node off the cheapest path now highlights only the ring — the fill stays pale instead of jumping back to full colour
- On shared documents the history button shows the server's milestones — loading one is a rollback for everyone, as a new version, nothing lost
- The camera button turns the current state of a shared document into a server milestone instead of a local snapshot
- Joining or sharing a document asks once for a display name — it fills the history's "changed by" and stays a claim, not a proof
- Renaming a shared document now renames it for everyone: the pencil patches the server title, and the change feed hands the new name to every open editor
- URL documents lost their pencil — their name is the URL, and a local name would not survive the next load
- If Werkbaum is open in a second browser tab, a warning says so — both tabs write the same document list, and the last one to save wins
- Reloading a URL document no longer asks — a page reload discards local changes silently anyway, so the question promised a protection that did not exist
- Deleting your last document now says that a fresh example will take its place
- Fix: the reload button also showed for shared documents and would have loaded the API's JSON answer as text, pushing it to everyone
- An owner password for shared plans recorded as planned: creating a document returns it once, management will bind to it, an admin can reclaim
- Shared documents are left, not deleted: their row shows a leave action with its own icon and wording — the document stays on the server, and its link lands on the clipboard
- The document menu's groups are named Included, Local and Shared now — "yours" and "sources" said less than where a document lives
- Documents are stored one key each now, with a small index: a full storage no longer blocks every save, and one corrupted entry costs one document instead of all
- Typing no longer serializes every document on each keystroke — only the active text is written, the full list on switching, closing or leaving the page
- When the browser's storage is full, a warning says so instead of silently dropping changes until the next reload
- Shipped documents are no longer renamable — their name is part of the delivered state, and a renamed but unedited example would still silently receive new versions
- Fix: sharing from an instance without its own backend (GitHub Pages) failed with HTTP 405 — the share button now probes the default address and asks for the server instead

## 2026-08-26

- The document picker moved into the app header: `Werkbaum › name` opens the menu — on the phone it is reachable from both panes, and the name takes over the subtitle line
- The document menu groups by kind — included, yours, sources — carries rename and delete on each row, and scrolls instead of being cut off on small screens
- The editor title bar is labelled `Text editor` again and holds the document's own buttons: save, snapshot, history, reload from the source, and a short `Share` button that puts the plan on a server
- The address bar follows the document you switch to: `?live=` and `?sourceUrl=` name what is in front of you, so a reload brings back the same plan
- Switching to a server document in the picker now really opens it live — before it only showed its last state
- Fix: a foreign change to a server document could land in the text of a local document you had switched to
- Changes in a shared document now reach the others after 0.6 s instead of 1.5 s — the wait before sending was almost the whole delay

- The Etherpad integration is gone: collaboration now runs through a Werkbaum backend, and an old `?etherpad=` link says so instead of doing nothing
- Plans can live on a Werkbaum backend now: open `?live=<document URL>` and everyone edits the same text, seeing each other's changes without reloading
- When two people change the same lines, a bar asks whose version should win — everything else the server merges by itself
- The caret stays where you put it when someone else inserts lines above you
- The backend can be deployed to a server: its own JDK, a systemd service, and Apache passing `/api/` on
- "Put on the server" in the document menu turns a local plan into a shared one and puts the link in the address bar
- A service endpoint `/api/v1/info` says which build is running — for deploys and monitoring
- One `remote` command drives the server: deploy, log, service state, and a database backup that is read back before it is kept
- Fix: folding a node in a shared document could ask whose version should win — the editor was arguing with itself, because the change feed hands your own change back to you

## 2026-08-25

- The fold button cycles through four presets now: size M and smaller, everything off the cheapest path, everything, all open
- A button next to the cheapest-path toggle switches the dependency cross links on and off
- Dependency links follow the folding: an edge to a hidden node now ends at its first visible ancestor, for source and target alike
- In Brave, the file notice names the flag that enables the File System Access API by hand
- Fix: the file notice and the legend blamed "Chromium", but Brave is Chromium without the File System Access API — they now name the feature and example browsers
- Browsers without the File System Access API (Firefox, Safari) explain themselves once: files open as copies and saving downloads a new file
- Fix: the save dialog suggested a "name (1)" neighbour in the wrong folder — it now points at the original file, and open/save dialogs remember the plan folder
- Ctrl+S saves the document as a file — with a remembered file it writes straight back in place, and the document name flashes as confirmation
- Fix: a file double-clicked right after the app starts could open as a duplicate document instead of updating its own
- The installed app registers for `.werkbaum` files — a double-click in the file manager opens them straight into the editor
- A service worker starts the editor offline; navigations stay network-first, so the update notice keeps telling the truth
- Werkbaum installs as an app: a web app manifest with standalone display and icons rendered from the brand mark
- PWA file handling recorded in the plan — an installed app would open `.werkbaum` files on double-click and save without any dialog
- In Chromium browsers, saving writes back to the opened file, and the same file reopens into the same document
- Open a local `.werkbaum` file and save the document back as a file, from the document menu
- An AI integration recorded as an idea in the plan — edit the tree in a dialogue, with your own API key and `llms.md` as the model's guide
- A warning flags the bottleneck when one `@name` carries more than half of the open work on the cheapest path — their tag pills turn amber on the open nodes
- The estimated size of an unsized node now prices the remaining work — done sub-packages drop out, and a subtree with everything named done counts as XS
- The fold chip is solid white with an ink glyph now — the translucent box vanished on the pastel node colours
- A size prices its whole subtree on the cheapest path — sub-packages no longer add on top, so a carefully decomposed `(S)` beats a coarse `(L)`
- The size is now the last free-standing `(L)`-style token of the line — earlier ones stay in the title, and `"(L)"` or `((L))` mention a size literally
- Fix: Ctrl+click on a dependency preceded by a non-breaking space did nothing, although the parser reads it as a dependency
- Ctrl+click a dependency `:#id` in the text jumps to the line that defines the ID — Ctrl+Enter does the same at the caret

## 2026-08-24

- A missing size is now estimated from the sub-packages — at least the largest child size, one step more from three children of that size
- Node titles wrap at thirty-two characters now instead of forty — long titles pulled the diagram wide
- Fix: in the vertical layout, the line from a parent to one or two children was torn — the collector rail now always reaches the parent's stub
- The legend shows the high-risk status `[!]` and mentions the size check
- `llms.md` tabulates the size ranges and aligns its table columns
- Long node titles wrap into evenly balanced lines of at most forty characters
- With ids shown, the id sits on its own line above the title
- The fold sign is a framed chip now — a click target you can actually hit
- Typing `:#` suggests the document's ids — arrows choose, Enter inserts
- When the caret's node is folded away, the nearest visible ancestor takes the highlight — also on Alt+click from the text
- A size that cannot hold its sub-packages turns its badge amber and gets a warning — sizes are read as ranges, so only sure conflicts are reported
- Fix: the exported SVG drew the assumed-M badge filled like a real size instead of inverted
- Dependency links now run behind every node, highlighted ones included — no more lines struck through node titles
- Fix: the line to an only child was torn where the child does not sit centred in its cell
- An optional node (`+`) joins the cheapest path while it is being worked on — started work is the open front
- Fix: a started alternative lost its `|`/`=` group to an untouched cheaper one, although the choice was already made
- A node written as an id alone (`- #US-123`) is now titled by that id, instead of being ignored
- A line ending in a space and `\` continues on the next line, so a long node no longer has to fit into one
- A star in the header opens What's new: the changes of the last few days, and a link per day that shows the nodes it touched in the diagram
- A warning triangle replaces the question mark as the pointer over faulty line numbers
- The node window replaces the browser tooltip everywhere — at the pointer, on keyboard focus and on touch
- A `#` button in the diagram header puts node IDs in front of the titles
- Typing `#.kc` under `#prod-stage` expands to `#prod-stage.kc`, right when you close the id with a colon
- A camera button next to the history saves a snapshot on demand
- Fix: the manual snapshot button confirmed without saving anything while nothing had changed yet
- Warning line numbers carry their message as a tooltip
- `llms.txt` now points at the notation guide, and `llms.md` is served as UTF-8

## 2026-08-23

- Every node of the shipped Werkbaum plan carries an ID and a description
- One button steps from station to station along the cheapest path
- The cheapest path shows the open front: what is done costs nothing any more
- A new document starts by asking for its name
- The text area no longer wraps lines — the indentation keeps carrying the hierarchy
- Node IDs read `#auth: Title` now, with an optional separating colon
- Fold marks moved behind the status box, so the boxes stay aligned
- Fix: the document and download menus open again on small screens

## 2026-08-22

- Node IDs (`#auth`) name a node across the whole document
- Dependencies (`:#auth,#api`) point across the tree, cycles allowed
- The node colour shows the effective status — what a node waits for holds it back
- Dependency links are drawn as thin dotted curves behind the nodes
- Subtrees fold and unfold, in the diagram and as `>` / `<` in the text
- Exactly-one groups (`=`) with a "1" plaque on the collector rail
- Node descriptions, as `"` lines or as blocks behind a `---` divider
- The cheapest path counts shared dependencies once — and says so when it has to guess
- "Restore original" brings a shipped document back to the delivered state
- `llms.md` explains the notation to AI agents

## 2026-08-16

- The example plan is called `werkbaum.werkbaum` and describes Werkbaum itself

## 2026-08-05

- Line numbers next to the text, warnings marked in the strip
- Alt+click in the text centres the node of the caret line

## 2026-07-30

- The focus mark `!!!` got a teal crown of its own
- Research on updating by itself: what an Etherpad instance can and cannot do
- An IntelliJ plugin recorded as an idea in the plan

## 2026-07-27

- `+` marks an optional node — an extra, neither required nor an alternative
- Consecutive optional leaves cascade into a staircase instead of taking a column each
- "What's new" highlights what went into production since your last visit
- A shared Etherpad can be watched, embedded and reloaded

## 2026-07-25

- The notation text can be loaded from a URL with `?sourceUrl=`

## 2026-07-23

- Several documents side by side, switched from the editor's title bar
- The interface language follows the browser, German as the fallback
- High risk `[!]` carries a warning triangle

## 2026-07-22

- IBM Plex is embedded locally — no request to Google, no IP address to third parties
- Zoom controls for the diagram
- Accessibility: spoken labels per node, focus order, live region for warnings

## 2026-07-21

- First version: text notation, parser, and a diagram in three layout modes
- Status boxes, t-shirt sizes, people tags, bare URLs and `%%` comments
- The cheapest path through the tree, with a metro-style line through the open leaves
- Print stylesheet and SVG/PNG export of the diagram
