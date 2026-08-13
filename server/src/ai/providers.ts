import dotenv from "dotenv";
dotenv.config();

export interface ProviderSettings {
  provider: "gemini" | "openai" | "openrouter" | "custom" | "anthropic" | "groq" | "mistral" | "cohere";
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
    const apiKey = this.settings.apiKeyRef || "";
    if (!apiKey) throw new Error(`${this.settings.provider.toUpperCase()} API key is not configured.`);

    const model = this.settings.model;
    const isStream = !!onChunk;
    
    let url = "https://api.openai.com/v1/chat/completions";
    if (this.settings.provider === "openrouter") {
      url = "https://openrouter.ai/api/v1/chat/completions";
    } else if (this.settings.provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
    } else if (this.settings.provider === "mistral") {
      url = "https://api.mistral.ai/v1/chat/completions";
    } else if (this.settings.provider === "cohere") {
      url = "https://api.cohere.com/v1/chat/completions";
    } else if (this.settings.provider === "custom") {
      url = process.env.CUSTOM_API_BASE_URL || "https://api.openai.com/v1/chat/completions";
    }

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
      throw new Error(`${this.settings.provider.toUpperCase()} API Error (${response.status}): ${errorText}`);
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

export class AnthropicProvider implements AIProvider {
  constructor(private settings: ProviderSettings) {}

  async generate(
    prompt: string,
    systemInstruction?: string,
    onChunk?: (text: string) => void
  ): Promise<string> {
    const apiKey = this.settings.apiKeyRef || "";
    if (!apiKey) throw new Error("Anthropic API key is not configured.");

    const model = this.settings.model || "claude-3-5-sonnet-20240620";
    const isStream = !!onChunk;
    const url = "https://api.anthropic.com/v1/messages";

    const body: any = {
      model,
      max_tokens: this.settings.maxOutputTokens ?? 4000,
      messages: [{ role: "user", content: prompt }],
      temperature: this.settings.temperature ?? 0.7,
      stream: isStream,
    };

    if (systemInstruction) {
      body.system = systemInstruction;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API Error (${response.status}): ${errorText}`);
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
            try {
              const data = JSON.parse(cleanLine.slice(6));
              if (data.type === "content_block_delta" && data.delta?.text) {
                const text = data.delta.text;
                fullText += text;
                onChunk(text);
              }
            } catch (e) {
              // Ignore invalid lines
            }
          }
        }
      }
      return fullText;
    } else {
      const data: any = await response.json();
      return data.content?.[0]?.text || "";
    }
  }
}

export class ProviderFactory {
  static getProvider(settingsJson: string | null): AIProvider {
    const settings: ProviderSettings = settingsJson
      ? JSON.parse(settingsJson)
      : { provider: "gemini", model: "gemini-1.5-flash" };

    if (settings.provider === "anthropic") {
      return new AnthropicProvider(settings);
    }

    if (
      settings.provider === "openai" ||
      settings.provider === "openrouter" ||
      settings.provider === "groq" ||
      settings.provider === "mistral" ||
      settings.provider === "cohere" ||
      settings.provider === "custom"
    ) {
      return new OpenAIProvider(settings);
    }

    return new GeminiProvider(settings);
  }
}
