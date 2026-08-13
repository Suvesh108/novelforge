import React, { useState, useEffect } from "react";
import { useStore } from "../store.ts";
import { Sparkles, ArrowRight, SkipForward, FileText, CheckCircle2 } from "lucide-react";

export default function SetupFlow() {
  const { currentNovel, updateNovel, askSetupQuestion, generateStoryBible, generateOutline, setView, isGenerating } = useStore();
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [qaHistory, setQaHistory] = useState<{ q: string; a: string }[]>([]);
  const [manualTab, setManualTab] = useState<"general" | "character" | "world" | "magic" | "chapters">("general");

  // Local state for manual fields
  const [premise, setPremise] = useState(currentNovel?.premise || "");
  const [genre, setGenre] = useState(currentNovel?.genre || "");
  const [subgenre, setSubgenre] = useState(currentNovel?.subgenre || "");
  const [tone, setTone] = useState(JSON.parse(currentNovel?.tone || "[]").join(", "));
  const [themes, setThemes] = useState(JSON.parse(currentNovel?.themes || "[]").join(", "));

  const [charName, setCharName] = useState(currentNovel?.mainCharacter?.name || "");
  const [charPersonality, setCharPersonality] = useState(currentNovel?.mainCharacter?.personality || "");
  const [charGoals, setCharGoals] = useState(currentNovel?.mainCharacter?.goals || "");

  const [worldName, setWorldName] = useState(currentNovel?.world?.worldName || "");
  const [worldType, setWorldType] = useState(currentNovel?.world?.worldType || "");
  const [worldGeography, setWorldGeography] = useState(currentNovel?.world?.geography || "");

  const [magicSource, setMagicSource] = useState(currentNovel?.magicSystem?.source || "");
  const [magicRules, setMagicRules] = useState(currentNovel?.magicSystem?.manaRules || "");

  const [totalChapters, setTotalChapters] = useState(currentNovel?.chapterConfig?.totalChapters || 10);
  const [targetWords, setTargetWords] = useState(currentNovel?.chapterConfig?.targetWordCount || 3000);

  useEffect(() => {
    if (currentNovel && !question && !isGenerating) {
      loadNextQuestion();
    }
  }, [currentNovel?.id]);

  useEffect(() => {
    if (currentNovel) {
      setPremise(currentNovel.premise || "");
      setGenre(currentNovel.genre || "");
      setSubgenre(currentNovel.subgenre || "");
      setTone(JSON.parse(currentNovel.tone || "[]").join(", "));
      setThemes(JSON.parse(currentNovel.themes || "[]").join(", "));
      setCharName(currentNovel.mainCharacter?.name || "");
      setCharPersonality(currentNovel.mainCharacter?.personality || "");
      setCharGoals(currentNovel.mainCharacter?.goals || "");
      setWorldName(currentNovel.world?.worldName || "");
      setWorldType(currentNovel.world?.worldType || "");
      setWorldGeography(currentNovel.world?.geography || "");
      setMagicSource(currentNovel.magicSystem?.source || "");
      setMagicRules(currentNovel.magicSystem?.manaRules || "");
      setTotalChapters(currentNovel.chapterConfig?.totalChapters || 10);
      setTargetWords(currentNovel.chapterConfig?.targetWordCount || 3000);
      
      setQuestion("");
      setAnswer("");
      setQaHistory([]);
    }
  }, [currentNovel?.id]);

  const loadNextQuestion = async () => {
    if (!currentNovel) return;
    try {
      const q = await askSetupQuestion(currentNovel.id);
      setQuestion(q);
    } catch (e) {
      setQuestion("What is the primary motivation or goal for your protagonist?");
    }
  };

  const handleAnswerSubmit = async () => {
    if (!currentNovel || !answer.trim()) return;

    // Compile answered info to save
    setQaHistory((prev) => [...prev, { q: question, a: answer }]);
    setAnswer("");

    // Push setup answers into database as part of updates
    // ponytail: append QA to premise for simple aggregation
    const updatedPremise = `${currentNovel.premise}\nQ: ${question}\nA: ${answer}`;
    await updateNovel(currentNovel.id, { premise: updatedPremise });
    setPremise(updatedPremise);
    
    await loadNextQuestion();
  };

  const handleSkipQuestion = async () => {
    if (!currentNovel) return;
    await loadNextQuestion();
  };

  const handleSaveManual = async () => {
    if (!currentNovel) return;
    await updateNovel(currentNovel.id, {
      premise,
      genre,
      subgenre,
      tone: tone.split(",").map((t: string) => t.trim()).filter(Boolean),
      themes: themes.split(",").map((t: string) => t.trim()).filter(Boolean),
      mainCharacter: {
        name: charName,
        personality: charPersonality,
        goals: charGoals,
      },
      world: {
        worldName,
        worldType,
        geography: worldGeography,
      },
      magicSystem: {
        source: magicSource,
        manaRules: magicRules,
      },
      chapterConfig: {
        totalChapters: Number(totalChapters),
        targetWordCount: Number(targetWords),
      }
    });
  };

  const handleBuildStoryBible = async () => {
    if (!currentNovel) return;
    await handleSaveManual();
    await generateStoryBible(currentNovel.id);
    await generateOutline(currentNovel.id);
    setView("bible");
  };

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
      {/* Conversational AI Flow Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Adaptive Questionnaire</h2>
          </div>

          {isGenerating ? (
            <div className="animate-pulse space-y-4 py-8">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {question && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-lg p-5">
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">AI Question</span>
                  <p className="mt-2 text-lg text-slate-700 dark:text-slate-200 font-medium">{question}</p>
                </div>
              )}

              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your thoughts, details, or ideas here..."
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAnswerSubmit}
                  disabled={!answer.trim()}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Answer <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSkipQuestion}
                  className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 font-medium px-4 py-2.5 rounded-lg transition"
                >
                  <SkipForward className="w-4 h-4" /> Skip
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Q&A Summary List */}
        {qaHistory.length > 0 && (
          <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Collected Answers</h3>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
              {qaHistory.map((item, idx) => (
                <div key={idx} className="text-xs bg-slate-50 dark:bg-slate-950 p-2.5 rounded border border-slate-100 dark:border-slate-900">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Q: {item.q}</p>
                  <p className="mt-1 text-slate-600 dark:text-slate-400 italic">A: {item.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual Story Data Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Configure Details Manual</h2>
          </div>

          {/* Subtabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 mb-6 gap-2 overflow-x-auto">
            {(["general", "character", "world", "magic", "chapters"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setManualTab(tab)}
                className={`pb-2 px-1 text-sm font-semibold border-b-2 capitalize whitespace-nowrap transition ${
                  manualTab === tab
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {manualTab === "general" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Premise / Story Idea</label>
                  <textarea
                    value={premise}
                    onChange={(e) => setPremise(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Genre</label>
                    <input
                      type="text"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Subgenre</label>
                    <input
                      type="text"
                      value={subgenre}
                      onChange={(e) => setSubgenre(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Tones (comma-separated)</label>
                    <input
                      type="text"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      placeholder="Dark, Epic, Melancholic"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Themes (comma-separated)</label>
                    <input
                      type="text"
                      value={themes}
                      onChange={(e) => setThemes(e.target.value)}
                      placeholder="Redemption, Power, Loss"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {manualTab === "character" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Protagonist Name</label>
                  <input
                    type="text"
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Personality Traits</label>
                  <textarea
                    value={charPersonality}
                    onChange={(e) => setCharPersonality(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Primary Goals & Motivations</label>
                  <textarea
                    value={charGoals}
                    onChange={(e) => setCharGoals(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                  />
                </div>
              </>
            )}

            {manualTab === "world" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">World Name</label>
                    <input
                      type="text"
                      value={worldName}
                      onChange={(e) => setWorldName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Setting Type / Era</label>
                    <input
                      type="text"
                      value={worldType}
                      onChange={(e) => setWorldType(e.target.value)}
                      placeholder="Medieval Fantasy, Cyberpunk"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Key Geography & Locations</label>
                  <textarea
                    value={worldGeography}
                    onChange={(e) => setWorldGeography(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                  />
                </div>
              </>
            )}

            {manualTab === "magic" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Magic System Source (if any)</label>
                  <input
                    type="text"
                    value={magicSource}
                    onChange={(e) => setMagicSource(e.target.value)}
                    placeholder="Mana, Elemental Gates, Runes"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">System Rules & Limitations</label>
                  <textarea
                    value={magicRules}
                    onChange={(e) => setMagicRules(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                  />
                </div>
              </>
            )}

            {manualTab === "chapters" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Total Chapters</label>
                  <input
                    type="number"
                    value={totalChapters}
                    onChange={(e) => setTotalChapters(Number(e.target.value))}
                    min={1}
                    max={50}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Target Word Count / Chapter</label>
                  <input
                    type="number"
                    value={targetWords}
                    onChange={(e) => setTargetWords(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none text-slate-800 dark:text-slate-100 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
          <button
            onClick={handleSaveManual}
            className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 px-4 py-2 rounded transition"
          >
            Save Draft Details
          </button>
          
          <button
            onClick={handleBuildStoryBible}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg transition shadow-sm shadow-indigo-200 dark:shadow-none"
          >
            <CheckCircle2 className="w-4 h-4" /> Generate Story Bible & Outlines
          </button>
        </div>
      </div>
    </div>
  );
}
