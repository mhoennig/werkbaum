# Werkbaum notation — guide for AI agents

Werkbaum is a plain-text notation for work-breakdown structures (WBS) with
and/or decomposition. This guide teaches you to **read and write** it. The
normative specification (German) is
https://github.com/mhoennig/werkbaum/blob/main/docs/SPEC.md — if this guide
and the SPEC disagree, the SPEC wins.

Files are UTF-8 with LF line endings; the extension `.werkbaum` is a
convention (plain `.txt` works too). The editor at
https://werkbaum.javagil.de renders the notation as a diagram;
`?sourceUrl=<url>` loads any CORS-readable http(s) text file, and
`?live=<document-url>` opens a document on a Werkbaum backend that several
people edit at once.

## Line format

    [indent][gate] [status] [fold] Label (SIZE) URL @person &tag #id :#id,#id !!! %% comment

One node per line. Everything except the label is optional.

### Line continuation (`\` at the end)

- A line ending in **whitespace followed by `\`** continues on the next line:
  no new node begins. The `\` and the next line's indentation are dropped, the
  two parts are joined with **exactly one space**. Several `\` in a row extend
  the line further.
- The whitespace before the `\` is **required** — `C:\temp\` stays a label and
  does not swallow the following node. Note this differs from shell habit,
  where `foo\` continues.
- Everything belongs to the **first** line: its indentation sets the level, its
  number is the one warnings report, and tools that write back (fold mark, id
  shorthand) only touch it.
- A token must not be split across the break — the join inserts a space, so a
  cut URL stays cut.
- Only in the tree part. Behind the `---` divider line breaks are paragraph
  structure, and `\` is ordinary text.
- Comments are removed **first**: `- A \ %% note` continues, `- A %% note \`
  does not.

### Hierarchy (indentation)

- Indentation defines the tree: a node's parent is the nearest line **above**
  with **less** indentation (a tab counts as 2 spaces; 2-space steps are the
  convention).
- Lines without a gate character are **root** nodes; several roots make
  several trees side by side.

### Gate (first character after the indent)

| char | meaning           | semantics                                         |
|:-----|:------------------|:--------------------------------------------------|
| `-`  | all of            | required part — all `-` siblings are needed       |
| `+`  | optional          | a nice-to-have on the same and-group, dispensable |
| `\|` | any of            | alternatives — at least one will be chosen        |
| `=`  | exactly one (xor) | alternatives — exactly one may be realized        |

- `-` and `+` may be mixed within one sibling group (conjunctive group).
  `|` groups and `=` groups must be **uniform** — any other mixture is
  invalid (rendered by the first child, warning `mixedGate`).
- `=` is recognized only with **following whitespace** — `=SUM(A1:B2)` stays
  a label.
- In an `=` group at most **one** alternative may be *realized* (status
  `[~]`, `[/]`, `[x]` or `[^]`); each additional realized one warns
  (`xorConflict`).
- Optionality (`+`) is orthogonal to status: an optional node can be long
  `[^]`. An optional node counts toward the cheapest path **only while it is
  being worked on** — `[~]` or `[/]`; untouched and finished ones stay out.

### Fold mark (immediately before the label, i.e. after the status box)

- `>` — this subtree starts **collapsed** when the document opens.
- `<` — inside a collapsed region, bring this subtree back into view.
- Recognized only with following whitespace (`- [x] >Careful` stays a label).
- **Write it after the status box** (`- [x] > Concept`). The older position
  between gate and box (`- > [x] Concept`) is still read, but never written:
  it shifts the box by one indent step, so a folded parent's box lines up with
  its children's boxes.
- Describes the document's fold state: opening restores it, and folding in the
  diagram writes the mark back. No effect on meaning, costs or warnings.

### Status box

| box   | key              | meaning                                  |
|:------|:-----------------|:-----------------------------------------|
| `[?]` | idea             | vague idea                               |
| `[ ]` | planned          | decided, nothing invested                |
| `[~]` | in progress      | costs invested, risk high                |
| `[/]` | walking skeleton | works end to end, polish missing         |
| `[x]` | done             | complete                                 |
| `[^]` | in production    | deployed / live                          |
| `[-]` | discarded        | deliberately dropped (hidden by default) |
| `[!]` | high risk        | effort still unclear                     |

- No box = neutral node. `x` may also be uppercase `X`.
- Unknown codes are tolerated: the node renders neutral, with a warning —
  the line is never lost.
- **`[x]` and `[^]` cost nothing any more.** The cheapest path prices the
  work that is *left*, so a done node adds zero regardless of its size and
  carries no station on the path line; started work (`[~]`, `[/]`) still
  counts in full. **A realized alternative wins its `|`/`=` group** even when
  a cheaper unstarted one sits next to it — the choice has been made; among
  several realized ones cost decides again. The *intrinsic* status decides —
  dependencies may hold a node back effectively, but the work on it is paid
  for.

### Size (effort)

- T-shirt sizes in parentheses: `(XS) (S) (M) (L) (XL) (XXL)`. Recognized
  only **free-standing** (preceded by start-of-line or whitespace), and the
  **last** such token of the line is the size — earlier ones stay in the
  label. `"(L)"` and `((L))` mention a size literally (quoting convention).
- From `(M)` upward a node **should be decomposed further**; a node ≥ M
  without children gets a placeholder hint in the diagram.
- **A size prices its whole subtree.** For the cheapest path, the cost of a
  node is its own stated size — sub-packages are **not** added on top; the
  conflict check below guards whether they fit. A done node (`[x]`/`[^]`)
  costs 0.
- For cost estimation a missing size is **estimated from the sub-packages**:
  at least the largest size among the counting children (same children as
  the conflict check below, except unsized children count too — estimated
  recursively); three or more children at that largest size raise it by one
  step, capped at `XXL`. Without counting children it stays `M`.
  The estimate prices the **remaining** work: done children (`[x]`/`[^]`)
  drop out, and a done realized alternative completes its `|`/`=` group.
  When counting children exist but all are done, `XS` is assumed — the rest
  is the parent's own wrap-up. A stated size is never adjusted this way.
- **Size conflict check:** a given size must fit the direct children. For
  this one check each size is read as a range (lower bounds double, XXL is
  open-ended):

  | size  | XS     | S      | M      | L       | XL       | XXL     |
  |:------|:-------|:-------|:-------|:--------|:---------|:--------|
  | range | [1, 2) | [2, 4) | [4, 8) | [8, 16) | [16, 32) | [32, ∞) |

  It is a conflict — warning `sizeConflict` at the parent's line — only when
  the sum of the children's lower bounds reaches the parent's upper bound,
  i.e. when it is wrong under *every* reading. Only sized, non-optional,
  non-discarded direct children count; in an `|`/`=` group only the smallest
  alternative. An XXL parent never warns; nothing is corrected automatically.
  When you write plans, pick parent sizes that pass this check.

### Token extraction order (why nothing collides)

1. `%% comment` — everything from `%%` to end of line is stripped **first**
   (whole line or trailing part). This also applies inside descriptions.
2. Bare `https?://…` URL — makes the node clickable; extracted early so `@`,
   `#` and `!!!` inside URLs never trigger.
