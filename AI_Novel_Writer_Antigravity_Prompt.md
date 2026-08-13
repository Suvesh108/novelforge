# Antigravity Build Prompt — AI Novel Writing Web App ("NovelForge")

## HOW TO USE THIS PROMPT
Paste this entire document into Antigravity as the master build prompt. Work through phases **in order**. At the end of each phase, stop, show me what was built, and wait for my review/approval before starting the next phase. Do not skip ahead. Treat each phase as a checkpoint in a loop: build → self-review against the phase's acceptance criteria → report → wait for go-ahead.

---

## 0. PROJECT SUMMARY

Build **NovelForge**, a professional AI-assisted long-form novel writing web app. A user starts from a small story idea, answers an adaptive AI-driven questionnaire, gets a structured Story Bible (characters, world, magic system, arcs), approves a full chapter outline, then generates the novel chapter-by-chapter with the AI maintaining continuity (character state, world state, open plot threads) across the whole book. The app must feel like a professional writing tool (Notion/Google Docs/novel-software hybrid), not a chatbot.

**Critical requirement from me (in addition to the attached spec):** every chapter must be downloadable as its own standalone PDF, AND there must be a "Combine All Chapters" export that merges all chapter PDFs (in correct order, with a title page and table of contents) into one full-novel PDF. This export system is its own dedicated module — build it carefully, see Phase 9.

---

