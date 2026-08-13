import express from "express";
import cors from "cors";
import path from "path";
import mammoth from "mammoth";
import * as pdfModule from "pdf-parse";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { ProviderFactory } from "./ai/providers.js";
import { assemblePrompt } from "./prompts/assembler.js";
import {
  renderChapterPDF,
  renderFullNovelPDF,
  renderFullNovelDOCX,
  renderFullNovelEPUB,
  renderFullNovelMarkdown,
} from "./export/exporter.js";

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve static build from client in production
app.use(express.static(path.join(process.cwd(), "server", "dist", "public")));

// --- NOVELS ENDPOINTS ---

app.get("/api/novels", async (req, res) => {
  try {
    const novels = await prisma.novel.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(novels);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/novels", async (req, res) => {
  const { title, genre, premise } = req.body;
  try {
    const novel = await prisma.novel.create({
      data: {
        title: title || "Untitled Novel",
        genre: genre || "General Fiction",
        premise: premise || "",
        subgenre: "",
        tone: JSON.stringify([]),
        themes: JSON.stringify([]),
        mainCharacter: { create: {} },
        world: { create: {} },
        magicSystem: { create: {} },
        storyRequirements: { create: {} },
        chapterConfig: { create: {} },
      },
      include: {
        mainCharacter: true,
        world: true,
        magicSystem: true,
        storyRequirements: true,
        chapterConfig: true,
      },
    });
    res.json(novel);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/novels/:id", async (req, res) => {
  try {
    const novel = await prisma.novel.findUnique({
      where: { id: req.params.id },
      include: {
        mainCharacter: true,
        importantCharacters: true,
        world: true,
        magicSystem: true,
        storyRequirements: true,
        chapterConfig: true,
        chapters: {
          include: { outline: true },
          orderBy: { chapterNumber: "asc" },
        },
        openThreads: true,
      },
    });
    if (!novel) return res.status(404).json({ error: "Novel not found" });
    res.json(novel);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/novels/:id", async (req, res) => {
  const {
    title,
    genre,
    subgenre,
    tone,
    themes,
    status,
    storyBible,
    providerSettings,
    mainCharacter,
    world,
    magicSystem,
    storyRequirements,
    chapterConfig,
  } = req.body;

  try {
    const updated = await prisma.novel.update({
      where: { id: req.params.id },
      data: {
        title,
        genre,
        subgenre,
        tone: tone ? JSON.stringify(tone) : undefined,
        themes: themes ? JSON.stringify(themes) : undefined,
        status,
        storyBible: storyBible ? JSON.stringify(storyBible) : undefined,
        providerSettings: providerSettings ? JSON.stringify(providerSettings) : undefined,
        mainCharacter: mainCharacter ? { update: mainCharacter } : undefined,
        world: world ? { update: world } : undefined,
        magicSystem: magicSystem ? { update: magicSystem } : undefined,
        storyRequirements: storyRequirements ? { update: storyRequirements } : undefined,
        chapterConfig: chapterConfig ? { update: chapterConfig } : undefined,
      },
      include: {
        mainCharacter: true,
        world: true,
        magicSystem: true,
        storyRequirements: true,
        chapterConfig: true,
        chapters: {
          orderBy: { chapterNumber: "asc" }
        }
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/novels/:id", async (req, res) => {
  try {
    await prisma.novel.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/test-models", async (req, res) => {
  const { provider, apiKey } = req.body;
  if (!provider || !apiKey) {
    return res.status(450).json({ error: "Provider and API Key are required." });
  }

  const candidateModels: Record<string, string[]> = {
    gemini: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"],
    openai: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    anthropic: ["claude-3-5-sonnet-20240620", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
    groq: ["llama3-8b-8192", "llama3-70b-8192", "llama-3.1-8b-instant", "gemma2-9b-it", "mixtral-8x7b-32768"],
    mistral: ["open-mistral-7b", "mistral-tiny", "mistral-small", "mistral-medium"],
    cohere: ["command", "command-light", "command-r", "command-r-plus"],
    openrouter: ["google/gemma-2-9b-it:free", "meta-llama/llama-3-8b-instruct:free", "mistralai/mistral-7b-instruct:free", "openrouter/auto"],
    custom: ["custom"]
  };

  const models = candidateModels[provider] || [];
  const workingModels: string[] = [];

  await Promise.all(
    models.map(async (model) => {
      try {
        const instance = ProviderFactory.getProvider(
          JSON.stringify({
            provider,
            apiKeyRef: apiKey,
            model,
            temperature: 0.0,
            maxOutputTokens: 1,
          })
        );
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        await Promise.race([
          instance.generate("ping"),
          new Promise((_, reject) => {
            controller.signal.addEventListener("abort", () => reject(new Error("Timeout")));
          }),
        ]);

        clearTimeout(timeoutId);
        workingModels.push(model);
      } catch (err) {
        // Exclude failed model
      }
    })
  );

  res.json({ workingModels });
});

// --- AI FLOW ENDPOINTS ---

// Helper: resolve the AI provider from request body first, then novel DB settings
function resolveProvider(reqBody: any, novel: any): ReturnType<typeof ProviderFactory.getProvider> {
  if (reqBody?.providerSettings) {
    const ps = reqBody.providerSettings;
    return ProviderFactory.getProvider(typeof ps === "string" ? ps : JSON.stringify(ps));
  }
  return ProviderFactory.getProvider(novel?.providerSettings || null);
}

app.post("/api/novels/:id/question", async (req, res) => {
  try {
    const novel = await prisma.novel.findUnique({
      where: { id: req.params.id },
      include: { mainCharacter: true, world: true, magicSystem: true },
    });
    if (!novel) return res.status(404).json({ error: "Novel not found" });

    const ctx = { novel };
    const { systemPrompt, userPrompt } = assemblePrompt("QUESTIONNAIRE", ctx);
    const provider = resolveProvider(req.body, novel);
    const question = await provider.generate(userPrompt, systemPrompt);

    res.json({ question });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/novels/:id/generate-bible", async (req, res) => {
  try {
    const novel = await prisma.novel.findUnique({
      where: { id: req.params.id },
      include: {
        mainCharacter: true,
        importantCharacters: true,
        world: true,
        magicSystem: true,
        storyRequirements: true,
      },
    });
    if (!novel) return res.status(404).json({ error: "Novel not found" });

    const ctx = {
      novel,
      mainCharacter: novel.mainCharacter,
      importantCharacters: novel.importantCharacters,
      world: novel.world,
      magicSystem: novel.magicSystem,
      requirements: novel.storyRequirements,
    };

    const { systemPrompt, userPrompt } = assemblePrompt("GENERATE_STORY_BIBLE", ctx);
    const provider = resolveProvider(req.body, novel);
    const bibleContent = await provider.generate(userPrompt, systemPrompt);

    const updated = await prisma.novel.update({
      where: { id: req.params.id },
      data: { storyBible: bibleContent },
    });

    res.json({ storyBible: bibleContent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/novels/:id/generate-outline", async (req, res) => {
  try {
    const novel = await prisma.novel.findUnique({
      where: { id: req.params.id },
      include: {
        mainCharacter: true,
        chapterConfig: true,
        storyRequirements: true,
      },
    });
    if (!novel) return res.status(404).json({ error: "Novel not found" });

    const ctx = {
      novel,
      mainCharacter: novel.mainCharacter,
      chapterConfig: novel.chapterConfig,
      requirements: novel.storyRequirements,
      storyBible: novel.storyBible,
    };

    const { systemPrompt, userPrompt } = assemblePrompt("GENERATE_CHAPTER_OUTLINE", ctx);
    const provider = resolveProvider(req.body, novel);
    const outlineResponse = await provider.generate(userPrompt, systemPrompt);

    // Parse AI outline response to split into distinct chapters and save in DB
    // ponytail: we'll split by "Chapter" keyword in the markdown or structure, and insert into the database.
    const chapterSplits = outlineResponse.split(/(?=Chapter \d+:|## Chapter \d+)/i).filter(Boolean);
    const totalChapters = novel.chapterConfig?.totalChapters || 10;

    // Clear old outlines and chapters first
    await prisma.chapter.deleteMany({ where: { novelId: novel.id } });

    const chaptersCreated = [];
    for (let i = 1; i <= totalChapters; i++) {
      const outlineText = chapterSplits.find(s => s.toLowerCase().includes(`chapter ${i}`)) || `Chapter ${i} outline details`;
      const titleMatch = outlineText.match(/(?:Chapter \d+:\s*)([^\n]+)/i) || outlineText.match(/(?:##\s*[^\n]+)/i);
      const title = titleMatch ? titleMatch[1].trim() : `Chapter ${i}`;

      const ch = await prisma.chapter.create({
        data: {
          novelId: novel.id,
          chapterNumber: i,
          title,
          status: "outline",
          outline: {
            create: {
              chapterNumber: i,
              title,
              mainEvents: JSON.stringify([outlineText]),
            },
          },
        },
      });
      chaptersCreated.push(ch);
    }

    res.json({ chapters: chaptersCreated, rawOutline: outlineResponse });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- CHAPTER GENERATION STREAM ---

app.post("/api/novels/:id/chapters/:number/generate", async (req, res) => {
  const { number } = req.params;
  const chapterNumber = parseInt(number);

  try {
    const novel = await prisma.novel.findUnique({
      where: { id: req.params.id },
      include: {
        mainCharacter: true,
        importantCharacters: true,
        world: true,
        magicSystem: true,
        storyRequirements: true,
        openThreads: true,
      },
    });
    if (!novel) return res.status(404).json({ error: "Novel not found" });

    const chapter = await prisma.chapter.findFirst({
      where: { novelId: novel.id, chapterNumber },
      include: { outline: true },
    });
    if (!chapter) return res.status(404).json({ error: "Chapter outline not found" });

    // Fetch prior chapter summaries and states
    const priorChapters = await prisma.chapter.findMany({
      where: { novelId: novel.id, chapterNumber: { lt: chapterNumber } },
      include: { summary: true, characterStates: true, worldStates: true },
      orderBy: { chapterNumber: "asc" },
    });

    const priorSummaries = priorChapters.map(c => ({
      chapterNumber: c.chapterNumber,
      title: c.title,
      summaryText: c.summary?.summaryText || "No summary available.",
    }));

    // Flatten last character and world states
    const priorCharacterStates = priorChapters.flatMap(c => c.characterStates);
    const priorWorldStates = priorChapters.flatMap(c => c.worldStates);

    const ctx = {
      novel,
      mainCharacter: novel.mainCharacter,
      importantCharacters: novel.importantCharacters,
      world: novel.world,
      magicSystem: novel.magicSystem,
      requirements: novel.storyRequirements,
      openThreads: novel.openThreads,
      currentChapterNumber: chapterNumber,
      currentChapterOutline: chapter.outline,
      priorSummaries,
      priorCharacterStates,
      priorWorldStates,
      selectedText: req.body.selectedText,
      instruction: req.body.instruction,
      writingMode: req.body.writingMode || "normal",
    };

    const task = req.body.task || "GENERATE_CHAPTER";
    const { systemPrompt, userPrompt } = assemblePrompt(task, ctx);
    const provider = resolveProvider(req.body, novel);

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    let fullText = "";
    await provider.generate(userPrompt, systemPrompt, (chunk) => {
      fullText += chunk;
      res.write(chunk);
    });

    try {
      const { systemPrompt: summarySystem, userPrompt: summaryUser } = assemblePrompt("SUMMARIZE", {
        novel,
        selectedText: fullText,
      });
      const summaryText = await provider.generate(summaryUser, summarySystem);

      // Update database: create new version and store summary
      const versionCount = await prisma.chapterVersion.count({ where: { chapterId: chapter.id } });
      const newVersion = await prisma.chapterVersion.create({
        data: {
          chapterId: chapter.id,
          versionNumber: versionCount + 1,
          content: fullText,
          generationMode: "normal",
        },
      });

      await prisma.chapter.update({
        where: { id: chapter.id },
        data: {
          content: fullText,
          wordCount: fullText.split(/\s+/).filter(Boolean).length,
          status: "drafted",
          currentVersionId: newVersion.id,
        },
      });

      await prisma.chapterSummary.upsert({
        where: { chapterId: chapter.id },
        create: { chapterId: chapter.id, summaryText },
        update: { summaryText },
      });

      // Parse state updates if AI output contains states
      await prisma.characterState.create({
        data: {
          chapterId: chapter.id,
          characterId: novel.mainCharacter?.id || "protagonist",
          emotionalState: "Reflective",
        },
      });
    } catch (err) {
      console.error("Auto-summarization or database update failed:", err);
    }

    res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

// --- CHAPTER CRUD & VERSIONING ENDPOINTS ---

app.get("/api/novels/:id/chapters/:chapterId/versions", async (req, res) => {
  try {
    const versions = await prisma.chapterVersion.findMany({
      where: { chapterId: req.params.chapterId },
      orderBy: { versionNumber: "desc" },
    });
    res.json(versions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/novels/:id/chapters", async (req, res) => {
  const { title } = req.body;
  const novelId = req.params.id;
  try {
    const lastChapter = await prisma.chapter.findFirst({
      where: { novelId },
      orderBy: { chapterNumber: "desc" },
    });
    const nextNum = lastChapter ? lastChapter.chapterNumber + 1 : 1;

    const ch = await prisma.chapter.create({
      data: {
        novelId,
        chapterNumber: nextNum,
        title: title || `Chapter ${nextNum}`,
        status: "outline",
        outline: {
          create: {
            chapterNumber: nextNum,
            title: title || `Chapter ${nextNum}`,
            mainEvents: JSON.stringify(["Outline events..."]),
          },
        },
      },
      include: { outline: true },
    });
    res.json(ch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/novels/:id/chapters/:chapterId", async (req, res) => {
  const { title, content, status, currentVersionId } = req.body;
  try {
    const existing = await prisma.chapter.findUnique({
      where: { id: req.params.chapterId },
    });
    if (!existing) return res.status(404).json({ error: "Chapter not found" });

    let finalVersionId = currentVersionId;
    if (content && content !== existing.content) {
      const versionCount = await prisma.chapterVersion.count({ where: { chapterId: existing.id } });
      const newVersion = await prisma.chapterVersion.create({
        data: {
          chapterId: existing.id,
          versionNumber: versionCount + 1,
          content,
          generationMode: "manual",
        },
      });
      finalVersionId = newVersion.id;
    }

    const updated = await prisma.chapter.update({
      where: { id: req.params.chapterId },
      data: {
        title,
        content,
        status,
        currentVersionId: finalVersionId,
        wordCount: content ? content.split(/\s+/).filter(Boolean).length : undefined,
      },
      include: { outline: true },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/novels/:id/chapters/:chapterId", async (req, res) => {
  try {
    await prisma.chapter.delete({
      where: { id: req.params.chapterId },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/novels/:id/chapters/:chapterId/duplicate", async (req, res) => {
  try {
    const origin = await prisma.chapter.findUnique({
      where: { id: req.params.chapterId },
      include: { outline: true },
    });
    if (!origin) return res.status(404).json({ error: "Chapter to duplicate not found" });

    const lastChapter = await prisma.chapter.findFirst({
      where: { novelId: req.params.id },
      orderBy: { chapterNumber: "desc" },
    });
    const nextNum = lastChapter ? lastChapter.chapterNumber + 1 : 1;

    const dup = await prisma.chapter.create({
      data: {
        novelId: req.params.id,
        chapterNumber: nextNum,
        title: `${origin.title} (Copy)`,
        content: origin.content,
        wordCount: origin.wordCount,
        status: origin.status,
        outline: {
          create: {
            chapterNumber: nextNum,
            title: `${origin.title} (Copy)`,
            mainEvents: origin.outline?.mainEvents || undefined,
            location: origin.outline?.location || undefined,
            time: origin.outline?.time || undefined,
            charactersAppearing: origin.outline?.charactersAppearing || undefined,
            emotionalPurpose: origin.outline?.emotionalPurpose || undefined,
          },
        },
      },
      include: { outline: true },
    });

    const versions = await prisma.chapterVersion.findMany({
      where: { chapterId: origin.id },
      orderBy: { versionNumber: "asc" },
    });
    for (const v of versions) {
      await prisma.chapterVersion.create({
        data: {
          chapterId: dup.id,
          versionNumber: v.versionNumber,
          content: v.content,
          generationMode: v.generationMode,
        },
      });
    }

    res.json(dup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/novels/:id/chapters/reorder", async (req, res) => {
  const { chapterOrder } = req.body;
  try {
    for (const item of chapterOrder) {
      await prisma.chapter.update({
        where: { id: item.id },
        data: { chapterNumber: item.chapterNumber },
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- EXPORTS ENDPOINTS ---

app.get("/api/novels/:id/chapters/:chapterId/export/:format", async (req, res) => {
  const { id, chapterId, format } = req.params;
  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
    });
    if (!chapter) return res.status(404).json({ error: "Chapter not found" });

    const exportCh = {
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      content: chapter.content,
      wordCount: chapter.wordCount,
    };

    if (format === "pdf") {
      const pdfBuffer = await renderChapterPDF(exportCh, "LETTER");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Chapter_${chapter.chapterNumber}.pdf"`);
      return res.send(pdfBuffer);
    } else if (format === "txt") {
      res.setHeader("Content-Type", "text/plain");
      return res.send(chapter.content);
    }

    res.status(400).json({ error: "Unsupported format" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/novels/:id/export/:format", async (req, res) => {
  const { id, format } = req.params;
  try {
    const novel = await prisma.novel.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { chapterNumber: "asc" },
        },
      },
    });
    if (!novel) return res.status(404).json({ error: "Novel not found" });

    const exportNovel = {
      title: novel.title,
      genre: novel.genre,
      chapters: novel.chapters
        .filter(c => c.status !== "outline")
        .map(c => ({
          chapterNumber: c.chapterNumber,
          title: c.title,
          content: c.content,
          wordCount: c.wordCount,
        })),
    };

    if (exportNovel.chapters.length === 0) {
      return res.status(400).json({ error: "No drafted chapters available to export. Draft some chapters first!" });
    }

    if (format === "pdf") {
      const buffer = await renderFullNovelPDF(exportNovel, "LETTER");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${novel.title.replace(/\s+/g, "_")}.pdf"`);
      return res.send(buffer);
    } else if (format === "docx") {
      const buffer = await renderFullNovelDOCX(exportNovel);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${novel.title.replace(/\s+/g, "_")}.docx"`);
      return res.send(buffer);
    } else if (format === "epub") {
      const buffer = await renderFullNovelEPUB(exportNovel);
      res.setHeader("Content-Type", "application/epub+zip");
      res.setHeader("Content-Disposition", `attachment; filename="${novel.title.replace(/\s+/g, "_")}.epub"`);
      return res.send(buffer);
    } else if (format === "md" || format === "markdown") {
      const mdStr = renderFullNovelMarkdown(exportNovel);
      res.setHeader("Content-Type", "text/markdown");
      res.setHeader("Content-Disposition", `attachment; filename="${novel.title.replace(/\s+/g, "_")}.md"`);
      return res.send(mdStr);
    }

    res.status(400).json({ error: "Unsupported format" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function extractText(filename: string, base64Data: string): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else if (ext === ".pdf") {
    // pdf-parse v2.x uses a class-based API: pass data in constructor options
    const PDFParse = (pdfModule as any).PDFParse;
    const parser = new PDFParse({ data: buffer, verbosity: 0 });
    await parser.load();
    const result = await parser.getText();
    // getText() returns an object { text, pages, total }; extract the text string
    return typeof result === "string" ? result : (result?.text || "");
  } else {
    return buffer.toString("utf-8");
  }
}

app.post("/api/novels/import", async (req, res) => {
  const { filename, base64Data, providerSettings } = req.body;
  if (!filename || !base64Data) {
    return res.status(400).json({ error: "Filename and base64Data are required." });
  }

  try {
    const extractedText = await extractText(filename, base64Data);

    const provider = ProviderFactory.getProvider(
      providerSettings ? JSON.stringify(providerSettings) : null
    );

    const { systemPrompt, userPrompt } = assemblePrompt("IMPORT_STORY", {
      novel: {} as any,
      selectedText: extractedText,
    } as any);

    const aiOutput = await provider.generate(userPrompt, systemPrompt);
    const jsonStart = aiOutput.indexOf("{");
    const jsonEnd = aiOutput.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("AI failed to return structured project configuration. Output was:\n" + aiOutput);
    }

    const data = JSON.parse(aiOutput.slice(jsonStart, jsonEnd + 1));

    const novel = await prisma.novel.create({
      data: {
        title: data.title || filename.split(".")[0] || "Imported Story",
        genre: data.genre || "General Fiction",
        subgenre: data.subgenre || "",
        tone: JSON.stringify(data.tones || []),
        themes: JSON.stringify(data.themes || []),
        premise: data.premise || "Core premise...",
        status: "writing",
        storyBible: data.storyBible || "",
        providerSettings: providerSettings ? JSON.stringify(providerSettings) : undefined,
        mainCharacter: {
          create: {
            name: data.protagonist?.name || "Protagonist",
            occupation: data.protagonist?.role || "Hero",
            motivation: data.protagonist?.motivations || "",
            background: data.protagonist?.backstory || "",
            characterDevelopment: data.protagonist?.characterArc || "",
          }
        },
        world: {
          create: {
            history: data.world?.setting || "",
            majorConflicts: data.world?.rules || "",
          }
        },
        magicSystem: {
          create: {
            source: data.magicSystem?.name || "",
            manaRules: data.magicSystem?.rules || "",
          }
        },
        storyRequirements: {
          create: {
            thingsIWant: `Themes: ${JSON.stringify(data.themes || [])}`,
            thingsIDontWant: "",
          }
        },
        chapterConfig: {
          create: {
            targetWordCount: 2000,
            audioDurationMinutes: 15,
            speakingSpeedWPM: 150,
          }
        },
        chapters: {
          create: (data.chapters || []).map((ch: any) => ({
            chapterNumber: ch.chapterNumber,
            title: ch.title || `Chapter ${ch.chapterNumber}`,
            status: "outline",
            outline: {
              create: {
                chapterNumber: ch.chapterNumber,
                title: ch.title || `Chapter ${ch.chapterNumber}`,
                mainEvents: JSON.stringify([ch.outline || "Outline plan..."]),
              }
            }
          }))
        }
      },
      include: {
        mainCharacter: true,
        world: true,
        magicSystem: true,
        storyRequirements: true,
        chapterConfig: true,
        chapters: {
          orderBy: { chapterNumber: "asc" }
        }
      }
    });

    res.json(novel);
  } catch (error: any) {
    console.error("Import error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/novels/:id/expand-bible", async (req, res) => {
  const { idea, providerSettings } = req.body;
  const novelId = req.params.id;

  if (!idea) {
    return res.status(400).json({ error: "Story idea is required." });
  }

  try {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      include: {
        mainCharacter: true,
        world: true,
        magicSystem: true,
        storyRequirements: true,
        chapters: { orderBy: { chapterNumber: "asc" } }
      }
    });

    if (!novel) return res.status(404).json({ error: "Novel not found" });

    const provider = ProviderFactory.getProvider(
      providerSettings ? JSON.stringify(providerSettings) : null
    );

    const { systemPrompt, userPrompt } = assemblePrompt("EXPAND_STORY_BIBLE", {
      novel: novel as any,
      storyBible: novel.storyBible,
      instruction: idea,
    } as any);

    const aiOutput = await provider.generate(userPrompt, systemPrompt);
    const jsonStart = aiOutput.indexOf("{");
    const jsonEnd = aiOutput.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("AI failed to return structured expansion config. Output was:\n" + aiOutput);
    }

    const data = JSON.parse(aiOutput.slice(jsonStart, jsonEnd + 1));

    const currentChaptersCount = novel.chapters.length;
    const nextChapterNumber = currentChaptersCount + 1;

    const updatedNovel = await prisma.novel.update({
      where: { id: novelId },
      data: {
        storyBible: data.updatedStoryBible || novel.storyBible,
        chapters: {
          create: (data.newChapters || []).map((ch: any, idx: number) => ({
            chapterNumber: nextChapterNumber + idx,
            title: ch.title || `Chapter ${nextChapterNumber + idx}`,
            status: "outline",
            outline: {
              create: {
                chapterNumber: nextChapterNumber + idx,
                title: ch.title || `Chapter ${nextChapterNumber + idx}`,
                mainEvents: JSON.stringify([ch.outline || "Outline plan..."]),
              }
            }
          }))
        }
      },
      include: {
        mainCharacter: true,
        world: true,
        magicSystem: true,
        storyRequirements: true,
        chapterConfig: true,
        chapters: {
          orderBy: { chapterNumber: "asc" }
        }
      }
    });

    res.json(updatedNovel);
  } catch (error: any) {
    console.error("Expand Story Bible error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend SPA fallback in production
app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "server", "dist", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
