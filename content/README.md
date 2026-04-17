# Yoley Content

Source of truth for all Yoley help content — website guides, website AI bot, in-app help agent. See `SCHEMA.md` for the full authoring spec.

## Quick authoring flow

1. Find the right section folder (e.g. `content/quotes/`) or add a new one under `content/` and register it in `sections.yaml`.
2. Create a `<slug>.md` file. Copy the front-matter template from the Example in `SCHEMA.md`.
3. Fill out the required fields: `title`, `section`, `summary`, `questions`, `tags`, `audiences`, `updated`.
4. Write the body in plain Markdown. Keep it focused — one topic per file.
5. Commit. The CI (when wired up) will regenerate the HTML guides, the `knowledge.json` bundle, and the Swift `HelpKnowledgeBase.generated.swift`, then open a PR against `YoleyApp`.

## The three downstream artefacts

| Artefact | What it feeds | Consumed by |
|---|---|---|
| `user-guide.html`, `faq.html`, `quick-guide.html` | Public website | Tradespeople browsing the site. |
| `knowledge.json` | Website `/ask` bot + in-app `HelpService` Claude fallback | Runtime retrieval, hot-updatable without an app release. |
| `HelpKnowledgeBase.generated.swift` | Shipped inside the iOS app for offline matching | The `findBestMatch(for:)` matcher used before hitting the API. |

## What to edit where

- **Fact or step changed** → edit the relevant topic's `summary` and body.
- **New question users are asking** → add to `questions` array of the closest topic, or create a new topic.
- **New UI screen added to the app** → add to the `AppScreen` enum in `HelpService.swift` first, then add to `sections.yaml`, then start authoring topics.
- **Renaming a button in the app** → grep `content/` for the old label, update each hit. The validator will flag Swift drift.

## What NOT to edit

- Anything under `website/` that isn't in `content/` — the root-level HTML files are regenerated and will be overwritten.
- `HelpKnowledgeBase.generated.swift` in `YoleyApp` — also regenerated; edits will be lost.
