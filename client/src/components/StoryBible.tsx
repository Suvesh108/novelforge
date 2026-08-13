import React, { useState } from "react";
import { useStore } from "../store.ts";
import { BookOpen, FileSpreadsheet, Check, Edit3, Sparkles } from "lucide-react";

function cleanMarkdownSymbols(text: string): string {
  if (!text) return "";
  return text
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/#/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}

export default function StoryBible() {
  const { currentNovel, updateNovel, setView, isGenerating, expandStoryBible } = useStore();
  const [activeTab, setActiveTab] = useState<"bible" | "outlines">("bible");
  const [isEditing, setIsEditing] = useState(false);
  const [editableBible, setEditableBible] = useState(currentNovel?.storyBible || "");

  const [showExpandModal, setShowExpandModal] = useState(false);
  const [newIdea, setNewIdea] = useState("");
  const [isExpanding, setIsExpanding] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!currentNovel) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 max-w-md w-full shadow-sm">
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            No project selected. Please choose or create a project from the Dashboard.
          </p>
        </div>
      </div>
    );
  }

  const handleSaveBible = async () => {
    await updateNovel(currentNovel.id, { storyBible: editableBible });
    setIsEditing(false);
  };

  const handleApproveOutline = async () => {
    await updateNovel(currentNovel.id, { status: "writing" });
    setView("editor");
  };

  const handleExpandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentNovel || !newIdea.trim()) return;

    setIsExpanding(true);
    setErrorMsg("");

    try {
      const rawKeys = localStorage.getItem("novel-forge-stored-keys");
      let activeSettings = null;
      if (rawKeys) {
        try {
          const parsed = JSON.parse(rawKeys);
          const activeProvider = localStorage.getItem("novel-forge-active-provider") || "gemini";
          const keysList = parsed[activeProvider] || [];
          const activeKey = keysList.find((k: any) => k.isActive)?.key || keysList[0]?.key || "";
          const activeModel = localStorage.getItem(`novel-forge-active-model-${activeProvider}`) || "gemini-1.5-flash";
          const activeTemp = parseFloat(localStorage.getItem(`novel-forge-active-temp-${activeProvider}`) || "0.7");
          activeSettings = {
            provider: activeProvider,
            apiKeyRef: activeKey,
            model: activeModel,
            temperature: activeTemp
          };
        } catch (err) {
          console.error("Local storage keys parse error:", err);
        }
      }

      await expandStoryBible(currentNovel.id, newIdea, activeSettings);
      setShowExpandModal(false);
      setNewIdea("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to expand story bible.");
    } finally {
      setIsExpanding(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col h-full">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
            {currentNovel.title}
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">
            Story Bible & Chapter Outline Center
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("bible")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${
              activeTab === "bible"
                ? "bg-slate-200 text-slate-800 dark:bg-slate-850 dark:text-slate-100"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <BookOpen className="w-4 h-4" /> Story Bible
          </button>
          <button
            onClick={() => setActiveTab("outlines")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${
              activeTab === "outlines"
                ? "bg-slate-200 text-slate-800 dark:bg-slate-850 dark:text-slate-100"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Chapter Outlines
          </button>
        </div>
      </div>

      {activeTab === "bible" ? (
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Story Bible</h2>
              {isEditing ? (
                <button
                  onClick={handleSaveBible}
                  className="flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded transition"
                >
                  <Check className="w-3.5 h-3.5" /> Save Edits
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowExpandModal(true)}
                    className="flex items-center gap-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 dark:text-indigo-405 px-3 py-1.5 rounded transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Add Story/Arc Idea
                  </button>
                  <button
                    onClick={() => {
                      setEditableBible(currentNovel.storyBible || "");
                      setIsEditing(true);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-350 px-3 py-1.5 rounded transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Bible
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <textarea
                value={editableBible}
                onChange={(e) => setEditableBible(e.target.value)}
                className="w-full h-[500px] p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm text-slate-800 dark:text-slate-100"
              />
            ) : (
              <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 overflow-y-auto max-h-[500px] pr-2 space-y-4 whitespace-pre-wrap leading-relaxed font-serif text-base">
                {cleanMarkdownSymbols(currentNovel.storyBible || "No Story Bible generated yet. Configure options in setup flow.")}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto max-h-[550px] pr-2 mb-6">
            {currentNovel.chapters?.map((ch) => (
              <div
                key={ch.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded">
                    Chapter {ch.chapterNumber}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    {ch.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-850 dark:text-slate-100">{ch.title}</h3>
                
                {ch.outline?.mainEvents && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-655 dark:text-slate-350">Outline Plan:</p>
                    <p className="line-clamp-4 italic whitespace-pre-wrap">
                      {cleanMarkdownSymbols(JSON.parse(ch.outline.mainEvents)[0] || "")}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Ready to write?</p>
                <p className="text-xs text-slate-500 dark:text-slate-450">Approving the outline locks in configurations and initializes the Chapter Editor pane.</p>
              </div>
            </div>

            <button
              onClick={handleApproveOutline}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-lg transition shadow-md shadow-indigo-200 dark:shadow-none"
            >
              Approve Outline & Write Chapter 1
            </button>
          </div>
        </div>
      )}
      {showExpandModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-850 dark:text-slate-100">
                Add Story or Arc Idea
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-450 font-medium">
                Write your new subplot or arc idea, and the AI will expand the Story Bible and generate new chapter outlines.
              </p>
            </div>

            <form onSubmit={handleExpandSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Describe Your New Plot Arc / Idea
                </label>
                <textarea
                  required
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  placeholder="e.g. Introduce a rebel faction that attempts to bust John out of prison in Chapter 5, leading to a chase scene..."
                  rows={5}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-850 dark:text-slate-100 text-sm"
                />
              </div>

              {isExpanding && (
                <div className="text-center text-xs text-indigo-600 dark:text-indigo-400 font-bold animate-pulse">
                  Integrating idea into Story Bible and drafting new chapter outlines...
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowExpandModal(false);
                    setNewIdea("");
                    setErrorMsg("");
                  }}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:underline px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExpanding || !newIdea.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded text-xs transition disabled:opacity-50"
                >
                  {isExpanding ? "Expanding..." : "Expand Story Bible & Outlines"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
