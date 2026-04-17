// Emit HelpKnowledgeBase.generated.swift — the in-app matcher's data source.
//
// Output shape:
//
//   // GENERATED FROM content/ — DO NOT EDIT
//   // Generated at: 2026-04-17T…
//   // Source content hash: sha256:…
//
//   import Foundation
//
//   extension HelpKnowledgeBase {
//       static let generatedEntries: [HelpEntry] = [
//           HelpEntry(
//               tags: ["quote", "create"],
//               question: "How do I create a quote?",
//               answer: "Tap the Quotes tab…",
//               relatedScreen: .quotes
//           ),
//           …
//       ]
//   }
//
// HelpService.swift is responsible for wiring `generatedEntries` into the
// existing `entries` array (or replacing it). That wiring is a one-time edit —
// this generator owns the content only.

import { topicsForAudience } from './parse.js';

export function renderSwiftKnowledgeBase(topics, { contentHash }) {
  const entries = topicsForAudience(topics, 'in-app').sort((a, b) => a.id.localeCompare(b.id));
  const header = [
    '// GENERATED FROM content/ — DO NOT EDIT',
    `// Source content hash: ${contentHash}`,
    '',
    'import Foundation',
    '',
    'extension HelpKnowledgeBase {',
    '',
    '    /// Entries generated from content/. Wire into `HelpKnowledgeBase.entries` via HelpService.swift.',
    '    static let generatedEntries: [HelpEntry] = [',
  ];

  const body = entries.map(renderEntry).join(',\n');

  const footer = ['    ]', '}', ''];

  return header.join('\n') + '\n' + body + '\n' + footer.join('\n');
}

function renderEntry(topic) {
  const tags = (topic.fm.tags ?? []).map(swiftString).join(', ');
  const question = swiftString(topic.fm.questions?.[0] ?? topic.fm.title ?? '');
  const answer = swiftString(String(topic.fm.summary ?? '').trim());
  const screen = topic.fm.screen ? `.${topic.fm.screen}` : 'nil';

  return [
    '        HelpEntry(',
    `            tags: [${tags}],`,
    `            question: ${question},`,
    `            answer: ${answer},`,
    `            relatedScreen: ${screen}`,
    '        )',
  ].join('\n');
}

/** Produce a valid Swift string literal, preserving multi-line summaries. */
function swiftString(s) {
  const escaped = String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}
