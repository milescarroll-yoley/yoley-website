// Markdown → HTML with Yoley conventions.
//
// renderBody(markdown, { headingOffset }) returns an HTML fragment.
//
// Conventions implemented (see SCHEMA.md):
//   > **Tip:** ...      → <div class="info-box tip">💡 <span>...</span></div>
//   > **Note:** ...     → <div class="info-box note">🔒 <span>...</span></div>
//   `status:accepted` X → <span class="status-chip status-accepted">X</span>
//   <ol>                → <ol class="steps-list"> with <span class="step-num">N</span>
//   <table>             → <table class="feature-table">
//   Heading levels are offset by `headingOffset` (default 1), so a topic body's
//   `## Sub-heading` renders as <h3> inside the topic's <h3> ... i.e. the caller
//   controls the correct depth.

import { marked } from 'marked';
import { substituteFacts } from './facts.js';

marked.setOptions({ headerIds: false, mangle: false, gfm: true });

/**
 * @param {string} md
 * @param {{headingOffset?: number, facts?: object, sourceLabel?: string}} opts
 */
export function renderBody(md, { headingOffset = 1, facts, sourceLabel } = {}) {
  let html = marked.parse(md || '');

  if (facts) {
    const { text } = substituteFacts(html, facts, { sourceLabel });
    html = text;
  }

  // 1) Offset heading levels. Body `##` (h2) becomes h{2+offset}.
  if (headingOffset !== 0) {
    html = html.replace(/<(\/?)h([1-6])>/g, (_, slash, n) => {
      const target = Math.min(6, Math.max(1, parseInt(n, 10) + headingOffset));
      return `<${slash}h${target}>`;
    });
  }

  // 2) Tip / Note blockquotes.
  // marked emits: <blockquote>\n<p><strong>Tip:</strong> rest…</p>\n</blockquote>
  html = html.replace(
    /<blockquote>\s*<p><strong>Tip:<\/strong>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/g,
    (_, inner) => `<div class="info-box tip">&#128161; <span>${inner.trim()}</span></div>`,
  );
  html = html.replace(
    /<blockquote>\s*<p><strong>Note:<\/strong>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/g,
    (_, inner) => `<div class="info-box note">&#128274; <span>${inner.trim()}</span></div>`,
  );

  // 3) Status pills.
  // `status:accepted` Accepted → <span class="status-chip status-accepted">Accepted</span>
  // Matches the status code followed by a single capitalized label word. If a
  // multi-word label is needed (e.g. "Partially Paid"), extend the label regex
  // or promote to a block syntax.
  html = html.replace(
    /<code>status:([a-z0-9-]+)<\/code>\s+([A-Z][A-Za-z]*)/g,
    (_, slug, label) => `<span class="status-chip status-${slug}">${label}</span>`,
  );

  // 4) Step lists. Top-level <ol> gets the `steps-list` class and numbered spans.
  html = html.replace(/<ol>([\s\S]*?)<\/ol>/g, (_, inner) => {
    let n = 0;
    const withNums = inner.replace(/<li>/g, () => `<li><span class="step-num">${++n}</span>`);
    return `<ol class="steps-list">${withNums}</ol>`;
  });

  // 5) Tables.
  html = html.replace(/<table>/g, '<table class="feature-table">');

  return html.trim();
}
