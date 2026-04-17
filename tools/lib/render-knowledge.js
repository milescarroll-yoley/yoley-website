// Emit knowledge.json — the bundle served to the website /ask bot and pulled by
// the in-app HelpService at launch for hot-updatable help content.
//
// Shape:
//   {
//     "version": "2026-04-17T12:34:56Z",
//     "content_hash": "sha256:…",        // hash across all included topic bodies + summaries
//     "sections": [ { id, title, order } ],
//     "topics": [
//       {
//         "id": "quotes.create",
//         "section": "quotes",
//         "title": "…",
//         "screen": "quotes",             // optional
//         "summary": "…",
//         "questions": ["…"],
//         "tags": ["…"],
//         "related": ["…"],
//         "updated": "2026-04-17",
//         "since_version": "1.0.0",       // optional
//         "sensitive": false,
//         "body_markdown": "## Steps\n\n1. …",
//         "body_hash": "sha256:…"
//       }
//     ]
//   }
//
// Consumers filter by `audiences` upstream; this file contains only topics whose
// audiences list included "bot". A second bundle for "in-app" could be generated
// if its shape diverges — for now both surfaces consume the same JSON.

import { createHash } from 'node:crypto';
import { topicsForAudience } from './parse.js';

export function renderKnowledgeJson(sections, topics) {
  const bot = topicsForAudience(topics, 'bot');

  const outTopics = bot.map((t) => {
    const body = t.body ?? '';
    const body_hash = 'sha256:' + createHash('sha256').update(body).digest('hex');
    const entry = {
      id: t.id,
      section: t.sectionId,
      title: t.fm.title,
      summary: String(t.fm.summary ?? '').trim(),
      questions: t.fm.questions ?? [],
      tags: t.fm.tags ?? [],
      related: t.fm.related ?? [],
      updated: t.fm.updated,
      sensitive: Boolean(t.fm.sensitive),
      body_markdown: body,
      body_hash,
    };
    if (t.fm.screen) entry.screen = t.fm.screen;
    if (t.fm.since_version) entry.since_version = t.fm.since_version;
    return entry;
  });

  // Sort deterministically so the output is stable and reviewable in diffs.
  outTopics.sort((a, b) => a.id.localeCompare(b.id));

  const content_hash =
    'sha256:' +
    createHash('sha256')
      .update(outTopics.map((t) => `${t.id}|${t.body_hash}|${t.summary}`).join('\n'))
      .digest('hex');

  // version derives from content: a stable 12-char prefix of the hash. Clients
  // check for a version change to know when to refresh their cached bundle.
  const version = content_hash.replace('sha256:', '').slice(0, 12);

  // Latest updated date across included topics — useful for human-readable
  // freshness checks, still deterministic.
  const latestUpdated = outTopics
    .map((t) => t.updated)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    version,
    latest_updated: latestUpdated ?? null,
    content_hash,
    sections: sections.map((s) => ({ id: s.id, title: s.title, order: s.order })),
    topics: outTopics,
  };
}
