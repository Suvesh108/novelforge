import React, { useState } from "react";
import { useStore } from "../store.ts";
import { BookOpen, FileSpreadsheet, Check, Edit3, Sparkles } from "lucide-react";

export default function StoryBible() {
  const { currentNovel, updateNovel, setView, isGenerating } = useStore();
  const [activeTab, setActiveTab] = useState<"bible" | "outlines">("bible");
  const [isEditing, setIsEditing] = useState(false);
  const [editableBible, setEditableBible] = useState(currentNovel?.storyBible || "");

  if (!currentNovel) return null;

  const handleSaveBible = async () => {
    await updateNovel(currentNovel.id, { storyBible: editableBible });
    setIsEditing(false);
  };

  const handleApproveOutline = async () => {
    await updateNovel(currentNovel.id, { status: "writing" });
    setView("editor");
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
                <button
                  onClick={() => {
                    setEditableBible(currentNovel.storyBible || "");
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-350 px-3 py-1.5 rounded transition"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Bible
                </button>
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
                {currentNovel.storyBible || "No Story Bible generated yet. Configure options in setup flow."}
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
                      {JSON.parse(ch.outline.mainEvents)[0] || ""}
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
    </div>
  );
}
