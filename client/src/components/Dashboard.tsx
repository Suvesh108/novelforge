import React, { useState, useEffect } from "react";
import { useStore } from "../store.ts";
import { BookOpen, FileText, LayoutDashboard, Plus, Download, Sparkles, AlertCircle, Trash2 } from "lucide-react";

export default function Dashboard() {
  const { novels, currentNovel, fetchNovels, fetchNovel, createNovel, deleteNovel, setView, setDarkMode, darkMode } = useStore();
  const [showNewModal, setShowNewModal] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Fantasy");
  const [premise, setPremise] = useState("");
  const [exportFormat, setExportFormat] = useState("pdf");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchNovels();
  }, []);

  const handleStartNovel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !premise.trim()) return;
    try {
      const created = await createNovel(title, genre, premise);
      setShowNewModal(false);
      setTitle("");
      setPremise("");
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleSelectNovel = async (id: string) => {
    const novel = await fetchNovel(id);
    if (novel.status === "planning") {
      setView("setup");
    } else if (novel.status === "writing") {
      setView("editor");
    } else {
      setView("bible");
    }
  };

  const handleFullNovelDownload = () => {
    if (!currentNovel) return;
    setErrorMsg("");
    // Standard validation
    const draftedChapters = currentNovel.chapters?.filter(c => c.status !== "outline") || [];
    if (draftedChapters.length === 0) {
      setErrorMsg("You need to draft at least one chapter before you can export the full novel!");
      return;
    }
    window.open(`/api/novels/${currentNovel.id}/export/${exportFormat}`);
  };

  // Compile calculations
  const totalChapters = currentNovel?.chapters?.length || 0;
  const completedChapters = currentNovel?.chapters?.filter((c) => c.status === "drafted" || c.status === "edited" || c.status === "final").length || 0;
  const wordCountSum = currentNovel?.chapters?.reduce((acc, c) => acc + (c.wordCount || 0), 0) || 0;
  const totalReadTime = Math.ceil(wordCountSum / 200);
  const totalAudioDuration = Math.ceil(wordCountSum / 150);

  const completionPercent = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Top Welcome Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
            NovelForge Dashboard
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">
            Manage your long-form stories and AI-assisted exports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="px-3.5 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 transition"
          >
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Start Story Idea
          </button>
        </div>
      </div>

      {currentNovel && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Active Novel Stats */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded uppercase">
                  Active Project
                </span>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-2">
                  {currentNovel.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Genre: {currentNovel.genre} (Status: {currentNovel.status})
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleSelectNovel(currentNovel.id)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-705 dark:text-indigo-400"
                >
                  Open Workspace &rarr;
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${currentNovel.title}"?`)) {
                      deleteNovel(currentNovel.id);
                    }
                  }}
                  className="text-xs font-bold text-rose-500 hover:text-rose-650"
                >
                  Delete Project
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Writing Progress</span>
                <span>{completionPercent}% ({completedChapters}/{totalChapters} Chapters Drafted)</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-center md:text-left">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase">Word Count</p>
                <p className="text-lg font-extrabold text-slate-850 dark:text-slate-100">{wordCountSum}</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase">Reading Time</p>
                <p className="text-lg font-extrabold text-slate-850 dark:text-slate-100">{totalReadTime} Min</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase">Audio Duration</p>
                <p className="text-lg font-extrabold text-slate-850 dark:text-slate-100">{totalAudioDuration} Min</p>
              </div>
            </div>
          </div>

          {/* Compiled Export Module */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-850 dark:text-slate-100">Compiled Book Export</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed font-medium">
                Assemble and download your completed chapters combined into a single, polished novel layout.
              </p>

              {errorMsg && (
                <div className="flex gap-2 items-start bg-rose-50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50 p-3 rounded-lg text-xs text-rose-600 dark:text-rose-455 font-semibold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase">
                  Select Format
                </label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded font-semibold text-slate-700 dark:text-slate-350 outline-none"
                >
                  <option value="pdf">PDF — Styled Book Layout</option>
                  <option value="docx">Word (.docx) Document</option>
                  <option value="epub">EPUB — E-Reader Format</option>
                  <option value="md">Markdown File</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleFullNovelDownload}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg text-xs transition"
            >
              <Download className="w-4 h-4" /> Download Full Combined Book
            </button>
          </div>
        </div>
      )}

      {/* Novels List Grid */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 uppercase tracking-wide">
          Your Projects
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {novels.map((novel) => (
            <div
              key={novel.id}
              onClick={() => handleSelectNovel(novel.id)}
              className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition cursor-pointer space-y-4 flex flex-col justify-between"
            >
              <div>
                 <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase">
                    {novel.genre}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded uppercase">
                      {novel.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete "${novel.title}"?`)) {
                          deleteNovel(novel.id);
                        }
                      }}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-rose-500"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-2 truncate">
                  {novel.title}
                </h4>
                <p className="mt-1 text-xs text-slate-550 dark:text-slate-400 line-clamp-3 italic">
                  {novel.premise}
                </p>
              </div>

              <div className="text-[10px] font-semibold text-slate-400">
                Created: {new Date(novel.createdAt as any).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal Dialog */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-850 dark:text-slate-100">
                Start a New Story
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-450 font-medium">
                Answer simple AI prompts to outline characters, world maps, and plots.
              </p>
            </div>

            <form onSubmit={handleStartNovel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Story Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. The Iron Chronicle"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-850 dark:text-slate-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Genre
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-850 dark:text-slate-100 text-sm"
                >
                  <option value="Fantasy">Fantasy</option>
                  <option value="Sci-Fi">Sci-Fi</option>
                  <option value="Mystery">Mystery</option>
                  <option value="Thriller">Thriller</option>
                  <option value="Horror">Horror</option>
                  <option value="General Fiction">General Fiction</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Story Idea / Core Premise
                </label>
                <textarea
                  required
                  value={premise}
                  onChange={(e) => setPremise(e.target.value)}
                  placeholder="Write a few lines about the main conflict, protagonist, or setting..."
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-850 dark:text-slate-100 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:underline px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded text-xs transition"
                >
                  Start Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
