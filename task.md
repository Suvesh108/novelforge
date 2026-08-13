# NovelForge Task List

- [x] Initialize monorepo structure
    - [x] Create root `package.json` and install dev dependencies
    - [x] Initialize TypeScript config `tsconfig.json`
- [x] Set up database
    - [x] Define Prisma schema in `prisma/schema.prisma`
    - [x] Run migrations and generate Prisma Client (SQLite)
- [x] Implement backend server (`/server`)
    - [x] Build Express base server in `/server/src/index.ts`
    - [x] Build AI provider abstraction in `/server/src/ai/providers.ts`
    - [x] Build modular Prompt assembler in `/server/src/prompts/assembler.ts`
    - [x] Implement chapter/novel endpoints and continuity auto-summarizer
    - [x] Build export endpoints (PDF, DOCX, EPUB) in `/server/src/export/exporter.ts`
- [x] Initialize frontend (`/client`)
    - [x] Scaffold Vite + React + TypeScript + Tailwind CSS
    - [x] Set up Zustand store in `/client/src/store.ts`
- [x] Develop frontend components
    - [x] Create Guided Setup flow questionnaire
    - [x] Create Story Bible display & editor
    - [x] Create Chapter Editor with sidebar and AI panel
    - [x] Integrate download and dashboard metrics
- [x] Verification
    - [x] Run build and confirm compile passes
    - [x] Test the AI prompt assembly and streaming connection
    - [x] Verify exports (chapter PDF, full combined PDF, DOCX, EPUB)

## PDF Alignment Enhancements
- [x] Implement backend Chapter CRUD & Versioning API endpoints
- [x] Integrate Writing Mode parameters into AI prompts
- [x] Add Zustand store actions for CRUD, reordering, versions, and writing modes
- [x] Develop Editor sidebar CRUD buttons and order controls
- [x] Develop Editor version dropdown selector
- [x] Add Writing Mode selector and extended AI actions to Editor sidepanel
- [x] Verify build and compile passes