3. `(SIZE)` — the **last free-standing** match, case-insensitive; earlier
   size-like tokens stay in the label.
4. `@name` — people tags; several per line, any position. Characters:
   Unicode letters, digits, `.`, `_`, `-`.
5. `&tag` — **free keywords**, free-standing only (so `R&D` and
   `Drag & Drop` stay labels; `(&taiga.slug)` in parentheses mentions one
   literally). Same character set as `@name`; several per line, any
   position. Only the `taiga.` prefix carries meaning:
   `&taiga.<project-slug>` names the Taiga project a subtree belongs to and
   is **inherited downwards** — the nearest ancestor with a `taiga.*`
   keyword wins, a node's own keyword overrides, the first of several on
   one line counts. All other keywords are free and (so far) unconsumed.
6. `#id` — **node ID**: the *first* free-standing `#token` of the line
   (preceded by start-of-line or whitespace). Uniquely names the node in the
   whole document; a duplicate ID warns, and references resolve to the first
   occurrence. Later `#tokens` stay label text; `C#` stays a label. Same
   character set as `@name`.
   **Write it before the title, separated by a colon — `#auth: Backend`.** That
   is the customary form. The colon is optional and is a separator in the text
   only: it belongs neither to the ID nor to the label and is never rendered.
   It is consumed only when it directly follows the ID *and* is followed by
   whitespace or end of line — so a colon inside the label survives
   (`#auth: Rule: token required`), and `#auth:#db` still reads as ID plus
   dependency. Placement stays free: `Backend #auth` means the same thing.
7. `:#a,#b` — **dependencies**: one contiguous free-standing token — colon,
   then comma-separated IDs, each with `#`, **no spaces** (`:#a, #b` reads
   only `#a`, and the free-standing ` #b` would become the node ID!).
   Several tokens per line merge. `(:#a,#b)` in parentheses stays label text
   (quoting convention, same as `(#id)`).
8. `!!!` — **focus mark**, free-standing only: "everybody look here" — a
   shared pointer for collaborative editing. Independent of status and
   necessity; `Wow!!!` stays a label.
