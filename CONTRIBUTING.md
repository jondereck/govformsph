# Contributing to GovFormsPH

Thank you for your interest in contributing to **GovFormsPH**! GovFormsPH is an open-source, offline-first, privacy-first Progressive Web App (PWA) form builder created for Philippine civil servants and government workers.

---

## 🛡️ Core Rules & Philosophy

1. **Client-Side Only (Non-Negotiable):**
   - No backend servers, no cloud sync, and no third-party telemetry/analytics transmitting personal information.
   - All forms must persist in IndexedDB via `Dexie.js`.
2. **Accessible & Responsive:**
   - Light mode is default with dark mode toggle.
   - High contrast ratios (WCAG AAA/AA).
   - Responsive across mobile (375px), tablet (768px), and desktop (1024px+).
   - Zero emojis as UI icons — SVG icons only (via `lucide-react`).
3. **Official Form Verification:**
   - Form schemas must be verified against official Philippine Civil Service Commission (CSC) or government agency templates (e.g. CS Form No. 212 Revised 2026).

---

## 🏗️ Project Architecture

```
src/
├── components/
│   ├── common/         # Button, Card, Modal, DateInput, PhotoUploader, SignaturePad, etc.
│   └── layout/         # Navbar, Footer, UpdateBanner, ExportReminderBanner
├── forms/
│   └── pds/            # CS Form 212 module (Sections 1–11, Print Preview)
├── db/
│   ├── db.ts           # Dexie IndexedDB schemas & migrations
│   └── defaultPdsData.ts # Default templates & empty row factories
├── hooks/              # useTheme, usePwaInstall, useStoragePersistence
├── pages/              # Dashboard, Export/Import, Install, Privacy, About
├── types/              # TypeScript definitions for forms & app state
└── utils/              # Client-side AES-GCM crypto, date formatting, export/import
```

---

## ➕ Adding a New Form Module (e.g. SALN, DTR, Leave Application)

1. **Define Schema & Types:**
   Create a new type file in `src/types/<formType>.ts`.
2. **Update Dexie Schema:**
   Add a new table in `src/db/db.ts` under a new `db.version(N)`.
3. **Create Modular Form Directory:**
   Create `src/forms/<formType>/` containing section editors and a print-preview layout.
4. **Register in Form Catalog:**
   Add the new template to `src/pages/DashboardPage.tsx`.

---

## 🧪 Development Workflow

```bash
# Install dependencies
npm install

# Start local dev server (also regenerates changelog JSON on predev)
npm run dev

# Run TypeScript check and production build
npm run build
```

---

## 📝 Conventional Commits & Release Workflow

GovFormsPH follows the [Conventional Commits](https://www.conventionalcommits.org/) specification. All commit messages are parsed by `standard-version` to automatically determine SemVer version bumps and generate entries in `CHANGELOG.md`.

### Commit Message Format

```text
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

Common types:
- `feat:` A new user-facing feature (triggers a **minor** version bump, e.g. `1.1.0` → `1.2.0`)
- `fix:` A bug fix (triggers a **patch** version bump, e.g. `1.1.0` → `1.1.1`)
- `docs:` Documentation-only changes
- `refactor:` Code refactoring without fixing bugs or adding features
- `perf:` Performance improvements
- `chore:` Maintenance tasks, dependency updates, build tooling
- `BREAKING CHANGE:` In footer or with `!` (e.g. `feat!:`) triggers a **major** version bump (e.g. `1.1.0` → `2.0.0`)

Examples:
- `feat(wes): add Work Experience Sheet PDF export`
- `fix(pds): resolve date formatting in Item 28`
- `chore: update dependencies`

---

## 🚀 Cutting a Release

> **IMPORTANT:** Do NOT manually edit `package.json`'s version or `CHANGELOG.md` by hand.

When ready to cut a new release:

```bash
npm run release
```

This single atomic command will:
1. Review all conventional commits since the last tag.
2. Automatically bump the version in `package.json` according to SemVer rules.
3. Prepend the new release entry to `CHANGELOG.md` following Keep a Changelog formatting.
4. Commit the changes and create a matching git tag (e.g. `v1.2.0`).

After verifying the release commit and tag:
```bash
git push --follow-tags origin main
```

---

## 📄 License

By contributing to GovFormsPH, you agree that your contributions will be licensed under the [MIT License](LICENSE).

