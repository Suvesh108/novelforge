import React, { useEffect, useState } from "react";
import { useStore } from "./store.ts";
import Dashboard from "./components/Dashboard.tsx";
import SetupFlow from "./components/SetupFlow.tsx";
import StoryBible from "./components/StoryBible.tsx";
import Editor from "./components/Editor.tsx";
import { BookOpen, LayoutDashboard, Settings, FileSpreadsheet, Sparkles, Moon, Sun, Key, ArrowLeft } from "lucide-react";

export default function App() {
  const { currentNovel, activeView, setView, goBack, viewHistory, fetchNovels, updateNovel, darkMode, setDarkMode } = useStore();

  const [showApiModal, setShowApiModal] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-1.5-flash");
  const [temp, setTemp] = useState(0.7);

  useEffect(() => {
    fetchNovels();
  }, []);

  useEffect(() => {
    if (currentNovel?.providerSettings) {
      try {
        const settings = JSON.parse(currentNovel.providerSettings);
        setProvider(settings.provider || "gemini");
        setApiKey(settings.apiKeyRef || "");
        setModel(settings.model || "gemini-1.5-flash");
        setTemp(settings.temperature ?? 0.7);
      } catch (e) {
        // Fallback silently
      }
    } else {
      const localSettings = localStorage.getItem("novel-forge-api-settings");
      if (localSettings) {
        try {
          const settings = JSON.parse(localSettings);
          setProvider(settings.provider || "gemini");
          setApiKey(settings.apiKeyRef || "");
          setModel(settings.model || "gemini-1.5-flash");
          setTemp(settings.temperature ?? 0.7);
        } catch (e) {}
      }
    }
  }, [currentNovel]);

  const handleSaveApi = async (e: React.FormEvent) => {
    e.preventDefault();
    const settings = {
      provider,
      apiKeyRef: apiKey,
      model,
      temperature: Number(temp),
    };
    
    localStorage.setItem("novel-forge-api-settings", JSON.stringify(settings));

    if (currentNovel) {
      await updateNovel(currentNovel.id, { providerSettings: settings } as any);
    }

    setShowApiModal(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50 transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView("dashboard")}>
            <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span className="font-extrabold text-lg tracking-tight text-slate-855 dark:text-slate-100">
              NovelForge
            </span>
          </div>

          {currentNovel && (
            <div className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-850 px-3 py-1 rounded text-xs font-semibold text-slate-650 dark:text-slate-400">
              <span className="font-bold">Project:</span>
              <span className="truncate max-w-[150px]">{currentNovel.title}</span>
            </div>
          )}
        </div>

        {/* View Switches & API Key toggler */}
        <div className="flex items-center gap-4">
          {currentNovel && (
            <nav className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-800 pr-4 mr-2">
              <button
                onClick={() => setView("dashboard")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeView === "dashboard"
                    ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-405 dark:hover:bg-slate-850"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
              </button>

              <button
                onClick={() => setView("setup")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeView === "setup"
                    ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-405 dark:hover:bg-slate-850"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Setup Flow
              </button>

              <button
                onClick={() => setView("bible")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeView === "bible"
                    ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-405 dark:hover:bg-slate-850"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> Story Bible
              </button>

              <button
                onClick={() => setView("editor")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeView === "editor"
                    ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-405 dark:hover:bg-slate-850"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Editor
              </button>
            </nav>
          )}

          {/* API settings toggler */}
          <button
            onClick={() => setShowApiModal(true)}
            className="flex items-center gap-1 text-xs font-bold bg-slate-105 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg transition"
            title="Configure API Keys"
          >
            <Key className="w-3.5 h-3.5 font-bold" /> API Keys
          </button>

          {/* Theme toggler */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 transition"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main View Container */}
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 relative">
        {viewHistory.length > 1 && (
          <button
            onClick={goBack}
            className="fixed bottom-6 left-6 md:absolute md:top-4 md:left-4 z-50 flex items-center justify-center w-8 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 rounded-full shadow-md transition-all"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        {activeView === "dashboard" && <Dashboard />}
        {activeView === "setup" && <SetupFlow />}
        {activeView === "bible" && <StoryBible />}
        {activeView === "editor" && <Editor />}
      </main>

      {/* API Configuration Modal */}
      {showApiModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-850 dark:text-slate-100">
                AI Provider Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-450 font-medium">
                Enter your API keys manually. They are saved client-side and never exposed.
              </p>
            </div>

            <form onSubmit={handleSaveApi} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-450 mb-1">
                  API Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => {
                    const p = e.target.value;
                    setProvider(p);
                    if (p === "gemini") setModel("gemini-1.5-flash");
                    else if (p === "openai") setModel("gpt-4o-mini");
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-xs font-semibold"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="custom">Custom (OpenAI-compatible)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-450 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={apiKey ? "••••••••••••••••" : "Paste your API key here..."}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-450 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. gemini-1.5-flash"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded focus:outline-none text-slate-850 dark:text-slate-100 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-450 mb-1">
                    Temperature
                  </label>
                  <input
                    type="number"
                    value={temp}
                    onChange={(e) => setTemp(Number(e.target.value))}
                    min={0.0}
                    max={1.0}
                    step={0.1}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded focus:outline-none text-slate-850 dark:text-slate-100 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowApiModal(false)}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:underline px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded text-xs transition"
                >
                  Save settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