9. Whatever remains, whitespace-normalized, is the **label**. An empty label
   means the line is ignored — **unless the line carries a node ID**: then
   `#id` becomes the label, with or without the trailing colon. `- #US-123`
   and `- #US-123:` both render a node titled `#US-123`. Use this when the
   identifier already is the name (ticket references); writing the title next
   to it would just repeat it. The `#` toggle in the diagram adds no prefix to
   such a node — the ID is already there.

### Dependency semantics

- Dependencies constrain **status**, not order or start time — this is not a
  PERT chart. A node is *effectively* at most as far as everything it needs:
  progress ranks are `[?]`=0, `[ ]`=1, `[!]`=1, `[~]`=2, `[/]`=3, `[x]`=4,
  `[^]`=5 (neutral and `[-]` count 0), and the **effective rank is the
  minimum of the intrinsic ranks over the node itself and everything
  reachable via `:#…`**. The diagram colors nodes by effective status and
  marks held-back nodes with their own status box.
- Write only the **intrinsic** status into the text. The effective one is
  always computed — never write it (one source of truth).
- **Cycles are legal** and mean "finished together" — no warning, including
  self-dependencies.
- Referencing a nonexistent ID warns (`unknownDep`).
- For the cheapest-path cost, dependencies pull their targets (plus the
  targets' own realization and dependencies) into the needed set; shared
  targets count **once**. Discarded (`[-]`) targets are never pulled.

### Descriptions

- **Short form:** a line whose first non-blank character is `"` followed by
  whitespace is a *description of the preceding node*, not a node. Several
  consecutive `"` lines continue the same description; their indentation is
  irrelevant. `"Quote"` without following whitespace stays a label. Only on
  lines without a gate character.
- **Long form:** a separator line of three or more dashes (`---`) ends the
  tree part. After it, an **unindented** line holding exactly one `#id`
  (a trailing colon is tolerated) opens a block; the **indented** lines below
  it are its text (blank lines =
  paragraph breaks). There is no closing fence — the description section
  runs to end of file. Stray lines there produce warnings, never silent loss.
- Inside descriptions no token extraction happens — `(M)`, `@name`, `#id`
  and URLs stay literal text. Only `%%` comments are still stripped.

## Rules of thumb for writing Werkbaum

- One node per line; the label is mandatory, all else optional.
- Let indentation carry the hierarchy; keep sibling gates aligned.
- Never mix `|` or `=` with other gates in one sibling group.
- Decompose everything `(M)` or larger.
- Put a node ID in front of the title, separated by a colon: `#auth: Backend`.
- Put a fold mark after the status box, right before the label:
  `- [x] > Concept`. Before the box it would shift the box by one indent step.
- Give a node its own status only; express "blocked by" with `:#…`
  dependencies instead of understating the status.
- Mark nice-to-haves with `+` — otherwise they inflate the cheapest path.
- Keep rejected alternatives as `[-]` instead of deleting them: the decision
  stays visible (add the reason as a `%%` comment).
- To mention syntax literally in a label without triggering it, wrap it in
  parentheses or quotes: `(#id)`, `(:#a,#b)`, `"#123"`, `"(L)"`, `((L))`.

## Complete example

    %% Project structure – Sprint 14
    [~] Website relaunch (XL) https://wiki.example.com/relaunch
      " Folded chapters are done.
      - [x] > Concept (M)
        - [x] Audience analysis (S)
        - [x] Sitemap (XS)
      - [~] Implementation (XL)
        - [~] Frontend (M) https://git.example.com/frontend @anna
          | [ ] PWA (S)
          | [ ] Web+Native
            - [/] Web (S)
            - [ ] Android (M)
            - [ ] iOS (M)
        - [!] Backend (L) @ben @carla
        - [ ] #cms: CMS integration (M)
          | [ ] WordPress
          | [?] Headless CMS
          | [-] Custom build  %% too much effort
        - [x] Landing page (S) :#cms  %% done, but effectively waiting for the CMS
        + [?] Dark mode (S)  %% nice to have, never on the cheapest path
      - [?] Hosting (M)  %% exactly one of these, hence =
        = [ ] Cloud
        = [?] On-premise

    ---
    #cms
      The articles live in the CMS, so everything that shows content
      depends on it.

## Reserved — do not use for other purposes

- Ticket references like `#123` or `#US-123` (Taiga user story, Jira
  `#ABC-123`): planned tracker integration will resolve node IDs that match
  the connected tracker's reference pattern. Werkbaum writes the `US-`/`T-`
  prefixes itself when it creates tickets; the ref is added to the line
  **beside** an existing node ID (later `#tokens` stay label text).
- Free-standing `&tag` keywords other than `taiga.*` are parsed but have no
  consumer yet — do not assign them a meaning.
