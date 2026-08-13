import { create } from "zustand";

export interface Novel {
  id: string;
  title: string;
  genre: string;
  subgenre?: string | null;
  tone: string; // JSON string
  premise: string;
  themes: string; // JSON string
  status: string;
  createdAt?: string;
  updatedAt?: string;
  storyBible?: string | null;
  providerSettings?: string | null;
  mainCharacter?: any;
  importantCharacters?: any[];
  world?: any;
  magicSystem?: any;
  storyRequirements?: any;
  chapterConfig?: any;
  chapters?: any[];
  openThreads?: any[];
}

interface AppStore {
  novels: Novel[];
  currentNovel: Novel | null;
  currentChapterId: string | null;
  currentChapterVersionId: string | null;
  activeView: "dashboard" | "setup" | "bible" | "editor" | "settings";
  viewHistory: string[];
  darkMode: boolean;
  isGenerating: boolean;
  streamingText: string;
  error: string | null;
  activeWritingMode: "draft" | "normal" | "high_quality";
  chapterVersions: any[];

  setDarkMode: (dark: boolean) => void;
  setView: (view: "dashboard" | "setup" | "bible" | "editor" | "settings") => void;
  goBack: () => void;
  setCurrentChapter: (id: string | null) => void;
  clearError: () => void;
  setWritingMode: (mode: "draft" | "normal" | "high_quality") => void;

  fetchNovels: () => Promise<void>;
  fetchNovel: (id: string) => Promise<Novel>;
  createNovel: (title: string, genre: string, premise: string) => Promise<Novel>;
  updateNovel: (id: string, updates: Partial<Novel>) => Promise<void>;
  deleteNovel: (id: string) => Promise<void>;
  
  // Chapter Navigation methods
  createChapter: (novelId: string, title?: string) => Promise<void>;
  updateChapter: (novelId: string, chapterId: string, updates: any) => Promise<void>;
  deleteChapter: (novelId: string, chapterId: string) => Promise<void>;
  duplicateChapter: (novelId: string, chapterId: string) => Promise<void>;
  reorderChapter: (novelId: string, chapterId: string, direction: "up" | "down") => Promise<void>;
  fetchChapterVersions: (novelId: string, chapterId: string) => Promise<void>;
  selectChapterVersion: (novelId: string, chapterId: string, versionId: string, content: string) => Promise<void>;

  // AI methods
  askSetupQuestion: (id: string) => Promise<string>;
  generateStoryBible: (id: string) => Promise<string>;
  generateOutline: (id: string) => Promise<void>;
  generateChapter: (id: string, chapterNumber: number) => Promise<void>;
  generateWholeNovel: (id: string) => Promise<void>;
  importNovel: (filename: string, base64Data: string, providerSettings: any) => Promise<any>;
  expandStoryBible: (id: string, idea: string, providerSettings: any) => Promise<void>;
}

// Read the active provider config from localStorage, built from the multi-key registry
function getActiveProviderSettings(): any | null {
  try {
    const rawKeys = localStorage.getItem("novel-forge-stored-keys");
    const activeProvider = localStorage.getItem("novel-forge-active-provider") || "gemini";
    if (!rawKeys) {
      // Fall back to the legacy single-key format
      const legacy = localStorage.getItem("novel-forge-api-settings");
      return legacy ? JSON.parse(legacy) : null;
    }
    const parsed = JSON.parse(rawKeys);
    const keysList: any[] = parsed[activeProvider] || [];
    const activeKey = keysList.find((k: any) => k.isActive)?.key || keysList[0]?.key || "";
    if (!activeKey) return null;
    const activeModel = localStorage.getItem(`novel-forge-active-model-${activeProvider}`) || "gemini-1.5-flash";
    const activeTemp = parseFloat(localStorage.getItem(`novel-forge-active-temp-${activeProvider}`) || "0.7");
    return { provider: activeProvider, apiKeyRef: activeKey, model: activeModel, temperature: activeTemp };
  } catch {
    return null;
  }
}

