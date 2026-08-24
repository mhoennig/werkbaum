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

## 2026-08-24

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
