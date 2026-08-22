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
`?etherpad=<pad-url>` follows a live Etherpad.

## Line format

    [indent][gate] [fold] [status] Label (SIZE) URL @person #id :#id,#id !!! %% comment

One node per line. Everything except the label is optional.

### Hierarchy (indentation)

- Indentation defines the tree: a node's parent is the nearest line **above**
  with **less** indentation (a tab counts as 2 spaces; 2-space steps are the
  convention).
- Lines without a gate character are **root** nodes; several roots make
  several trees side by side.

### Gate (first character after the indent)

| char | meaning | semantics |
|---|---|---|
| `-` | all of | required part — all `-` siblings are needed |
| `+` | optional | a nice-to-have on the same and-group, dispensable |
| `\|` | any of | alternatives — at least one will be chosen |
| `=` | exactly one (xor) | alternatives — exactly one may be realized |

- `-` and `+` may be mixed within one sibling group (conjunctive group).
  `|` groups and `=` groups must be **uniform** — any other mixture is
  invalid (rendered by the first child, warning `mixedGate`).
- `=` is recognized only with **following whitespace** — `=SUM(A1:B2)` stays
  a label.
- In an `=` group at most **one** alternative may be *realized* (status
  `[~]`, `[/]`, `[x]` or `[^]`); each additional realized one warns
  (`xorConflict`).
- Optionality (`+`) is orthogonal to status: an optional node can be long
  `[^]`. Optional nodes never count toward the cheapest path.

### Fold mark (between gate and status box; on root lines at line start)

- `>` — this subtree starts **collapsed** when the document opens.
- `<` — inside a collapsed region, bring this subtree back into view.
- Recognized only with following whitespace (`- >Careful` stays a label).
  Presentation only: no effect on meaning, costs or warnings.

### Status box

| box | key | meaning |
|---|---|---|
| `[?]` | idea | vague idea |
| `[ ]` | planned | decided, nothing invested |
| `[~]` | in progress | costs invested, risk high |
| `[/]` | walking skeleton | works end to end, polish missing |
| `[x]` | done | complete |
| `[^]` | in production | deployed / live |
| `[-]` | discarded | deliberately dropped (hidden by default) |
| `[!]` | high risk | effort still unclear |

- No box = neutral node. `x` may also be uppercase `X`.
- Unknown codes are tolerated: the node renders neutral, with a warning —
  the line is never lost.

### Size (effort)

- T-shirt sizes in parentheses: `(XS) (S) (M) (L) (XL) (XXL)`.
- From `(M)` upward a node **should be decomposed further**; a node ≥ M
  without children gets a placeholder hint in the diagram.
- For cost estimation a missing size counts as `M`.

### Token extraction order (why nothing collides)

1. `%% comment` — everything from `%%` to end of line is stripped **first**
   (whole line or trailing part). This also applies inside descriptions.
2. Bare `https?://…` URL — makes the node clickable; extracted early so `@`,
   `#` and `!!!` inside URLs never trigger.
3. `(SIZE)` — first match, case-insensitive.
4. `@name` — people tags; several per line, any position. Characters:
   Unicode letters, digits, `.`, `_`, `-`.
5. `#id` — **node ID**: the *first* free-standing `#token` of the line
   (preceded by start-of-line or whitespace). Uniquely names the node in the
   whole document; a duplicate ID warns, and references resolve to the first
   occurrence. Later `#tokens` stay label text; `C#` stays a label. Same
   character set as `@name`.
6. `:#a,#b` — **dependencies**: one contiguous free-standing token — colon,
   then comma-separated IDs, each with `#`, **no spaces** (`:#a, #b` reads
   only `#a`, and the free-standing ` #b` would become the node ID!).
   Several tokens per line merge. `(:#a,#b)` in parentheses stays label text
   (quoting convention, same as `(#id)`).
7. `!!!` — **focus mark**, free-standing only: "everybody look here" — a
   shared pointer for collaborative editing. Independent of status and
   necessity; `Wow!!!` stays a label.
8. Whatever remains, whitespace-normalized, is the **label**. An empty label
   means the line is ignored.

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
  opens a block; the **indented** lines below it are its text (blank lines =
  paragraph breaks). There is no closing fence — the description section
  runs to end of file. Stray lines there produce warnings, never silent loss.
- Inside descriptions no token extraction happens — `(M)`, `@name`, `#id`
  and URLs stay literal text. Only `%%` comments are still stripped.

## Rules of thumb for writing Werkbaum

- One node per line; the label is mandatory, all else optional.
- Let indentation carry the hierarchy; keep sibling gates aligned.
- Never mix `|` or `=` with other gates in one sibling group.
- Decompose everything `(M)` or larger.
- Give a node its own status only; express "blocked by" with `:#…`
  dependencies instead of understating the status.
- Mark nice-to-haves with `+` — otherwise they inflate the cheapest path.
- Keep rejected alternatives as `[-]` instead of deleting them: the decision
  stays visible (add the reason as a `%%` comment).
- To mention syntax literally in a label without triggering it, wrap it in
  parentheses or quotes: `(#id)`, `(:#a,#b)`, `"#123"`.

## Complete example

    %% Project structure – Sprint 14
    [~] Website relaunch (XL) https://wiki.example.com/relaunch
      " Folded chapters are done.
      - > [x] Concept (M)
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
        - [ ] CMS integration #cms (M)
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
  the connected tracker's reference pattern.
- Free-standing `&tag`: keywords across the hierarchy (reserved, unbuilt).
