# Yoley Content Schema

Single source of truth for every user-facing help topic. One topic = one Markdown file with YAML front-matter. A build step (added later) generates:

- Website HTML (`user-guide.html`, `faq.html`, `quick-guide.html`)
- Website AI-bot knowledge bundle (`knowledge.json`)
- In-app Swift knowledge base (`HelpKnowledgeBase.generated.swift`)

All three downstream artefacts are derived — never hand-edited.

---

## Directory layout

```
content/
  SCHEMA.md                 ← this file
  README.md                 ← authoring quickstart
  sections.yaml             ← ordered list of sections, titles, icons, screen mapping
  <section>/
    _section.md             ← optional section intro (front-matter + prose)
    <slug>.md               ← one topic per file
```

A topic's canonical `id` is derived from its path: `content/quotes/create.md` → `quotes.create`. Don't set `id` manually.

---

## Front-matter fields

### Required

| Field | Type | Notes |
|---|---|---|
| `title` | string | Display title for the guide (e.g. "Create a quote"). |
| `section` | string | Must match an `id` in `sections.yaml`. |
| `summary` | string (1–3 sentences) | The canonical short answer. Used by the in-app KB, the bot, and as the FAQ answer. Keep it actionable and self-contained. |
| `questions` | list of strings | Natural-language phrasings users might ask. First entry is the canonical FAQ question. Minimum 1, recommend 2–4. |
| `tags` | list of strings | Lowercase tokens for the in-app matcher. Include synonyms, not full phrases. |
| `audiences` | list | Which generators pick this topic up. Any subset of: `user-guide`, `faq`, `quick-guide`, `in-app`, `bot`. Omit one to hide the topic from that surface. |
| `updated` | ISO date (`YYYY-MM-DD`) | Last meaningful edit. Generator uses this to sort freshness and stamp `knowledge.json`. |

### Optional

| Field | Type | Notes |
|---|---|---|
| `order` | integer | Render order within the section for list-style surfaces (user-guide, FAQ). Lower first; topics without `order` sort to the end, then by title. Use increments of 10 so new topics can be slotted in without renumbering. |
| `screen` | enum | Must match an `AppScreen` case in the iOS app: `quotes`, `invoices`, `expenses`, `jobDiary`, `customers`, `payments`, `settings`. Surfaces the topic as a suggested question on that screen. |
| `related` | list of topic IDs | Cross-references. The user-guide renderer uses these for "See also" links; the bot uses them to broaden context. |
| `since_version` | semver | First app version this is accurate for. Drives `knowledge.json` version-gating. |
| `quick_start_order` | integer | If set, includes the topic in `quick-guide.html` at this position. Must be unique across all topics. |
| `steps_summary` | string | One-line collapsed form used in the user-guide TOC. If omitted, the generator uses the first sentence of `summary`. |
| `sensitive` | bool | When `true`, the bot MUST quote `summary` verbatim and not paraphrase (used for refund, legal, VAT wording). Default `false`. |

### Reserved (do not set manually)

- `id` — derived from path.
- `body_hash` — added by the generator to `knowledge.json` for change detection.

---

## Body (Markdown)

Standard CommonMark. A few conventions:

- Use `##` for sub-headings inside a topic — never `#` (the generator inserts the `<h2>` title).
- Step lists: numbered Markdown lists. The generator renders them as `<ol class="steps-list">`.
- Inline UI labels: `**bold**`. Tab names, button labels, field names.
- Arrows between steps in prose: a literal `→` character.
- Tips: blockquotes starting with `> **Tip:**`. The generator renders as `.info-box.tip`.
- Notes: blockquotes starting with `> **Note:**`. Renders as `.info-box.note`.
- Status pills: `` `status:<name>` `` inline code. Generator swaps for a `<span class="status-chip">`.
- Do not embed raw HTML unless absolutely necessary. If you do, the generator passes it through untouched and will not rewrite class names.

---

## Validation rules (enforced by generator, CI fails if broken)

1. `section` exists in `sections.yaml`.
2. `screen`, if set, matches an `AppScreen` case in `HelpService.swift`.
3. `audiences` is non-empty and only contains known surfaces.
4. `updated` is a valid ISO date, not in the future.
5. `summary` is ≥ 20 chars and ≤ 400 chars.
6. `questions[0]` ends with a question mark.
7. Every `related` entry resolves to a real topic file.
8. `quick_start_order` values are unique across the corpus.
9. No two topics in the same section share a slug.
10. The generated Swift file must compile.

---

## Example

```markdown
---
title: Create a quote
section: quotes
screen: quotes
summary: |
  Tap the Quotes tab → + → pick or add a customer → add line items → tap Send.
  Your customer gets a branded quote by email or SMS they can accept with one tap.
questions:
  - How do I create a quote?
  - How do I make a new quote?
  - How do I start a quote?
tags: [quote, create, new, add]
audiences: [user-guide, faq, quick-guide, in-app, bot]
related: [quotes.kit-bundles, quotes.send, quotes.statuses]
updated: 2026-04-17
quick_start_order: 1
---

## Steps

1. Tap the **Quotes** tab → **+** (top right).
2. Search for an existing customer or tap **New Customer** to add one on the fly.
3. Enter a job title (e.g. "Full bathroom refit"). Add a reference number if needed.
4. Tap **Add Line Item** to add labour, materials, or use a **Kit Bundle**.
5. Optionally add notes, photos or a validity expiry date.
6. Tap **Save** to keep as a draft, or **Send** to deliver immediately.

> **Tip:** Kit Bundles let you save common job packages (e.g. "Standard boiler service") and add them with a single tap. Set up bundles in **Settings → Kit Bundles**.
```

---

## Facts (marketing substitution)

`content/facts/*.yaml` holds single-source-of-truth values for everything mentioned on the marketing pages that would otherwise drift: pricing, plan names, rates, settlement days, etc. Each YAML file becomes a namespace keyed by its filename — `content/facts/pricing.yaml` resolves under `pricing.*`.

To embed a fact anywhere in a marketing HTML file or content Markdown body, wrap the current text in paired markers:

```html
<strong><!-- FACT:pricing.free.card_rate -->1.49%<!-- /FACT --></strong>
```

The generator resolves `pricing.free.card_rate` from the YAML on every run and replaces the body between the markers. Markers are retained, so the substitution is idempotent. Unresolved paths fail the build with a clear error.

Rules:

- Keep fact values short and inline — they're substituted inside sentences, not as block content.
- If a fact needs different formatting in different contexts, add a sibling field (e.g. `price`, `price_long`, `price_bare`) rather than trying to format in templates.
- Meta tags (`<meta name="description">`) and JSON-LD blocks are deliberately excluded from the substitution pass — they're infrequent edits and the risk of breaking structured data isn't worth it. Edit those by hand.
- The list of HTML files scanned for fact markers lives in `tools/generate.js` under `MARKETING_HTML_FILES`. Extend it when new pages are added.

## Why this shape

- **One summary field.** Keeps the in-app KB answer, the FAQ answer and the bot fallback phrasing identical — no copy drift.
- **Questions list.** Lets the in-app matcher and the FAQ use the same phrasings users actually type.
- **Audiences.** Explicit control over where content appears, without duplicating files.
- **Screen enum locked to Swift.** Guarantees the in-app contextual suggestions never reference a screen that no longer exists.
- **Related cross-links at the data layer.** One source of truth for the web TOC, in-app "see also", and bot context expansion.
