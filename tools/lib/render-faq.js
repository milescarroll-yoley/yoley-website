// Render a section's FAQ accordion.
//
// Input: section def, topics array.
// Output: HTML fragment matching the structure used by faq.html:
//
//   <div class="faq-group" data-category="quotes">
//     <div class="faq-group-title">📝 Quotes</div>
//     <div class="faq-item">
//       <div class="faq-question">How do I create a quote? <span class="faq-chevron">▼</span></div>
//       <div class="faq-answer"><div class="faq-answer-inner">
//         <p>answer paragraphs…</p>
//       </div></div>
//     </div>
//     …
//   </div>

import { marked } from 'marked';
import { topicsBySection } from './parse.js';

export function renderFaqSection(section, allTopics) {
  const topics = topicsBySection(allTopics, section.id)
    .filter((t) => Array.isArray(t.fm.audiences) && t.fm.audiences.includes('faq'));

  if (topics.length === 0) return '';

  const items = topics.map((t) => renderFaqItem(t)).join('\n\n');

  return [
    `<div class="faq-group" data-category="${escapeAttr(section.id)}">`,
    `  <div class="faq-group-title">${section.icon ?? ''} ${escapeHtml(section.title)}</div>`,
    '',
    indent(items, 2),
    '',
    '</div>',
  ].join('\n');
}

function renderFaqItem(topic) {
  const question = (topic.fm.questions?.[0] ?? topic.fm.title ?? '').toString().trim();
  // Summary is the canonical short answer. marked.parse handles multi-paragraph YAML.
  const answerHtml = marked.parse((topic.fm.summary ?? '').toString().trim());

  return [
    '<div class="faq-item">',
    `  <div class="faq-question">${escapeHtml(question)} <span class="faq-chevron">&#9660;</span></div>`,
    '  <div class="faq-answer"><div class="faq-answer-inner">',
    indent(answerHtml.trim(), 4),
    '  </div></div>',
    '</div>',
  ].join('\n');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}
function escapeAttr(s) {
  return String(s ?? '').replace(/["&<>]/g, (c) => ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}
function indent(s, n) {
  const pad = ' '.repeat(n);
  return s
    .split('\n')
    .map((l) => (l.length ? pad + l : l))
    .join('\n');
}
