// Load and validate the content/ tree.
//
// Exports:
//   loadContent(contentDir) → { sections, topics, issues }
//     sections: ordered array of section defs from sections.yaml
//     topics:   array of parsed topics (each with id, section, title, fm, body, sourcePath)
//     issues:   validation errors. Non-empty → generator should abort.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';

const KNOWN_AUDIENCES = new Set(['user-guide', 'faq', 'quick-guide', 'in-app', 'bot']);

// Keep this set in sync with AppScreen in HelpService.swift. The parser
// cross-checks it; the CI surfaces drift as a validation error.
const KNOWN_SCREENS = new Set([
  'quotes',
  'invoices',
  'expenses',
  'jobDiary',
  'customers',
  'payments',
  'settings',
]);

const TODAY = new Date().toISOString().slice(0, 10);

export function loadContent(contentDir) {
  const issues = [];

  // --- sections.yaml ---------------------------------------------------------
  let sectionsDoc;
  try {
    sectionsDoc = yaml.load(readFileSync(join(contentDir, 'sections.yaml'), 'utf8'));
  } catch (err) {
    issues.push({ file: 'sections.yaml', message: `failed to parse: ${err.message}` });
    return { sections: [], topics: [], issues };
  }

  const sections = Array.isArray(sectionsDoc?.sections) ? sectionsDoc.sections : [];
  if (sections.length === 0) {
    issues.push({ file: 'sections.yaml', message: 'no sections defined' });
  }
  const sectionIds = new Set(sections.map((s) => s.id));
  sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // --- walk content/** for .md files ----------------------------------------
  const topics = [];
  for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sectionDir = join(contentDir, entry.name);
    const sectionId = entry.name;

    for (const file of readdirSync(sectionDir)) {
      if (!file.endsWith('.md')) continue;
      if (file === 'MIGRATION-NOTES.md') continue;
      const filePath = join(sectionDir, file);
      const sourcePath = relative(contentDir, filePath);
      const isSectionIntro = file === '_section.md';
      const slug = isSectionIntro ? '_section' : basename(file, '.md');
      const id = isSectionIntro ? `${sectionId}._section` : `${sectionId}.${slug}`;

      let parsed;
      try {
        parsed = matter(readFileSync(filePath, 'utf8'));
      } catch (err) {
        issues.push({ file: sourcePath, message: `failed to parse front-matter: ${err.message}` });
        continue;
      }

      topics.push({
        id,
        slug,
        sectionId,
        isSectionIntro,
        sourcePath,
        fm: parsed.data ?? {},
        body: parsed.content ?? '',
      });
    }
  }

  // --- per-topic validation --------------------------------------------------
  const topicIds = new Set(topics.map((t) => t.id));
  const seenQuickStart = new Map();

  for (const t of topics) {
    const fm = t.fm;
    const here = (msg) => issues.push({ file: t.sourcePath, message: msg });

    // Required fields
    for (const field of ['title', 'section', 'summary', 'questions', 'tags', 'audiences', 'updated']) {
      if (fm[field] === undefined || fm[field] === null || fm[field] === '') {
        here(`missing required field: ${field}`);
      }
    }

    // section must match folder and exist in sections.yaml
    if (fm.section && fm.section !== t.sectionId) {
      here(`front-matter section "${fm.section}" doesn't match folder "${t.sectionId}"`);
    }
    if (fm.section && !sectionIds.has(fm.section)) {
      here(`section "${fm.section}" not registered in sections.yaml`);
    }

    // screen must be a known AppScreen case
    if (fm.screen !== undefined && !KNOWN_SCREENS.has(fm.screen)) {
      here(`unknown screen "${fm.screen}" — must be one of ${[...KNOWN_SCREENS].join(', ')}`);
    }

    // audiences
    if (fm.audiences !== undefined) {
      if (!Array.isArray(fm.audiences) || fm.audiences.length === 0) {
        here('audiences must be a non-empty list');
      } else {
        for (const a of fm.audiences) {
          if (!KNOWN_AUDIENCES.has(a)) {
            here(`unknown audience "${a}"`);
          }
        }
      }
    }

    // updated
    if (typeof fm.updated === 'string') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.updated)) {
        here(`updated "${fm.updated}" is not ISO YYYY-MM-DD`);
      } else if (fm.updated > TODAY) {
        here(`updated "${fm.updated}" is in the future`);
      }
    } else if (fm.updated instanceof Date) {
      // js-yaml may parse as Date — coerce to ISO date string in place
      t.fm.updated = fm.updated.toISOString().slice(0, 10);
    } else if (fm.updated !== undefined) {
      here(`updated must be an ISO date string`);
    }

    // summary length
    if (typeof fm.summary === 'string') {
      const s = fm.summary.trim();
      if (s.length < 20) here(`summary too short (${s.length} chars, min 20)`);
      if (s.length > 400) here(`summary too long (${s.length} chars, max 400)`);
    }

    // questions[0] ends with "?"
    if (Array.isArray(fm.questions) && fm.questions.length > 0) {
      const q0 = String(fm.questions[0]).trim();
      if (!q0.endsWith('?')) {
        here(`questions[0] must end with "?": "${q0}"`);
      }
    } else if (fm.questions !== undefined) {
      here('questions must be a non-empty list');
    }

    // related entries must resolve
    if (Array.isArray(fm.related)) {
      for (const rel of fm.related) {
        if (!topicIds.has(rel)) {
          here(`related id "${rel}" doesn't resolve to a topic`);
        }
      }
    }

    // quick_start_order unique
    if (fm.quick_start_order !== undefined) {
      if (!Number.isInteger(fm.quick_start_order)) {
        here(`quick_start_order must be an integer`);
      } else {
        const already = seenQuickStart.get(fm.quick_start_order);
        if (already) {
          here(`quick_start_order ${fm.quick_start_order} already used by ${already}`);
        } else {
          seenQuickStart.set(fm.quick_start_order, t.id);
        }
      }
    }

    // order (within section, integer, optional)
    if (fm.order !== undefined && !Number.isInteger(fm.order)) {
      here(`order must be an integer`);
    }

    // tags must be a list of lowercase strings
    if (Array.isArray(fm.tags)) {
      for (const tag of fm.tags) {
        if (typeof tag !== 'string' || tag !== tag.toLowerCase()) {
          here(`tag "${tag}" must be a lowercase string`);
        }
      }
    } else if (fm.tags !== undefined) {
      here('tags must be a list');
    }
  }

  // --- unique slug per section ----------------------------------------------
  const seenSlug = new Map();
  for (const t of topics) {
    const key = `${t.sectionId}/${t.slug}`;
    if (seenSlug.has(key)) {
      issues.push({
        file: t.sourcePath,
        message: `duplicate slug "${t.slug}" in section "${t.sectionId}" (also defined by ${seenSlug.get(key)})`,
      });
    } else {
      seenSlug.set(key, t.sourcePath);
    }
  }

  return { sections, topics, issues };
}

export function topicsForAudience(topics, audience) {
  return topics.filter((t) => Array.isArray(t.fm.audiences) && t.fm.audiences.includes(audience));
}

export function topicsBySection(topics, sectionId) {
  return topics
    .filter((t) => t.sectionId === sectionId && !t.isSectionIntro)
    .sort(compareTopics);
}

function compareTopics(a, b) {
  const ao = Number.isInteger(a.fm.order) ? a.fm.order : Number.POSITIVE_INFINITY;
  const bo = Number.isInteger(b.fm.order) ? b.fm.order : Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  return String(a.fm.title ?? '').localeCompare(String(b.fm.title ?? ''));
}

export function sectionIntro(topics, sectionId) {
  return topics.find((t) => t.sectionId === sectionId && t.isSectionIntro);
}
