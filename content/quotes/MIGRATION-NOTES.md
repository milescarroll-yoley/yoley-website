# Quotes migration notes (2026-04-17)

Temporary scratch file — delete once the generator is wired up and the drift is gone from source files. This records the editorial decisions made during the first content migration so the PR reviewer can sanity-check them.

## Source coverage

### HelpKnowledgeBase.swift → Quotes section (8 entries, all covered)

| Swift question | Migrated to |
|---|---|
| How do I create a quote? | `create.md` |
| How do I send a quote to a customer? | `send.md` |
| How does manual quote approval work? | `manual-approval.md` |
| Can I record a verbal approval by phone? | `approval-phone.md` |
| Can I record approval given by text or WhatsApp? | `approval-text.md` |
| What do the quote statuses mean? | `statuses.md` |
| What are kit bundles? | `kit-bundles.md` |
| Do quote comments carry through to the invoice? | `comments-to-invoice.md` |

### user-guide.html → Quotes section (fully covered)

| HTML heading | Migrated to |
|---|---|
| Section intro | `_section.md` |
| Creating a Quote (6 steps) | `create.md` |
| Quote Statuses table | `statuses.md` |
| Manually Approving a Quote (5 steps) | `manual-approval.md` |
| Sending a Quote (Email/SMS/Share Link) | `send.md` |
| Kit Bundles tip | `kit-bundles.md` + inline tip on `create.md` |

### faq.html → Quotes category

| FAQ question | Migrated to |
|---|---|
| How do I create and send a quote? | `create.md` |
| Can I approve a quote on behalf of a customer? | `manual-approval.md` |
| What do the different quote statuses mean? | `statuses.md` |
| What are Kit Bundles? | `kit-bundles.md` |
| Does the comment I add when approving a quote carry into the job? | `comments-to-invoice.md` |
| How do I convert a quote to an invoice? | `convert-to-invoice.md` |
| Can I raise an invoice without a quote? | **Deferred** — belongs in `invoices/` migration |
| How do I schedule a job from a quote? | **Deferred** — belongs in `job-diary/` migration |
| Can I schedule a job without a quote? | **Deferred** — belongs in `job-diary/` migration |

### quick-guide.html → Quotes-related tasks

| Quick-guide task | Migrated to |
|---|---|
| Task 1: Send a Professional Quote | `create.md` with `quick_start_order: 1` |
| Task 2: Convert a Quote to Invoice | `convert-to-invoice.md` with `quick_start_order: 2` |

## Intentional drift decisions (website wins)

The iOS `HelpKnowledgeBase.swift` had diverged from the website copy. Since the website reflects the current UI per `user-guide.html`, it's authoritative for this migration. The generator will regenerate the Swift file, which will fix the drift on the next build.

1. **Quote statuses.** Swift KB said `Draft / Sent / Approved / Declined / Expired`. Website/UI says `Draft / Sent / Opened / Accepted / Declined / Expired`. Used the website list.
2. **Button label.** Swift KB said `Approve on Behalf`. Website/UI says `Manually Approve`. Used `Manually Approve`.
3. **Approval method labels.** Swift KB said `Phone Call / Text/WhatsApp / Email / Other`. Website says `Phone / Text / Email / Other`. Used the website labels.

If any of these are actually iOS-app-authoritative (i.e. the website is the one that's stale), update the relevant topic and flag it on the PR — the generator will still produce a consistent pair.

## Deferred to other section migrations

- `invoices.create-standalone` (from FAQ "Can I raise an invoice without a quote?")
- `job-diary.schedule-from-quote` (from FAQ and user-guide Job Diary section)
- `job-diary.schedule-new-job` (from FAQ "Can I schedule a job without a quote?")
- `job-diary.approve-from-diary` (from user-guide "Approving a Quote from the Job Diary")
