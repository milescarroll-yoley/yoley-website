// Marketing facts: single-source-of-truth values substituted into HTML and
// content markdown via <!-- FACT:dotted.path -->existing body<!-- /FACT -->
// markers.
//
// loadFacts(contentDir) returns a deep object keyed by filename-without-
// extension. So content/facts/pricing.yaml → facts.pricing.*
//
// substituteFacts(html, facts) replaces every FACT marker's body with the
// resolved value. Markers are preserved so the substitution is idempotent
// across generator runs.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const FACT_RE = /(<!--\s*FACT:([a-zA-Z0-9._-]+)\s*-->)([\s\S]*?)(<!--\s*\/FACT\s*-->)/g;

export function loadFacts(contentDir) {
  const factsDir = join(contentDir, 'facts');
  const facts = {};
  if (!existsSync(factsDir)) return facts;
  if (!statSync(factsDir).isDirectory()) return facts;

  for (const entry of readdirSync(factsDir)) {
    if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;
    const key = entry.replace(/\.(yaml|yml)$/, '');
    const doc = yaml.load(readFileSync(join(factsDir, entry), 'utf8'));
    facts[key] = doc ?? {};
  }
  return facts;
}

/**
 * Substitute every FACT marker in `text` with the resolved value from `facts`.
 * Returns { text, issues } so callers can fail cleanly on unresolved paths.
 * Markers retain their start/end tags — the body between them is replaced.
 */
export function substituteFacts(text, facts, { sourceLabel = '<unknown>' } = {}) {
  const issues = [];
  const out = text.replace(FACT_RE, (_, startTag, path, _oldBody, endTag) => {
    const value = resolve(facts, path);
    if (value === undefined) {
      issues.push({ sourceLabel, message: `FACT path "${path}" not found in facts/` });
      // Leave the marker intact so the author can still see what it was.
      return `${startTag}${_oldBody}${endTag}`;
    }
    return `${startTag}${value}${endTag}`;
  });
  return { text: out, issues };
}

/** Resolve a dotted path like "pricing.pro.price" against the facts object. */
function resolve(facts, path) {
  const parts = path.split('.');
  let cur = facts;
  for (const p of parts) {
    if (cur === undefined || cur === null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  if (cur === undefined || cur === null) return undefined;
  return String(cur);
}

/** Returns true if the text contains at least one FACT marker. */
export function hasFactMarkers(text) {
  return /<!--\s*FACT:/.test(text);
}
