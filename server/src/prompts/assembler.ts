export interface StoryContext {
  novel: {
    title: string;
    genre: string;
    subgenre?: string | null;
    tone: string; // JSON array string
    premise: string;
    themes: string; // JSON array string
  };
  mainCharacter?: any;
  importantCharacters?: any[];
  world?: any;
  magicSystem?: any;
  requirements?: any;
  chapterConfig?: any;
  storyBible?: string | null;
  chapters?: any[];
  openThreads?: any[];
  // For generation tasks
  currentChapterNumber?: number;
  currentChapterOutline?: any;
  priorSummaries?: any[];
  priorCharacterStates?: any[];
  priorWorldStates?: any[];
  // For refinement tasks
  selectedText?: string;
  instruction?: string;
  writingMode?: string;
}

export function assemblePrompt(task: string, ctx: StoryContext): { systemPrompt: string; userPrompt: string } {
  const tones = JSON.parse(ctx.novel.tone || "[]").join(", ");
  const themes = JSON.parse(ctx.novel.themes || "[]").join(", ");

  let modeInstruction = "";
  if (ctx.writingMode === "draft") {
    modeInstruction = "\nWriting Mode: DRAFT. Keep prose straightforward, fast-paced, and concise for quick layout planning.";
  } else if (ctx.writingMode === "high_quality") {
    modeInstruction = "\nWriting Mode: HIGH QUALITY. Produce highly detailed prose, rich sensory and atmospheric descriptions, and allow scenes to breathe with authentic character reactions.";
  } else {
    modeInstruction = "\nWriting Mode: NORMAL. Maintain balanced pacing, standard description depth, and natural story flow.";
  }

  const systemInstructions = `You are a professional, bestselling novelist writing strictly in a natural human language tone.
Your output must be dedicated solely to writing and story planning purposes.
Maintain absolute continuity and consistency by strictly adhering to the memory parameters provided (prior chapter summaries, character states, world states, and open threads) for this particular novel.
Avoid all meta-commentary, introductory notes, or conversational filler. Output ONLY the requested content directly.${modeInstruction}`;

  // Modular sections
  const sections: Record<string, string> = {
    novelCore: `### STORY METADATA
Title: ${ctx.novel.title}
Genre: ${ctx.novel.genre} (Subgenre: ${ctx.novel.subgenre || "None"})
Tones: ${tones}
Premise: ${ctx.novel.premise}
Themes: ${themes}`,

    characterBible: ctx.mainCharacter ? `### PROTAGONIST
Name: ${ctx.mainCharacter.name || "Unnamed"}
Age: ${ctx.mainCharacter.age || "Unknown"}
Gender: ${ctx.mainCharacter.gender || "Unknown"}
Personality: ${ctx.mainCharacter.personality || ""}
Appearance: ${ctx.mainCharacter.appearance || ""}
Background: ${ctx.mainCharacter.background || ""}
Goals: ${ctx.mainCharacter.goals || ""}
Fears: ${ctx.mainCharacter.fears || ""}
Motivation: ${ctx.mainCharacter.motivation || ""}
Abilities/Skills: ${ctx.mainCharacter.specialAbilities || ""}
Secrets: ${ctx.mainCharacter.secrets || ""}` : "",

    importantCharacters: ctx.importantCharacters && ctx.importantCharacters.length > 0 ? `### SUPPORTING CHARACTERS
${ctx.importantCharacters.map((c, i) => `${i + 1}. ${c.name} - Role: ${c.role || "N/A"}. Relation to Protagonist: ${c.relationshipToProtagonist || "N/A"}. Description: ${c.description || "N/A"}`).join("\n")}` : "",

    worldBible: ctx.world ? `### WORLD BUILDING
World Name: ${ctx.world.worldName || "Unnamed"}
Type/Era/Tech: ${ctx.world.worldType || ""}, ${ctx.world.era || ""}, Tech level: ${ctx.world.techLevel || ""}
Geography: ${ctx.world.geography || ""}
Society & Politics: ${ctx.world.politicalStructure || ""}, ${ctx.world.socialStructure || ""}
History & Conflicts: ${ctx.world.history || ""}. Major conflicts: ${ctx.world.majorConflicts || ""}` : "",

    magicSystem: ctx.magicSystem && ctx.magicSystem.source ? `### MAGIC SYSTEM
Source: ${ctx.magicSystem.source || ""}
Rules/Costs/Restrictions: ${ctx.magicSystem.manaRules || ""}, Cost: ${ctx.magicSystem.costs || ""}, Restrictions: ${ctx.magicSystem.restrictions || ""}
Spells & Abilities: ${ctx.magicSystem.spells || ""}` : "",

    requirements: ctx.requirements ? `### STORY CONSTRAINTS
Must Happen: ${ctx.requirements.thingsIWant || "None specified"}
Must NOT Happen: ${ctx.requirements.thingsIDontWant || "None specified"}` : "",

    openThreads: ctx.openThreads && ctx.openThreads.length > 0 ? `### OPEN PLOT THREADS
${ctx.openThreads.filter(t => t.status === "open").map(t => `- [${t.type}] ${t.description}`).join("\n")}` : "",
  };

  let userPrompt = "";

  switch (task) {
    case "QUESTIONNAIRE": {
      userPrompt = `Based on the following story context:
${sections.novelCore}

Determine the next most important question to ask the writer to build the plot, characters, or world.
Ask exactly ONE focused question. Do not explain your choice. Offer 3-4 possible multiple-choice suggestions or let them skip.`;
      break;
    }

    case "GENERATE_STORY_BIBLE": {
      userPrompt = `Generate a structured Story Bible including a detailed summary of the main character, secondary characters, world rules, magic system (if applicable), major plot arcs, and relationship dynamics.
Use the following input metadata:
${sections.novelCore}
${sections.characterBible}
${sections.worldBible}
${sections.magicSystem}
${sections.requirements}

Respond in clean markdown layout. Ensure it reads like a professional bible.`;
      break;
    }

    case "GENERATE_CHAPTER_OUTLINE": {
      userPrompt = `Generate a detailed chapter-by-chapter outline for the novel based on the story bible.
The config specifies a total of ${ctx.chapterConfig?.totalChapters || 10} chapters.
For each chapter, provide:
- Chapter Number and Title
- Location & Time
- Characters appearing
- Main events (bullet points)
- Emotional purpose / character development notes
- Foreshadowing & Ending hook
- Target word count

Input:
${sections.novelCore}
Story Bible: ${ctx.storyBible || "See premise and rules"}
${sections.characterBible}
${sections.requirements}`;
      break;
    }

    case "GENERATE_CHAPTER": {
      // Build prior summaries with ponytail context limits (recent ones detailed, older ones compressed)
      const formattedSummaries = (ctx.priorSummaries || []).map((s, idx, arr) => {
        const isRecent = idx >= arr.length - 2;
        if (isRecent) {
          return `Chapter ${s.chapterNumber}: ${s.title}\nSummary: ${s.summaryText}`;
        } else {
          return `Chapter ${s.chapterNumber}: ${s.title} (Brief: ${s.summaryText.substring(0, 150)}...)`;
        }
      }).join("\n\n");

      // Build character and world state info
      const formattedStates = (ctx.priorCharacterStates || []).map(s => {
        return `- Character State [${s.characterId}]: Location is ${s.location || "unknown"}. Health/Injuries: ${s.injuries || "none"}. Emotional: ${s.emotionalState || "normal"}. Key decisions so far: ${s.keyDecisions || "none"}.`;
      }).join("\n");

      const outlineStr = ctx.currentChapterOutline ? `
### CURRENT CHAPTER OUTLINE
Chapter ${ctx.currentChapterOutline.chapterNumber}: ${ctx.currentChapterOutline.title}
Location/Time: ${ctx.currentChapterOutline.location || "N/A"} / ${ctx.currentChapterOutline.time || "N/A"}
Characters: ${ctx.currentChapterOutline.charactersAppearing || "N/A"}
Main Events: ${ctx.currentChapterOutline.mainEvents || "N/A"}
Foreshadowing/Hook: ${ctx.currentChapterOutline.foreshadowing || "N/A"} / ${ctx.currentChapterOutline.endingHook || "N/A"}
Target Word Count: ${ctx.currentChapterOutline.estimatedWordCount || 3000} W` : "";

      userPrompt = `Write the full chapter based on the following guidelines. Maintain rich description, natural dialogue, and match the specified tone.

${sections.novelCore}
${sections.characterBible}
${sections.importantCharacters}
${sections.worldBible}
${sections.magicSystem}
${sections.requirements}

### PRIOR CHAPTER SUMMARIES
${formattedSummaries || "This is the first chapter."}

### CHARACTER STATES
${formattedStates || "Standard default states."}

${sections.openThreads}

${outlineStr}

WRITE THE FULL CHAPTER NOW. Start immediately with the narrative text. Do not repeat the chapter title or number in the output text unless starting with chapter content.`;
      break;
    }

    case "CONTINUE": {
      userPrompt = `Continue writing the story from the point of this text:
"${ctx.selectedText}"
Maintain character voice and current styling.`;
      break;
    }

    case "REWRITE": {
      userPrompt = `Rewrite the following section:
"${ctx.selectedText}"
Instruction: ${ctx.instruction || "Improve writing quality and description"}`;
      break;
    }

    case "EXPAND": {
      userPrompt = `Expand the following scene by adding more descriptive detail, sensory information, character reactions, and dialogue where appropriate.
Scene:
"${ctx.selectedText}"`;
      break;
    }

    case "SHORTEN": {
      userPrompt = `Condense and shorten the following text while retaining the core actions, dialogue, and essential narrative beats:
"${ctx.selectedText}"`;
      break;
    }

    case "IMPROVE": {
      userPrompt = `Proofread, polish, and improve the flow and word choice of the following text:
"${ctx.selectedText}"`;
      break;
    }

    case "SUMMARIZE": {
      userPrompt = `Provide a concise 1-2 paragraph summary of the events that occurred in this text:
"${ctx.selectedText}"
Also output:
1. Updated Character States (JSON format with keys: characterId, location, emotionalState, injuries, knowledge, keyDecisions)
2. Updated World States (JSON format with keys: politicalChanges, newLocations, discoveries, conflicts)
3. Any open threads resolved, or new plot threads introduced (JSON format)`;
      break;
    }

    case "GENERATE_DIALOGUE": {
      userPrompt = `Generate a realistic and engaging dialogue segment for characters based on this scene or instruction:
Instruction: ${ctx.instruction || "Generate standard conversation"}
Context:
"${ctx.selectedText || "Characters talking in the current location."}"`;
      break;
    }

    case "DESCRIBE_SCENE": {
      userPrompt = `Provide a rich, atmospheric sensory description of the scene, setting, or action specified here:
Instruction: ${ctx.instruction || "Describe the surroundings"}
Scene Focus:
"${ctx.selectedText || "The immediate environment"}"`;
      break;
    }

    case "CHECK_CONTINUITY": {
      userPrompt = `Analyze the following text or scene selection and identify any continuity errors, potential plot holes, character inconsistencies (e.g. knowledge they shouldn't have, items they shouldn't possess), or world-building deviations.
Text to check:
"${ctx.selectedText || "No text selected"}"

List any continuity flags found with suggestions for corrections.`;
      break;
    }

    case "GENERATE_IDEAS": {
      userPrompt = `Suggest 3-4 interesting plot hooks, character decisions, or twist options for what could happen next in the story based on the current context.
Context:
"${ctx.selectedText || "The current scene development"}"`;
      break;
    }
  }

  return { systemPrompt: systemInstructions, userPrompt };
}
