/**
 * Build-time script to parse CHANGELOG.md into a typed JSON structure for AboutPage.tsx.
 * Offline-first: zero runtime fetches.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const changelogPath = path.join(rootDir, 'CHANGELOG.md');
const outputPath = path.join(rootDir, 'src', 'generated', 'changelog.json');

export function parseChangelog(content) {
  const lines = content.split(/\r?\n/);
  const entries = [];

  let currentEntry = null;
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match Version header, e.g.:
    // ## [1.1.0] - 2026-09-14
    // ## 1.1.0 (2026-09-14)
    // ## [1.0.0](...) (2026-08-27)
    // ## 1.0.0
    const versionMatch = line.match(
      /^##\s+\[?v?([0-9]+\.[0-9]+\.[0-9]+[a-zA-Z0-9.-]*)\]?(?:\([^)]*\))?(?:(?:\s*[-–—]\s*|\s+\(?)(?:\[?(\d{4}-\d{2}-\d{2})\]?)?\)?)/
    );

    if (versionMatch) {
      if (currentEntry) {
        if (currentSection && currentSection.items.length > 0) {
          currentEntry.sections.push(currentSection);
          currentSection = null;
        }
        entries.push(currentEntry);
      }

      currentEntry = {
        version: versionMatch[1],
        date: versionMatch[2] || '',
        sections: [],
      };
      currentSection = null;
      continue;
    }

    if (!currentEntry) continue;

    // Match Section header, e.g.: ### Features, ### Bug Fixes
    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch) {
      if (currentSection && currentSection.items.length > 0) {
        currentEntry.sections.push(currentSection);
      }
      currentSection = {
        type: sectionMatch[1].trim(),
        items: [],
      };
      continue;
    }

    // Match List items, e.g.: - Item or * Item
    const itemMatch = line.match(/^[-*]\s+(.+)$/);
    if (itemMatch) {
      if (!currentSection) {
        currentSection = {
          type: 'Changes',
          items: [],
        };
      }
      currentSection.items.push(itemMatch[1].trim());
    }
  }

  // Push final section and entry
  if (currentEntry) {
    if (currentSection && currentSection.items.length > 0) {
      currentEntry.sections.push(currentSection);
    }
    entries.push(currentEntry);
  }

  return entries;
}

export function generateChangelogJson() {
  if (!fs.existsSync(changelogPath)) {
    console.warn('[GovFormsPH] CHANGELOG.md not found at', changelogPath);
    return [];
  }

  const content = fs.readFileSync(changelogPath, 'utf8');
  const parsed = parseChangelog(content);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2), 'utf8');
  console.log(`[GovFormsPH] Successfully generated changelog JSON with ${parsed.length} entries at ${outputPath}`);
  return parsed;
}

// Execute directly if run via node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateChangelogJson();
}
