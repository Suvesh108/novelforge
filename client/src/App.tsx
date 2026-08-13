import React, { useEffect, useState } from "react";
import { useStore } from "./store.ts";
import Dashboard from "./components/Dashboard.tsx";
import SetupFlow from "./components/SetupFlow.tsx";
import StoryBible from "./components/StoryBible.tsx";
import Editor from "./components/Editor.tsx";
import { BookOpen, LayoutDashboard, Settings, FileSpreadsheet, Sparkles, Moon, Sun, Key, ArrowLeft, Trash2, Plus, RefreshCw } from "lucide-react";

export default function App() {
  const { currentNovel, activeView, setView, goBack, viewHistory, fetchNovels, updateNovel, darkMode, setDarkMode } = useStore();

  const [showApiModal, setShowApiModal] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-1.5-flash");
  const [temp, setTemp] = useState(0.7);

  // Advanced Multi-Key & Self-Testing states
  const [storedKeys, setStoredKeys] = useState<Record<string, Array<{ key: string; models: string[] }>>>({});
  const [newKey, setNewKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    fetchNovels();
    const rawKeys = localStorage.getItem("novel-forge-stored-keys");
    if (rawKeys) {
      try {
        setStoredKeys(JSON.parse(rawKeys));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (currentNovel?.providerSettings) {
      try {
        const settings = JSON.parse(currentNovel.providerSettings);
        setProvider(settings.provider || "gemini");
        setApiKey(settings.apiKeyRef || "");
        setModel(settings.model || "");
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
          setModel(settings.model || "");
          setTemp(settings.temperature ?? 0.7);
        } catch (e) {}
      }
    }
  }, [currentNovel]);

  // Sync available models and defaults when provider or keys list changes
  useEffect(() => {
    const keysForProvider = storedKeys[provider] || [];
    const matchingKey = keysForProvider.find(k => k.key === apiKey);
    if (matchingKey) {
      setAvailableModels(matchingKey.models);
      if (!matchingKey.models.includes(model) && matchingKey.models.length > 0) {
        setModel(matchingKey.models[0]);
      }
    } else if (keysForProvider.length > 0) {
      setApiKey(keysForProvider[0].key);
      setAvailableModels(keysForProvider[0].models);
      setModel(keysForProvider[0].models[0]);
    } else {
      setApiKey("");
      setAvailableModels([]);
      setModel("");
    }
  }, [provider, storedKeys, apiKey]);

  const handleAddKey = async () => {
    if (!newKey.trim()) return;
    const providerKeys = storedKeys[provider] || [];
    if (providerKeys.length >= 10) {
      setApiError("Maximum of 10 keys allowed per provider.");
      return;
    }
    if (providerKeys.some(k => k.key === newKey.trim())) {
      setApiError("This key is already registered.");
      return;
    }

    setIsTesting(true);
    setApiError("");

    try {
      const res = await fetch("/api/test-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: newKey.trim() })
      });

      if (!res.ok) throw new Error("Verification probe failed");
      const { workingModels } = await res.json();

      if (!workingModels || workingModels.length === 0) {
        setApiError("Validation failed: No working models supported on this key/tier.");
        return;
      }

      const updatedKeys = {
        ...storedKeys,
        [provider]: [...providerKeys, { key: newKey.trim(), models: workingModels }]
      };

      setStoredKeys(updatedKeys);
      localStorage.setItem("novel-forge-stored-keys", JSON.stringify(updatedKeys));
      
      setApiKey(newKey.trim());
      setAvailableModels(workingModels);
      setModel(workingModels[0]);
      setNewKey("");
    } catch (e: any) {
      setApiError(e.message || "Failed to validate key. Verify network connection.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleDeleteKey = (keyToDelete: string) => {
    const providerKeys = storedKeys[provider] || [];
    const nextKeys = providerKeys.filter(k => k.key !== keyToDelete);
    const updatedKeys = {
      ...storedKeys,
      [provider]: nextKeys
    };
    setStoredKeys(updatedKeys);
    localStorage.setItem("novel-forge-stored-keys", JSON.stringify(updatedKeys));

    if (apiKey === keyToDelete) {
      if (nextKeys.length > 0) {
        setApiKey(nextKeys[0].key);
        setAvailableModels(nextKeys[0].models);
        setModel(nextKeys[0].models[0]);
      } else {
        setApiKey("");
        setAvailableModels([]);
        setModel("");
      }
    }
  };

  const handleSaveApi = async (e: React.FormEvent) => {
    e.preventDefault();
    const settings = {
      provider,
      apiKeyRef: apiKey,
      model,
      temperature: Number(temp),
    };
    
    // Write legacy single-key format (used by resolvers as fallback)
    localStorage.setItem("novel-forge-api-settings", JSON.stringify(settings));
    // Write active provider + model so all resolver paths find the key
    localStorage.setItem("novel-forge-active-provider", provider);
    localStorage.setItem(`novel-forge-active-model-${provider}`, model);
    localStorage.setItem(`novel-forge-active-temp-${provider}`, String(temp));

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
                Add and manage up to 10 API keys. We test and list only models working for your key.
              </p>
            </div>

            <form onSubmit={handleSaveApi} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-450 mb-1">
                  API Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-xs font-semibold"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="groq">Groq</option>
                  <option value="mistral">Mistral</option>
                  <option value="cohere">Cohere</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="custom">Custom (OpenAI-compatible)</option>
                </select>
              </div>

              {/* List of existing keys */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Saved API Keys (Max 10)
                </span>
                <div className="max-h-28 overflow-y-auto space-y-1 bg-slate-50 dark:bg-slate-950 p-2 border border-slate-250 dark:border-slate-805 rounded-lg">
                  {(storedKeys[provider] || []).length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">No keys saved for this provider.</p>
                  ) : (
                    (storedKeys[provider] || []).map((k, index) => {
                      const isSelected = apiKey === k.key;
                      const masked = k.key.length > 8 ? k.key.slice(0, 5) + "..." + k.key.slice(-4) : "..." + k.key.slice(-3);
                      return (
                        <div
                          key={index}
                          onClick={() => {
                            setApiKey(k.key);
                            setAvailableModels(k.models);
                            if (k.models.length > 0) setModel(k.models[0]);
                          }}
                          className={`flex items-center justify-between p-1.5 rounded text-xs cursor-pointer border ${
                            isSelected
                              ? "bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/40 dark:border-indigo-900"
                              : "border-transparent text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-850"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="active-key"
                              checked={isSelected}
                              onChange={() => {}}
                              className="accent-indigo-650"
                            />
                            <span className="font-semibold">{masked}</span>
                            <span className="text-[9px] text-slate-400 font-bold">({k.models.length} models)</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteKey(k.key);
                            }}
                            className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Paste/Add API Key Section */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-450">
                  Register New API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Paste key to validate & save..."
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleAddKey}
                    disabled={isTesting || !newKey.trim()}
                    className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center justify-center gap-1 transition disabled:opacity-50"
                    title="Validate and Add Key"
                  >
                    {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
                {apiError && (
                  <p className="text-[10px] text-rose-550 font-bold leading-tight">{apiError}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-450 mb-1">
                    Model
                  </label>
                  {availableModels.length > 0 ? (
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-xs font-semibold"
                    >
                      {availableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Add API key first..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded focus:outline-none text-slate-850 dark:text-slate-100 text-xs font-semibold"
                    />
                  )}
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded focus:outline-none text-slate-855 dark:text-slate-100 text-xs font-semibold"
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
