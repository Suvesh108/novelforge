import dotenv from "dotenv";
dotenv.config();

export interface ProviderSettings {
  provider: "gemini" | "openai" | "openrouter" | "custom";
  apiKeyRef?: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  systemPromptOverride?: string;
  contextSizeLimit?: number;
}

export interface AIProvider {
  generate(
    prompt: string,
    systemInstruction?: string,
    onChunk?: (text: string) => void
  ): Promise<string>;
}

export class GeminiProvider implements AIProvider {
  constructor(private settings: ProviderSettings) {}

  async generate(
    prompt: string,
    systemInstruction?: string,
    onChunk?: (text: string) => void
  ): Promise<string> {
    const apiKey = this.settings.apiKeyRef || process.env.GEMINI_API_KEY || "";
    if (!apiKey) throw new Error("Gemini API key is not configured.");

    const model = this.settings.model || "gemini-1.5-flash";
    const mode = onChunk ? "streamGenerateContent" : "generateContent";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${mode}?key=${apiKey}${onChunk ? "&alt=sse" : ""}`;

    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: this.settings.temperature ?? 0.7,
        maxOutputTokens: this.settings.maxOutputTokens ?? 4096,
      }
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    if (onChunk && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (text) {
                fullText += text;
                onChunk(text);
              }
            } catch (e) {
              // Ignore invalid JSON lines
            }
          }
        }
      }
      return fullText;
    } else {
      const data: any = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
  }
}

export class OpenAIProvider implements AIProvider {
  constructor(private settings: ProviderSettings) {}

  async generate(
    prompt: string,
    systemInstruction?: string,
    onChunk?: (text: string) => void
  ): Promise<string> {
    const apiKey = this.settings.apiKeyRef || process.env.OPENAI_API_KEY || "";
    if (!apiKey) throw new Error("OpenAI API key is not configured.");

    const model = this.settings.model || "gpt-4o-mini";
    const isStream = !!onChunk;
    const url = "https://api.openai.com/v1/chat/completions";

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: this.settings.temperature ?? 0.7,
        max_tokens: this.settings.maxOutputTokens ?? 4096,
        stream: isStream,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${errorText}`);
    }

    if (isStream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith("data: ")) {
            const dataStr = cleanLine.slice(6);
            if (dataStr === "[DONE]") continue;
            try {
              const data = JSON.parse(dataStr);
              const text = data.choices?.[0]?.delta?.content || "";
              if (text) {
                fullText += text;
                onChunk(text);
              }
            } catch (e) {
              // Ignore invalid JSON lines
            }
          }
        }
      }
      return fullText;
    } else {
      const data: any = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }
  }
}

export class ProviderFactory {
  static getProvider(settingsJson: string | null): AIProvider {
    // Default provider setup: default to gemini using standard key if settings are null
    const settings: ProviderSettings = settingsJson
      ? JSON.parse(settingsJson)
      : { provider: "gemini", model: "gemini-1.5-flash" };

    if (settings.provider === "openai" || settings.provider === "openrouter" || settings.provider === "custom") {
      // openrouter and custom can be run using the OpenAI compatible endpoint wrapper
      const endpointSettings = { ...settings };
      if (settings.provider === "openrouter") {
        endpointSettings.apiKeyRef = settings.apiKeyRef || process.env.OPENROUTER_API_KEY || "";
      }
      return new OpenAIProvider(endpointSettings);
    }

    // Default to Gemini
    return new GeminiProvider(settings);
  }
}
