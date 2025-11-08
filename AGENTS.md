# Repository Guidelines

## Project Structure & Module Organization
- `src/main/**` hosts the Electron main process: database init, IPC handlers, and services (e.g., `src/main/services/contractService.ts`).
- `src/renderer/**` contains the Vue 3 UI, with Pinia stores under `src/renderer/src/stores` and views/components grouped by feature.
- Shared cross-process types live in `src/shared/**`. Keep renderer-only typings inside `src/renderer/src/types`.
- Assets such as icons reside in `resources/`, and database docs are under `doc/`.

## Build, Test, and Development Commands
- `npm run dev` – launches the electron-vite dev server with live reload for renderer + main processes.
- `npm run typecheck` – runs both `tsc` (main/preload) and `vue-tsc` (renderer) with `--noEmit`; required before PRs.
- `npm run build` – produces production bundles via electron-vite/electron-builder.

## Coding Style & Naming Conventions
- TypeScript everywhere; keep files in ASCII unless the feature demands localized text.
- Prefer composables + `<script setup>` in Vue components. Use 2-space indentation and trailing commas.
- Name IPC channels with the `area:action` pattern (e.g., `contracts:list`). Service functions use verbs (`fetchAllContracts`).
- Run ESLint via `npm run lint` (when added) before committing; formatters mirror the TypeScript defaults.

## Testing Guidelines
- Type safety acts as the first gate; add Vitest specs under `src/renderer/src/__tests__` (or equivalent) once behavior stabilizes.
- Database/service logic should include integration tests hitting the SQLite file in a temp directory when feasible.
- Name test files `<feature>.spec.ts` and colocate near the code for easier maintenance.

## Commit & Pull Request Guidelines
- Follow the conventional commits style seen in history (`feat:`, `fix:`, `chore:`). Scope with the package when useful (`feat(renderer):`).
- Commits should be focused; avoid bundling unrelated refactors with feature work.
- PRs must include: summary of changes, testing evidence (`npm run typecheck`, unit tests), screenshots/GIFs for UI tweaks, and references to tracked issues.

## Security & Configuration Tips
- Never access the filesystem directly from the renderer; route through IPC + preload APIs.
- Database writes belong in `src/main/services/**` wrapped in transactions. Untrusted input must be validated before persistence.

## 沟通与协作要求
- 所有讨论与代码注释优先使用中文，确保团队成员无语言障碍。
- 对不确定或缺失的信息不要预设结论，直接向需求方确认后再推进。
- 使用根目录的 `TODO.md` 记录计划与任务状态（可用 Markdown 复选框），每次开始或完成工作都在该文件更新，保持项目规划透明。
