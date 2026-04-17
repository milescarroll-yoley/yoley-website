#!/usr/bin/env node
// Generate website HTML, knowledge.json, and the iOS Swift KB from content/.
//
// Usage:
//   node tools/generate.js [--validate-only] [--ios-out <path>] [--dry-run]
//
// Outputs (relative to website/ root):
//   user-guide.html          — Quotes and other migrated sections injected
//                              between <!-- GENERATED:start ... --> markers.
//   faq.html                 — FAQ accordion groups injected between markers.
//   knowledge.json           — bundle for the /ask bot and in-app fallback.
//   dist/HelpKnowledgeBase.generated.swift
//                            — default Swift output. Override with --ios-out.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadContent } from './lib/parse.js';
import { renderUserGuideSection } from './lib/render-user-guide.js';
import { renderFaqSection } from './lib/render-faq.js';
import { renderKnowledgeJson } from './lib/render-knowledge.js';
import { renderSwiftKnowledgeBase } from './lib/render-swift.js';
import { loadFacts, substituteFacts, hasFactMarkers } from './lib/facts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBSITE_ROOT = resolve(__dirname, '..');
const CONTENT_DIR = join(WEBSITE_ROOT, 'content');
const USER_GUIDE = join(WEBSITE_ROOT, 'user-guide.html');
const FAQ = join(WEBSITE_ROOT, 'faq.html');
const KNOWLEDGE_JSON = join(WEBSITE_ROOT, 'knowledge.json');
// Default Swift output path. When running locally with YoleyApp as a sibling of
// website/ the generator writes directly into the app's Resources folder so the
// next Xcode build picks up the new KB. In CI (where YoleyApp isn't checked out
// alongside) the fallback is website/dist/, which the docs-sync workflow then
// lifts into the app repo via a cross-repo PR. Override with --ios-out.
const SIBLING_APP_RESOURCES = resolve(
  WEBSITE_ROOT,
  '..',
  'YoleyApp',
  'YoleyApp',
  'Resources',
  'HelpKnowledgeBase.generated.swift',
);
const DEFAULT_IOS_OUT = existsSync(dirname(SIBLING_APP_RESOURCES))
  ? SIBLING_APP_RESOURCES
  : join(WEBSITE_ROOT, 'dist', 'HelpKnowledgeBase.generated.swift');

function parseArgs(argv) {
  const opts = { validateOnly: false, dryRun: false, iosOut: DEFAULT_IOS_OUT };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--validate-only') opts.validateOnly = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--ios-out') opts.iosOut = resolve(argv[++i]);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node tools/generate.js [--validate-only] [--ios-out <path>] [--dry-run]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);

  const { sections, topics, issues } = loadContent(CONTENT_DIR);

  if (issues.length > 0) {
    console.error(`[generate] ${issues.length} validation issue(s):`);
    for (const i of issues) console.error(`  - ${i.file}: ${i.message}`);
    process.exit(1);
  }
  console.log(`[generate] loaded ${topics.length} topics across ${sections.length} sections`);

  if (opts.validateOnly) {
    console.log('[generate] --validate-only: nothing written');
    return;
  }

  // --- user-guide.html -------------------------------------------------------
  const userGuideReplacements = new Map();
  for (const section of sections) {
    const hasContent = topics.some(
      (t) =>
        t.sectionId === section.id &&
        Array.isArray(t.fm.audiences) &&
        t.fm.audiences.includes('user-guide'),
    );
    if (!hasContent) continue;
    const key = `surface=user-guide section=${section.id}`;
    userGuideReplacements.set(key, renderUserGuideSection(section, topics));
  }
  applyReplacements(USER_GUIDE, userGuideReplacements, { dryRun: opts.dryRun });

  // --- faq.html --------------------------------------------------------------
  const faqReplacements = new Map();
  for (const section of sections) {
    const hasContent = topics.some(
      (t) =>
        t.sectionId === section.id &&
        Array.isArray(t.fm.audiences) &&
        t.fm.audiences.includes('faq'),
    );
    if (!hasContent) continue;
    const key = `surface=faq section=${section.id}`;
    faqReplacements.set(key, renderFaqSection(section, topics));
  }
  applyReplacements(FAQ, faqReplacements, { dryRun: opts.dryRun });

  // --- knowledge.json --------------------------------------------------------
  const knowledge = renderKnowledgeJson(sections, topics);
  const knowledgeOut = JSON.stringify(knowledge, null, 2) + '\n';
  writeIfChanged(KNOWLEDGE_JSON, knowledgeOut, { dryRun: opts.dryRun });

  // --- HelpKnowledgeBase.generated.swift -------------------------------------
  const swift = renderSwiftKnowledgeBase(topics, { contentHash: knowledge.content_hash });
  writeIfChanged(opts.iosOut, swift, { dryRun: opts.dryRun });

  // --- Marketing facts substitution -----------------------------------------
  //
  // Walks a fixed set of HTML files and replaces every <!-- FACT:path -->…
  // <!-- /FACT --> marker body with the resolved value from content/facts/.
  // Idempotent: markers and their tags are preserved, only the body changes.
  const facts = loadFacts(CONTENT_DIR);
  const factIssues = [];
  for (const rel of MARKETING_HTML_FILES) {
    const abs = join(WEBSITE_ROOT, rel);
    if (!existsSync(abs)) continue;
    const before = readFileSync(abs, 'utf8');
    if (!hasFactMarkers(before)) continue;
    const { text, issues } = substituteFacts(before, facts, { sourceLabel: rel });
    factIssues.push(...issues);
    writeIfChanged(abs, text, { dryRun: opts.dryRun });
  }
  if (factIssues.length > 0) {
    console.error(`[generate] ${factIssues.length} fact resolution issue(s):`);
    for (const i of factIssues) console.error(`  - ${i.sourceLabel}: ${i.message}`);
    process.exit(1);
  }

  console.log('[generate] done');
}