## 1. TECH STACK (do not deviate without telling me why)

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Zustand (state) + React Router
- **Backend:** Node.js + Express + TypeScript
- **Database:** SQLite via Prisma ORM for local/dev (schema written so it's a one-line swap to Postgres later)
- **LLM calls:** ALWAYS from the backend. Never expose API keys to the frontend.
- **PDF generation:** `pdfkit` (or `@react-pdf/renderer` on the backend) for generating clean, styled chapter PDFs from scratch (not HTML screenshots — this needs to look like a real book page: proper margins, chapter title, drop cap optional, page numbers). Use `pdf-lib` to merge/combine individual chapter PDFs into the full-novel PDF and to add a generated title page + table of contents with page numbers.
- **DOCX export:** `docx` npm package
- **EPUB export:** `epub-gen` or `epub-gen-memory`
- **Markdown/TXT export:** plain string generation, no library needed

Before writing any code, inspect whether a project already exists at the target path. If this is a fresh folder, scaffold cleanly. If there's existing structure, adapt to it and tell me what you found instead of overwriting.

---

## 2. DATA MODEL (Prisma schema — build this first, Phase 1)

Design tables/models for:
- `Novel` (id, title, genre, subgenre, tone[], premise, themes[], status, createdAt, updatedAt, providerSettings JSON)
- `MainCharacter` (all fields from spec section 2A — name, age, gender, personality, appearance, background, family, occupation, skills, strengths, weaknesses, goals, fears, motivation, characterDevelopment, specialAbilities, secrets, relationships — all nullable/optional)
- `ImportantCharacter` (same shape as spec section 5, linked to Novel, with `role`, `relationshipToProtagonist`, `importanceToStory`)
- `World` (spec section 2B fields — worldName, worldType, era, techLevel, geography, politicalStructure, socialStructure, economy, religion, culture, races[], languages[], importantLocations[], history, majorConflicts)
- `MagicSystem` (spec section 2C — source, elements[], mana rules, levels, restrictions, costs, spells[], magicalCreatures[], rareAbilities[])
- `StoryRequirements` (freeform "things I want" text, "things I don't want" text, minImportantCharacters int)
- `ChapterConfig` (totalChapters, lengthMode enum[short/medium/long/custom], targetWordCount, audioDurationMinutes, speakingSpeedWPM)
- `StoryBible` (generated JSON blob covering basic info, arcs[], relationship map, timeline[] — editable by user)
- `ChapterOutline` (chapterNumber, title, location, time, charactersAppearing[], mainEvents[], emotionalPurpose, importantDialogueMoments[], characterDevelopmentNotes, foreshadowing, endingHook, estimatedWordCount)
- `Chapter` (chapterNumber, title, content, wordCount, status[outline/drafted/edited/final], currentVersionId)
- `ChapterVersion` (chapterId, versionNumber, content, createdAt, generationMode) — never overwrite, always append a version
- `ChapterSummary` (chapterId, summaryText)
- `CharacterState` (chapterId, characterId, location, age, relationships JSON, knowledge[], injuries[], possessions[], abilities[], emotionalState, keyDecisions[])
- `WorldState` (chapterId, politicalChanges[], newLocations[], discoveries[], conflicts[], techChanges[], magicDiscoveries[])
- `OpenThread` (novelId, type[mystery/promise/conflict/foreshadowing/goal], description, status[open/resolved], resolvedInChapterId)
- `ProviderSettings` (provider enum[gemini/openai/openrouter/custom], apiKeyRef, model, temperature, maxOutputTokens, systemPromptOverride, contextSizeLimit)

Acceptance criteria for Phase 1: `npx prisma migrate dev` runs clean, schema file reviewed by me before moving on.

---

## 3. AI PROVIDER ABSTRACTION LAYER (Phase 2)

Build:
```
/server/src/ai/
  AIProvider.ts          <- interface: generate(prompt, opts), streamGenerate(prompt, opts)
  GeminiProvider.ts
  OpenAIProvider.ts
  OpenRouterProvider.ts
  CustomProvider.ts       <- generic OpenAI-compatible endpoint
  ProviderFactory.ts      <- picks provider based on ProviderSettings
```
- All providers implement the same interface so the rest of the app never knows which LLM is behind it.
- API keys stored server-side only (env var or encrypted in DB), never sent to frontend.
- Support streaming responses to the frontend via SSE or chunked responses for chapter generation (so the user sees text appear as it's written).
- Build a Settings UI page where the user picks provider, model, temperature, max tokens, system prompt override, context size limit.

Acceptance criteria: a test endpoint that sends "say hello" to whichever provider is configured and returns the response, provider swappable via UI without code changes.

---

## 4. PROMPT ARCHITECTURE (Phase 3)

Do NOT build one giant prompt string. Build a prompt assembler that composes labeled sections only when relevant to the current task:

```
/server/src/prompts/
  sections/
    systemInstructions.ts
    writingStyle.ts
    storyBible.ts
    characterBible.ts
    worldBible.ts
    magicSystem.ts
    timeline.ts
    previousChapterSummary.ts
    currentCharacterStates.ts
    openStoryThreads.ts
    currentChapterOutline.ts
    userRequirements.ts   <- "things I want" / "things I don't want"
    restrictions.ts
    outputRequirements.ts
  assemblePrompt.ts        <- takes a task type + context, returns only the needed sections
```

Task types that need different section combos:
- `QUESTIONNAIRE` — minimal: just what's known so far, to decide next question
- `GENERATE_STORY_BIBLE` — premise, characters, world, requirements, restrictions
- `GENERATE_CHAPTER_OUTLINE` — story bible, arcs, chapter config
- `GENERATE_CHAPTER` — full context per spec section 11 (story bible, character bible, world bible, magic system, timeline, outline, previous summaries, current chapter requirements, must-happen/must-not-happen)
- `CONTINUE / REWRITE / EXPAND / SHORTEN / IMPROVE / SUMMARIZE` — smaller, targeted context

Critically: when generating Chapter N, only pull in **summaries** of prior chapters (not full text) plus the current character/world state snapshot and open threads — never dump the whole novel into context. Build a `contextRetriever.ts` that decides what's relevant for the current chapter (recent 1-2 chapter summaries in more detail, older ones compressed further, always full latest character/world state, always all unresolved open threads).

Acceptance criteria: log the assembled prompt for a sample chapter generation and show me it's sectioned and not bloated.

---

## 5. GUIDED SETUP FLOW (Phase 4)

Build the adaptive questionnaire per spec sections 2–8 and 24–25:
- Start screen: big text box, "What's your story idea?"
- Backend endpoint takes the free-text idea, runs it through the LLM to extract what's already implied, and returns a prioritized list of missing **required** questions (main character, setting, premise, genre/tone, major characters, key requirements, chapter config) before optional ones.
- Conversational UI: one question at a time, with a visible "Skip" button on every question.
- Loop: ask → user answers or skips → send updated state back to LLM → LLM decides next most valuable question → repeat until required info is sufficient (LLM should say when it has enough, but user can also click "I'm done, generate what you can").
- Also include full manual forms for every field in spec sections 2, 5, 6, 7, 8, 8 (chapter count/length/audio duration with configurable WPM) for users who want to fill everything in directly instead of the conversational flow. Both paths write to the same data model.

Acceptance criteria: I can create a novel from a one-sentence idea and reach a populated (partially AI-inferred) character/world/premise state through the Q&A loop, or I can fill the full manual form instead.

---

## 6. STORY BIBLE, OUTLINE & REVIEW (Phase 5)

- "Generate Story Bible" button → calls `GENERATE_STORY_BIBLE` → produces the full structured bible (basic info, main character, supporting characters, world bible, magic bible, timeline, relationship map, main story arcs) per spec section 9.
- Render this as an editable, well-organized document UI (sections/tabs), not a JSON dump. Every field editable inline.
- "Generate Chapter Outline" → produces per-chapter cards (spec section 10 fields) for the configured chapter count. Editable before approval.
- "Approve Outline" locks it in (but still editable later) and unlocks chapter generation.

Acceptance criteria: full bible + outline generated for a test novel, all fields editable and persisted.

---

## 7. CHAPTER GENERATION + CONTINUITY ENGINE (Phase 6)

- "Generate Chapter N" triggers `GENERATE_CHAPTER` with the assembled prompt from Phase 4.
- Stream the output into the editor as it generates.
- Immediately after generation completes, automatically fire a background `SUMMARIZE` call to produce: ChapterSummary, updated CharacterState (per character present), updated WorldState, and updated OpenThreads (mark resolved / add new). Store all of these — this is what future chapters read from, per spec section 12.
- Writing modes (spec section 14): Draft / Normal / High Quality / Continue / Rewrite / Expand / Improve / Summarize — implement as generation parameter presets (temperature, max tokens, context depth) plus different prompt section combos, not separate features.
- Enforce "must not happen" restrictions and "must happen" requirements as an explicit section injected into every chapter-generation prompt, and do a lightweight post-generation check step that flags (doesn't block) if a restriction appears to have been violated, for user review.

Acceptance criteria: generate chapters 1–3 for a test novel back to back, confirm chapter 3's context correctly reflects state changes from chapters 1–2 (character location/relationships/knowledge carried forward correctly).

---

## 8. WRITING INTERFACE (Phase 7)

Three-pane layout:
- **Left sidebar:** novel title, Story Bible, Characters, World, Timeline, chapter list (with status indicators: outline / drafted / edited / final)
- **Center:** large distraction-light editor for the current chapter (rich text, comfortable reading width, word/character count, estimated audio duration live-updating)
- **Right sidebar:** AI tool buttons — Continue, Rewrite (selection-aware), Expand, Shorten, Improve, Generate Dialogue, Describe Scene, Check Continuity, Generate Ideas

Chapter list actions (spec section 16): create, rename, reorder (drag), duplicate, delete, regenerate (creates new version, never overwrites), continue, rewrite, export. Version selector UI (Version 1/2/3...) to pick which version is "current."

Dark/light mode toggle, responsive layout, smooth transitions. Prioritize readability in the editor pane specifically (serif option, adjustable width).

Acceptance criteria: I can navigate the whole app, edit a chapter by hand, use at least 3 of the right-sidebar AI tools successfully, and switch chapter versions.

---

## 9. EXPORT MODULE — PER-CHAPTER PDF + COMBINED FULL-NOVEL PDF (Phase 8)

This is a priority requirement, build it as its own well-tested module: `/server/src/export/`

### 9.1 Per-chapter PDF
- Endpoint: `GET /api/novels/:novelId/chapters/:chapterId/export/pdf`
- Generate a standalone, well-formatted PDF for exactly that chapter using `pdfkit`:
  - Consistent page size (6x9" trade paperback size or A4 — make this configurable), proper margins
  - Chapter number + title as a styled header on the first page
  - Body text in a readable serif font, justified, proper paragraph spacing, page numbers in the footer
  - No other chapters' content included
- Also support DOCX and TXT/Markdown single-chapter export using the same content pipeline, reusing a shared "chapter renderer" so formatting logic isn't duplicated per format.
- Frontend: a "Download PDF" button on every chapter (in the chapter list and in the editor toolbar).

### 9.2 Combined full-novel PDF
- Endpoint: `GET /api/novels/:novelId/export/pdf`
- Two build strategies — implement strategy A, note B as a fallback:
  - **Strategy A (preferred):** generate each chapter's PDF via the same per-chapter renderer used in 9.1, then use `pdf-lib` to merge them in chapter-number order into one document, prepending a generated title page (novel title, author placeholder, genre) and a table of contents page (chapter number, title, and its correct page number — compute page offsets while merging).
  - **Strategy B (fallback, only if A proves unreliable):** render the whole novel as one continuous document directly in `pdfkit` in a single pass (title page → TOC → all chapters concatenated with page breaks between them).
- Only include chapters with status `drafted` or later; skip chapters still at `outline` stage, and warn the user in the UI if any chapters are missing before combining ("Chapters 7, 12 have no content yet — export anyway without them, or generate first?").
- Frontend: a "Download Full Novel" button on the Novel Dashboard, disabled/warned appropriately if chapters are missing.

### 9.3 Other formats (spec section 21)
- Full-novel export also available as: TXT, Markdown, DOCX (using `docx` package with real heading styles per chapter), EPUB (using `epub-gen`, one EPUB chapter per novel chapter, proper metadata/title/author).
- All exports (single-chapter and full-novel, all formats) available from both the Novel Dashboard and the individual chapter view.

Acceptance criteria: generate a 3-chapter test novel, download each chapter's PDF individually, then download the combined full-novel PDF and confirm: correct chapter order, working table of contents with accurate page numbers, title page present, no missing/duplicated content. Also produce one DOCX and one EPUB export and confirm they open correctly.

---

## 10. DASHBOARD (Phase 9)

Build the Novel Dashboard (spec section 20): title, genre, chapter count, completed count, total word count, estimated reading time, estimated audio duration, current arc, character list, visual progress bar. This is also where all "download" buttons live (per-chapter list with individual download icons + the combined "Download Full Novel" button with format picker).

---

## 11. AUTOSAVE & ERROR HANDLING (Phase 10)

- Autosave everything on change (debounced) — config, bible, characters, world, outlines, chapters, edits, AI settings. Never lose work on refresh.
- Handle and show clear, actionable errors for: invalid API key, rate limits, model unavailable, network errors, context/token limits exceeded, generation failure, incomplete/truncated responses. On any generation failure, the user's existing content must be untouched — allow retry without data loss.

---

## 12. UI DESIGN DIRECTION (Phase 11, polish pass)

Clean, modern, elegant — inspired by Notion / Google Docs / dedicated novel-writing software. Clean typography, comfortable reading width in the editor, dark/light mode, responsive layout, smooth (not gratuitous) animations, minimal clutter. The chapter editor is the most-used screen — optimize it for readability above all else.

---

## GLOBAL RULES FOR EVERY PHASE
1. Before writing code in a phase, briefly restate what you're about to build and any assumptions, then proceed.
2. After each phase, summarize what was built, list any deviations from this spec and why, and wait for my explicit go-ahead before starting the next phase.
3. Never hard-code a single AI provider into business logic — always go through the provider abstraction.
4. Never send API keys to the frontend.
5. Never overwrite an existing chapter's content on regenerate — always create a new version.
6. Keep prompt sections modular (Phase 3) — do not collapse them back into one giant prompt string for convenience.
7. For chapter generation, always pull continuity from stored summaries/state, never from raw full prior chapter text, to control context size.
8. The per-chapter and combined PDF export logic (Phase 8) must share a single chapter-rendering function — do not duplicate PDF-formatting logic between the two export paths.