export const useStore = create<AppStore>((set, get) => ({
  novels: [],
  currentNovel: null,
  currentChapterId: null,
  currentChapterVersionId: null,
  activeView: "dashboard",
  viewHistory: ["dashboard"],
  darkMode: false,
  isGenerating: false,
  streamingText: "",
  error: null,
  activeWritingMode: "normal",
  chapterVersions: [],

  setDarkMode: (dark) => {
    set({ darkMode: dark });
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  },

  setView: (view) => set((state) => ({ activeView: view, viewHistory: [...state.viewHistory, view] })),
  goBack: () => {
    const history = get().viewHistory;
    if (history.length > 1) {
      const nextHistory = [...history];
      nextHistory.pop(); // remove current view
      const prevView = nextHistory[nextHistory.length - 1];
      set({ activeView: prevView as any, viewHistory: nextHistory });
    } else {
      set({ activeView: "dashboard", viewHistory: ["dashboard"] });
    }
  },
  setCurrentChapter: (id) => set({ currentChapterId: id }),
  clearError: () => set({ error: null }),
  setWritingMode: (mode) => set({ activeWritingMode: mode }),

  fetchNovels: async () => {
    try {
      const res = await fetch("/api/novels");
      if (!res.ok) throw new Error("Failed to fetch novels");
      const data = await res.json();
      set({ novels: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchNovel: async (id) => {
    try {
      const res = await fetch(`/api/novels/${id}`);
      if (!res.ok) throw new Error("Failed to fetch novel details");
      const data = await res.json();
      set({ currentNovel: data });
      if (data.chapters && data.chapters.length > 0 && !get().currentChapterId) {
        set({ currentChapterId: data.chapters[0].id });
      }
      return data;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  createNovel: async (title, genre, premise) => {
    try {
      const res = await fetch("/api/novels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, genre, premise }),
      });
      if (!res.ok) throw new Error("Failed to create novel");
      let data = await res.json();

      const localSettings = localStorage.getItem("novel-forge-api-settings");
      if (localSettings) {
        const patchRes = await fetch(`/api/novels/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerSettings: JSON.parse(localSettings) } as any),
        });
        if (patchRes.ok) {
          data = await patchRes.json();
        }
      }

      set((state) => ({ novels: [data, ...state.novels], currentNovel: data, activeView: "setup" }));
      return data;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateNovel: async (id, updates) => {
    try {
      const res = await fetch(`/api/novels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update novel parameters");
      const data = await res.json();
      set({ currentNovel: data });
      get().fetchNovels();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteNovel: async (id) => {
    try {
      const res = await fetch(`/api/novels/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete novel project");
      set((state) => {
        const nextNovels = state.novels.filter((n) => n.id !== id);
        const nextCurrent = state.currentNovel?.id === id 
          ? (nextNovels.length > 0 ? nextNovels[0] : null) 
          : state.currentNovel;
        return {
          novels: nextNovels,
          currentNovel: nextCurrent,
        };
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createChapter: async (novelId, title) => {
    try {
      const res = await fetch(`/api/novels/${novelId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to create chapter");
      const data = await res.json();
      await get().fetchNovel(novelId);
      set({ currentChapterId: data.id });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updateChapter: async (novelId, chapterId, updates) => {
    try {
      const res = await fetch(`/api/novels/${novelId}/chapters/${chapterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update chapter");
      await get().fetchNovel(novelId);
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteChapter: async (novelId, chapterId) => {
    try {
      const res = await fetch(`/api/novels/${novelId}/chapters/${chapterId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete chapter");
      await get().fetchNovel(novelId);
      const chs = get().currentNovel?.chapters || [];
      if (chs.length > 0) {
        set({ currentChapterId: chs[0].id });
      } else {
        set({ currentChapterId: null });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  duplicateChapter: async (novelId, chapterId) => {
    try {
      const res = await fetch(`/api/novels/${novelId}/chapters/${chapterId}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to duplicate chapter");
      const data = await res.json();
      await get().fetchNovel(novelId);
      set({ currentChapterId: data.id });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  reorderChapter: async (novelId, chapterId, direction) => {
    try {
      const chapters = get().currentNovel?.chapters || [];
      const idx = chapters.findIndex((c) => c.id === chapterId);
      if (idx === -1) return;

      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= chapters.length) return;

      const tempOrder = [...chapters];
      const tempNum = tempOrder[idx].chapterNumber;
      tempOrder[idx].chapterNumber = tempOrder[targetIdx].chapterNumber;
      tempOrder[targetIdx].chapterNumber = tempNum;

      const orderPayload = tempOrder.map((c) => ({ id: c.id, chapterNumber: c.chapterNumber }));
      const res = await fetch(`/api/novels/${novelId}/chapters/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterOrder: orderPayload }),
      });
      if (!res.ok) throw new Error("Failed to reorder chapters");
      await get().fetchNovel(novelId);
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchChapterVersions: async (novelId, chapterId) => {
    try {
      const res = await fetch(`/api/novels/${novelId}/chapters/${chapterId}/versions`);
      if (!res.ok) throw new Error("Failed to fetch chapter versions");
      const data = await res.json();
      set({ chapterVersions: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  selectChapterVersion: async (novelId, chapterId, versionId, content) => {
    try {
      const res = await fetch(`/api/novels/${novelId}/chapters/${chapterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentVersionId: versionId, content }),
      });
      if (!res.ok) throw new Error("Failed to switch chapter version");
      await get().fetchNovel(novelId);
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  askSetupQuestion: async (id) => {
    try {
      set({ isGenerating: true, error: null });
      const res = await fetch(`/api/novels/${id}/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerSettings: getActiveProviderSettings() }),
      });
      if (!res.ok) throw new Error("AI Questionnaire generation failed");
      const data = await res.json();
      set({ isGenerating: false });
      return data.question;
    } catch (err: any) {
      set({ isGenerating: false, error: err.message });
      throw err;
    }
  },

  generateStoryBible: async (id) => {
    try {
      set({ isGenerating: true, error: null });
      const res = await fetch(`/api/novels/${id}/generate-bible`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerSettings: getActiveProviderSettings() }),
      });
      if (!res.ok) throw new Error("Failed to generate Story Bible");
      const data = await res.json();
      set({ isGenerating: false });
      if (get().currentNovel) {
        set({ currentNovel: { ...get().currentNovel!, storyBible: data.storyBible } });
      }
      return data.storyBible;
    } catch (err: any) {
      set({ isGenerating: false, error: err.message });
      throw err;
    }
  },

  generateOutline: async (id) => {
    try {
      set({ isGenerating: true, error: null });
      const res = await fetch(`/api/novels/${id}/generate-outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerSettings: getActiveProviderSettings() }),
      });
      if (!res.ok) throw new Error("Failed to generate Chapter Outlines");
      set({ isGenerating: false });
      await get().fetchNovel(id);
    } catch (err: any) {
      set({ isGenerating: false, error: err.message });
    }
  },

  generateChapter: async (id, chapterNumber) => {
    try {
      set({ isGenerating: true, streamingText: "", error: null });
      const res = await fetch(`/api/novels/${id}/chapters/${chapterNumber}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writingMode: get().activeWritingMode, providerSettings: getActiveProviderSettings() }),
      });

      if (!res.ok) throw new Error("Chapter generation API failed");
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        set((state) => ({ streamingText: state.streamingText + text }));
      }

      set({ isGenerating: false, streamingText: "" });
      await get().fetchNovel(id);
    } catch (err: any) {
      set({ isGenerating: false, streamingText: "", error: err.message });
    }
  },

  generateWholeNovel: async (id) => {
    const novel = get().currentNovel;
    if (!novel || !novel.chapters) return;
    
    set({ isGenerating: true, error: null });
    try {
      for (const ch of novel.chapters) {
        set({ streamingText: `[Drafting Chapter ${ch.chapterNumber}: ${ch.title}...]` });
        
        const res = await fetch(`/api/novels/${id}/chapters/${ch.chapterNumber}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ writingMode: get().activeWritingMode, providerSettings: getActiveProviderSettings() }),
        });

        if (!res.ok) throw new Error(`Chapter ${ch.chapterNumber} generation failed`);
        if (!res.body) continue;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let streamResult = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          streamResult += text;
          set({ streamingText: `[Drafting Chapter ${ch.chapterNumber}: ${ch.title}...]\n\n${streamResult}` });
        }

        await get().fetchNovel(id);
      }
      set({ isGenerating: false, streamingText: "" });
    } catch (err: any) {
      set({ isGenerating: false, streamingText: "", error: err.message });
    }
  },

  importNovel: async (filename, base64Data, providerSettings) => {
    try {
      set({ isGenerating: true, error: null });
      const res = await fetch("/api/novels/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, base64Data, providerSettings }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to import story file.");
      }

      const novel = await res.json();
      set({
        currentNovel: novel,
        currentChapterId: novel.chapters?.[0]?.id || null,
        isGenerating: false,
        activeView: "editor",
        viewHistory: [...get().viewHistory, "editor"],
      });
      await get().fetchNovels();
      return novel;
    } catch (err: any) {
      set({ isGenerating: false, error: err.message });
      throw err;
    }
  },

  expandStoryBible: async (id, idea, providerSettings) => {
    try {
      set({ isGenerating: true, error: null });
      const res = await fetch(`/api/novels/${id}/expand-bible`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, providerSettings }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to expand story bible.");
      }

      const updated = await res.json();
      set({ currentNovel: updated, isGenerating: false });
      await get().fetchNovels();
    } catch (err: any) {
      set({ isGenerating: false, error: err.message });
      throw err;
    }
  },
}));
