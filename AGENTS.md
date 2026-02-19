# Repository Guidelines

This project is a Tauri + React + TypeScript workspace managed with `pnpm`. Use the guidance below to stay consistent with the existing structure, tooling, and release habits.

## Project Structure & Module Organization
- Frontend lives in `src/`: `components/` for shared UI, `pages/` for routed views, `stores/` for Zustand state, `utils/` and `lib/` for helpers, `styles/` for Tailwind layering, and `live2d/` for model-specific assets. Entry points are `main.tsx` and `App.tsx`.
- Desktop shell code is under `src-tauri/` (Rust) with Tauri configs; static assets are in `public/`. Bundled output goes to `dist/` and `target/`.
- End-to-end tests sit in `e2e/` with global setup/teardown; configuration is in `playwright.config.ts`.

## Build, Test, and Development Commands
- `pnpm install` — install JS dependencies.
- `pnpm dev` — start Vite dev server for the web UI.
- `pnpm tauri dev` — run the Tauri desktop app with live reload (used by Playwright webServer).
- `pnpm build` — Vite production build to `dist/`.
- `pnpm tauri build` — produce the desktop bundle.
- `pnpm exec playwright test` — run E2E suite; artifacts land in `playwright-report/` and `test-results/`.

## Coding Style & Naming Conventions
- TypeScript everywhere; prefer functional React components and hooks. Keep modules small and co-locate component styles next to the component.
- Follow the repo ESLint config (`eslint.config.js`): ordered imports, arrow-function preference, strict async rules (`no-floating-promises`, `require-await`), `no-console` except `warn`/`error`, and React hook dependency hygiene.
- Use PascalCase for components, camelCase for functions/variables, and kebab-case for file names under `components/`, `pages/`, and `utils/`.
- Tailwind is available; keep utility classes readable and extract variants into `styles/` when they repeat.

## Testing Guidelines
- E2E testing uses Playwright (`*.spec.ts` in `e2e/`). Default base URL is `http://localhost:1420` with the Tauri dev server.
- Prefer scenario-driven specs (user journeys) over brittle UI snapshots. Name tests after the behavior under test (e.g., `voice-interaction.spec.ts`).
- For debugging, run `pnpm exec playwright test --ui` or `--project=chromium` to scope runs. Attach traces/videos on failures are enabled by default.

## Commit & Pull Request Guidelines
- Recent history uses emoji-prefixed, imperative messages with concise Chinese summaries (e.g., `🚀 修复Live2D模型切换和缩放问题`). Match that tone; keep the subject under 72 characters.
- Keep PRs scoped; include a short description, linked issue, and before/after notes or screenshots for UI-facing changes. Mention test coverage (`pnpm exec playwright test`, etc.) in the PR body.
- Avoid committing generated artifacts (`dist/`, `playwright-report/`, `test-results/`); honor `.gitignore`.

## Security & Configuration Tips
- Do not commit secrets or API keys. Prefer `.env` files outside version control and consume them via Tauri/React env wiring.
- When touching `src-tauri/`, follow Rust linting (`cargo fmt`, `cargo clippy`) before shipping; keep IPC boundaries explicit and validate payloads.
