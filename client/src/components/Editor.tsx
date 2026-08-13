import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../store.ts";
import {
  FileText,
  Sparkles,
  BookOpen,
  Download,
  Volume2,
  RefreshCw,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  Edit2,
  Check
} from "lucide-react";

export default function Editor() {
  const {
    currentNovel,
    currentChapterId,
    setCurrentChapter,
    generateChapter,
    isGenerating,
    streamingText,
    fetchNovel,
    activeWritingMode,
    setWritingMode,
    chapterVersions,
    fetchChapterVersions,
    selectChapterVersion,
    createChapter,
    updateChapter,
    deleteChapter,
    duplicateChapter,
    reorderChapter,
    viewHistory,
  } = useStore();

  const [activeChapter, setActiveChapter] = useState<any>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [fontFamily, setFontFamily] = useState<"serif" | "sans">("serif");
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg" | "xl">("lg");
  const [selectedText, setSelectedText] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [exportFormat, setExportFormat] = useState("pdf");

  // Chapter renaming state
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeout = useRef<any>(null);

  useEffect(() => {
    if (currentNovel && currentChapterId) {
      const ch = currentNovel.chapters?.find((c) => c.id === currentChapterId);
      if (ch) {
        setActiveChapter(ch);
        setContent(ch.content || "");
        setTitle(ch.title || "");
      }
    }
  }, [currentNovel, currentChapterId]);

  useEffect(() => {
    if (currentNovel && currentChapterId) {
      fetchChapterVersions(currentNovel.id, currentChapterId);
    }
  }, [currentNovel?.id, currentChapterId]);

  // Debounced Autosave (Phase 10 requirement)
  const handleContentChange = (val: string) => {
    setContent(val);

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      if (currentNovel && activeChapter) {
        // Trigger patch to update DB content
        await fetch(`/api/novels/${currentNovel.id}/chapters/${activeChapter.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: val,
          })
        });
        // Silent background refresh
        fetchNovel(currentNovel.id);
      }
    }, 1500);
  };

  const handleSelection = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      if (start !== end) {
        setSelectedText(content.substring(start, end));
      } else {
        setSelectedText("");
      }
    }
  };

  const triggerGenerate = async () => {
    if (!currentNovel || !activeChapter) return;
    await generateChapter(currentNovel.id, activeChapter.chapterNumber);
  };

  const triggerAiEdit = async (task: string) => {
    if (!currentNovel || !activeChapter) return;
    
    // Fallback block if no selection, use full content
    const textToModify = selectedText || content;
    if (!textToModify.trim() && task !== "GENERATE_IDEAS") return;

    try {
      const res = await fetch(`/api/novels/${currentNovel.id}/chapters/${activeChapter.chapterNumber}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          selectedText: textToModify,
          instruction: aiInstruction,
          writingMode: activeWritingMode,
        }),
      });

      if (!res.ok) throw new Error("AI refinement failed");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let streamResult = "";

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        streamResult += decoder.decode(value, { stream: true });
        handleContentChange(content + "\n" + streamResult);
      }

      await fetchNovel(currentNovel.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRename = async (chId: string) => {
    if (!currentNovel || !tempTitle.trim()) return;
    await updateChapter(currentNovel.id, chId, { title: tempTitle });
    setEditingChapterId(null);
  };

  // Word & Reading statistics
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const charCount = content.length;
  const readingTime = Math.ceil(wordCount / 200); // 200 wpm
  const audioDuration = Math.ceil(wordCount / 150); // 150 wpm

  const handleDownload = () => {
    if (!currentNovel || !activeChapter) return;
    window.open(`/api/novels/${currentNovel.id}/chapters/${activeChapter.id}/export/${exportFormat}`);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left Sidebar - Chapters list with actions */}
      <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
        <div className="p-4 flex-1 overflow-y-auto">
          {viewHistory.length > 1 && <div className="h-10 flex-shrink-0" />}
          <h2 className="text-xs font-bold text-slate-450 dark:text-slate-550 tracking-wider uppercase mb-4">
            Novel Outline Map
          </h2>
          <div className="space-y-1">
            {currentNovel?.chapters?.map((ch, idx) => (
              <div
                key={ch.id}
                className={`group flex items-center justify-between p-2 rounded-lg text-sm font-semibold transition ${
                  currentChapterId === ch.id
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                    : "text-slate-655 hover:bg-slate-50 dark:text-slate-450 dark:hover:bg-slate-850"
                }`}
              >
                {editingChapterId === ch.id ? (
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onBlur={() => handleRename(ch.id)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(ch.id)}
                    className="bg-transparent border-b border-indigo-500 focus:outline-none flex-1 py-0.5 text-slate-805 dark:text-slate-100 text-xs"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => setCurrentChapter(ch.id)}
                    className="flex-1 flex items-center gap-2 truncate text-left text-xs"
                  >
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">Ch {ch.chapterNumber}: {ch.title}</span>
                  </button>
                )}

                {/* Sidebar controls shown on hover */}
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    title="Move Up"
                    disabled={idx === 0}
                    onClick={() => reorderChapter(currentNovel.id, ch.id, "up")}
                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30 text-slate-400"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    title="Move Down"
                    disabled={idx === (currentNovel.chapters?.length || 0) - 1}
                    onClick={() => reorderChapter(currentNovel.id, ch.id, "down")}
                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30 text-slate-400"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    title="Rename"
                    onClick={() => {
                      setEditingChapterId(ch.id);
                      setTempTitle(ch.title);
                    }}
                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    title="Duplicate"
                    onClick={() => duplicateChapter(currentNovel.id, ch.id)}
                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    title="Delete"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${ch.title}"?`)) {
                        deleteChapter(currentNovel.id, ch.id);
                      }
                    }}
                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-rose-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => createChapter(currentNovel!.id)}
            className="w-full mt-4 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 hover:border-indigo-500 hover:text-indigo-600 dark:border-slate-800 dark:hover:border-indigo-400 text-slate-500 py-2 rounded-lg text-xs font-semibold transition"
          >
            <Plus className="w-4 h-4" /> Add Chapter
          </button>
        </div>

        {/* Action Panel */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded font-semibold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="pdf">PDF</option>
              <option value="txt">TXT</option>
            </select>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold py-1.5 px-3 rounded transition"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
        </div>
      </div>

      {/* Center - Distraction Free Editor */}
      <div className="flex-1 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between overflow-y-auto">
        <div className="max-w-3xl w-full mx-auto px-6 py-8 flex-1 flex flex-col">
          {/* Header toolbar with Font style & Version Selector */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
            <h1 className="text-xl font-bold text-slate-850 dark:text-slate-100 truncate">
              {title}
            </h1>
            
            <div className="flex items-center gap-3.5 flex-shrink-0">
              {/* Version Selector Dropdown */}
              {chapterVersions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Ver:</span>
                  <select
                    value={activeChapter?.currentVersionId || ""}
                    onChange={(e) => {
                      const selectedVer = chapterVersions.find((v) => v.id === e.target.value);
                      if (selectedVer) {
                        selectChapterVersion(currentNovel!.id, activeChapter.id, selectedVer.id, selectedVer.content);
                      }
                    }}
                    className="bg-slate-100 dark:bg-slate-900 text-xs px-2 py-1 border border-slate-200 dark:border-slate-850 rounded font-semibold text-slate-700 dark:text-slate-350 outline-none"
                  >
                    {chapterVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        Version {v.versionNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={() => setFontFamily(fontFamily === "serif" ? "sans" : "serif")}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-405 dark:hover:text-slate-200"
              >
                Font: {fontFamily === "serif" ? "Serif" : "Sans"}
              </button>
              
              <button
                onClick={() => setFontSize(fontSize === "lg" ? "xl" : "lg")}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-405 dark:hover:text-slate-200"
              >
                {fontSize.toUpperCase()}
              </button>
            </div>
          </div>

          {/* Text Area */}
          <div className="flex-1 flex flex-col relative">
            <textarea
              ref={textareaRef}
              value={content}
              onSelect={handleSelection}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Begin writing your masterpiece here, or click 'Generate Chapter' in the right sidepanel to construct the base draft using the Story Bible..."
              className={`w-full flex-1 bg-transparent resize-none focus:outline-none text-slate-800 dark:text-slate-200 leading-relaxed ${
                fontFamily === "serif" ? "font-serif" : "font-sans"
              } ${
                fontSize === "sm"
                  ? "text-sm"
                  : fontSize === "base"
                  ? "text-base"
                  : fontSize === "lg"
                  ? "text-lg"
                  : "text-xl"
              }`}
            />
            {streamingText && (
              <div className="absolute inset-0 bg-slate-50/90 dark:bg-slate-950/90 pointer-events-none overflow-y-auto whitespace-pre-wrap leading-relaxed font-serif text-lg text-slate-550 dark:text-slate-400">
                {streamingText}
              </div>
            )}
          </div>
        </div>

        {/* Footer Statistics */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
          <div className="flex items-center gap-4">
            <span>{wordCount} Words</span>
            <span>{charCount} Characters</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> Read time: {readingTime} min
            </span>
            <span className="flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5" /> Audio: {audioDuration} min
            </span>
          </div>
        </div>
      </div>

      {/* Right Sidebar - AI Assist Tools */}
      <div className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-850 dark:text-slate-100">AI Sidepanel Assist</h2>
          </div>

          <div className="space-y-4">
            {/* Writing Mode dropdown */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wide">
                Writing Mode
              </label>
              <select
                value={activeWritingMode}
                onChange={(e) => setWritingMode(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-xs px-3 py-2 border border-slate-200 dark:border-slate-805 rounded font-semibold text-slate-700 dark:text-slate-350 outline-none"
              >
                <option value="normal">Normal Mode (Balanced)</option>
                <option value="draft">Draft Mode (Fast & Simple)</option>
                <option value="high_quality">High Quality Mode (Sensory)</option>
              </select>
            </div>

            <button
              onClick={triggerGenerate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg text-xs shadow-sm transition disabled:opacity-50"
            >
              {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Generate Base Chapter Draft
            </button>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wide">
                Refinement Instructions
              </h3>
              <input
                type="text"
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                placeholder="Rewrite in a darker tone, expand dialogue..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* AI Refinements actions */}
            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Refinement Actions
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => triggerAiEdit("CONTINUE")}
                  disabled={isGenerating}
                  className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-800 text-[11px] font-bold py-2 rounded transition"
                >
                  Continue Scene
                </button>
                <button
                  onClick={() => triggerAiEdit("REWRITE")}
                  disabled={isGenerating}
                  className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-800 text-[11px] font-bold py-2 rounded transition"
                >
                  Rewrite Selection
                </button>
                <button
                  onClick={() => triggerAiEdit("EXPAND")}
                  disabled={isGenerating}
                  className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-800 text-[11px] font-bold py-2 rounded transition"
                >
                  Expand Scene
                </button>
                <button
                  onClick={() => triggerAiEdit("IMPROVE")}
                  disabled={isGenerating}
                  className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-800 text-[11px] font-bold py-2 rounded transition"
                >
                  Polishing Flow
                </button>
              </div>
            </div>

            {/* Extended Creative Assists from PDF */}
            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Creative Assists
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => triggerAiEdit("GENERATE_DIALOGUE")}
                  disabled={isGenerating}
                  className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-800 text-[11px] font-bold py-2 rounded transition"
                >
                  Generate Dialogue
                </button>
                <button
                  onClick={() => triggerAiEdit("DESCRIBE_SCENE")}
                  disabled={isGenerating}
                  className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-800 text-[11px] font-bold py-2 rounded transition"
                >
                  Describe Surroundings
                </button>
                <button
                  onClick={() => triggerAiEdit("CHECK_CONTINUITY")}
                  disabled={isGenerating}
                  className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-800 text-[11px] font-bold py-2 rounded transition"
                >
                  Check Continuity
                </button>
                <button
                  onClick={() => triggerAiEdit("GENERATE_IDEAS")}
                  disabled={isGenerating}
                  className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-800 text-[11px] font-bold py-2 rounded transition"
                >
                  Generate Ideas
                </button>
              </div>
            </div>

            {selectedText && (
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-3 rounded text-[10px] text-slate-500 font-semibold space-y-1">
                <span className="text-indigo-650 dark:text-indigo-400 font-bold uppercase">Active Selection:</span>
                <p className="line-clamp-3 italic">"{selectedText}"</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-lg text-[10px] text-slate-400 font-medium">
          <p className="font-bold text-slate-650 dark:text-slate-300 mb-1">Ponytail Continuity Engine</p>
          State is automatically tracked in the database across chapter versions.
        </div>
      </div>
    </div>
  );
}