// Marketing pages where fact markers may appear. Keep this list tight — the
// generator only ever rewrites files listed here. Glob expansion could make
// this prettier but an explicit list makes surprises impossible.
const MARKETING_HTML_FILES = [
  'index.html',
  'faq.html',
  'user-guide.html',
  'quick-guide.html',
  'support.html',
  'privacy-policy.html',
  'terms-of-service.html',
  'compare/yoley-vs-tradify.html',
  'compare/yoley-vs-powered-now.html',
  'compare/yoley-vs-servicem8.html',
  'compare/yoley-vs-quickbooks.html',
  'for/electricians.html',
  'for/plumbers.html',
  'for/joiners.html',
  'for/builders.html',
  'for/roofers.html',
];

/**
 * Replace the body between every `<!-- GENERATED:start … -->` / `<!-- GENERATED:end -->`
 * pair in `filePath` whose attribute string matches a key in `replacements`.
 * Markers without a matching key are left alone (e.g. for sections not yet migrated).
 * Unknown keys in `replacements` are reported as warnings.
 */
function applyReplacements(filePath, replacements, { dryRun }) {
  if (!existsSync(filePath)) {
    console.warn(`[generate] ${filePath} not found, skipping marker replacement`);
    return;
  }
  const original = readFileSync(filePath, 'utf8');
  const seen = new Set();
  const MARKER_RE = /(<!--\s*GENERATED:start\s+([^>]+?)\s*-->)([\s\S]*?)(<!--\s*GENERATED:end\s*-->)/g;

  const updated = original.replace(MARKER_RE, (whole, startTag, attrs, _body, endTag) => {
    const key = attrs.trim();
    seen.add(key);
    const next = replacements.get(key);
    if (next === undefined) {
      // No matching content — leave as-is.
      return whole;
    }
    return `${startTag}\n${next}\n${endTag}`;
  });

  for (const k of replacements.keys()) {
    if (!seen.has(k)) {
      console.warn(`[generate] ${filePath}: no marker found for "${k}"`);
    }
  }

  writeIfChanged(filePath, updated, { dryRun });
}

function writeIfChanged(path, content, { dryRun }) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    if (dryRun) console.log(`[dry-run] mkdir ${dir}`);
    else mkdirSync(dir, { recursive: true });
  }
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (existing === content) {
    console.log(`[generate] unchanged: ${short(path)}`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] would write ${short(path)} (${content.length} bytes)`);
    return;
  }
  writeFileSync(path, content);
  console.log(`[generate] wrote:     ${short(path)}`);
}

function short(p) {
  return p.startsWith(WEBSITE_ROOT + '/') ? p.slice(WEBSITE_ROOT.length + 1) : p;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
