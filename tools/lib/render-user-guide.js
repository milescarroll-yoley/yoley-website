// Render a section of the user guide.
//
// Input: section def (from sections.yaml), section-intro topic (optional), topics array.
// Output: HTML fragment to drop between user-guide.html generator markers.
//
// Shape matches the existing hand-written sections in user-guide.html:
//   <h2><span class="section-icon">…</span> Title</h2>
//   <p class="section-intro">…</p>
//   <h3>Topic title</h3>
//   <body html>
//   …

import { renderBody } from './render-html.js';
import { topicsBySection, sectionIntro } from './parse.js';

export function renderUserGuideSection(section, allTopics) {
  const lines = [];
  const intro = sectionIntro(allTopics, section.id);

  lines.push(`<h2><span class="section-icon">${section.icon ?? ''}</span> ${escapeHtml(section.title)}</h2>`);

  const introSummary = intro?.fm?.summary?.trim() || section.summary;
  if (introSummary) {
    lines.push(`<p class="section-intro">${escapeInline(introSummary)}</p>`);
  }

  if (intro?.body?.trim()) {
    // Intro body may contain a link paragraph; keep headings offset so any `##`
    // it contains lands at h4 inside the section.
    lines.push(renderBody(intro.body, { headingOffset: 2 }));
  }

  const topics = topicsBySection(allTopics, section.id)
    .filter((t) => Array.isArray(t.fm.audiences) && t.fm.audiences.includes('user-guide'));

  for (const topic of topics) {
    lines.push(`<h3>${escapeHtml(topic.fm.title)}</h3>`);
    // Body `##` → <h4> because topic title is <h3>.
    lines.push(renderBody(topic.body, { headingOffset: 2 }));
  }

  return lines.filter(Boolean).join('\n\n');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

// Like escapeHtml but preserves simple inline tags that authors sometimes put in
// `summary` (e.g. <strong>, <em>, <a>). We escape & and stray brackets but leave
// any balanced tag alone — summaries are authored, not user input.
function escapeInline(s) {
  // Minimal: just return as-is. summary is trusted authored content.
  return String(s ?? '');
}
