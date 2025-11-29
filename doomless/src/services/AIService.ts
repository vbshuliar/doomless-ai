import { Fact } from '../types/Fact';
import { Interaction } from '../types/Interaction';
import { PreferenceAnalysis } from '../types/Preferences';
import { getModelConfig, type ModelConfig } from '../utils/modelLoader';

export type AIProgressEvent =
  | { type: 'model-download'; progress: number }
  | { type: 'parse-start'; topic: string; totalChunks: number }
  | { type: 'parse-chunk-start'; topic: string; chunkIndex: number; totalChunks: number }
  | {
      type: 'parse-chunk-complete';
      topic: string;
      chunkIndex: number;
      totalChunks: number;
      factsGenerated: number;
    }
  | { type: 'parse-complete'; topic: string; totalChunks: number; factsGenerated: number }
  | { type: 'parse-error'; topic: string; message: string }
  | { type: 'storage-save-progress'; topic: string; saved: number; total: number }
  | { type: 'storage-complete'; topic: string; total: number }
  | { type: 'quiz-start'; topic: string; total: number }
  | { type: 'quiz-progress'; topic: string; current: number; total: number }
  | { type: 'quiz-complete'; topic: string; total: number };

type ProgressListener = (event: AIProgressEvent) => void;

export type QuizQuestion = {
  question: string;
  options: string[];
  correct_answer: number;
};

type CompletionMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
};

function stripThinkingBlocks(raw: string): string {
  if (!raw) {
    return raw;
  }

  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
  cleaned = cleaned.replace(/<think>|<\/think>/gi, '');

  return cleaned.trim();
}

// Cactus React Native bridge imports (gracefully degraded when module is missing)
let CactusLMClass: any = null;
try {
  CactusLMClass = require('cactus-react-native').CactusLM;
} catch {
  console.warn('cactus-react-native not found. AI features will not work until installed.');
}

class AIService {
  private lm: any = null;
  private initialized = false;
  private initializing = false;
  private lastDownloadPercent: number | null = null;
  private progressListeners = new Set<ProgressListener>();
  private fallbackEnabled = false;

  subscribeProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  emitProgress(event: AIProgressEvent): void {
    this.progressListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[AIService] Progress listener failed:', error);
      }
    });
  }

  private createModelInstance(
    contextSize: number,
  ): any {
    if (!CactusLMClass) {
      return null;
    }
    return new CactusLMClass({
      contextSize,
    });
  }

  private async prepareModelInstance(
    config: ModelConfig,
  ): Promise<any> {
    const contextSize = config.contextSize ?? 2048;
    const instance = this.createModelInstance(contextSize);

    if (!instance) {
      throw new Error(
        'cactus-react-native is not installed. Please install it following the instructions in CACTUS_INSTALL.md.',
      );
    }

    if (config.preloadModel !== false && typeof instance.download === 'function') {
      this.lastDownloadPercent = null;
      try {
        await instance.download({
          onProgress: (progress: number) => {
            if (!Number.isFinite(progress)) {
              return;
            }
            const pct = Math.round(progress * 100);
            if (this.lastDownloadPercent === pct) {
              return;
            }
            this.lastDownloadPercent = pct;
            if (pct % 5 === 0 || pct === 100) {
              console.log(`[AIService] Downloading Cactus model… ${pct}%`);
            }
            this.emitProgress({ type: 'model-download', progress });
          },
        });
        return instance;
      } catch (error) {
        throw new Error(
          `Failed to download Cactus model: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return instance;
  }

  private async runCompletion(
    messages: CompletionMessage[],
    options: {
      temperature?: number;
      topP?: number;
      topK?: number;
      maxTokens?: number;
      stopSequences?: string[];
    } = {},
  ): Promise<string> {
    if (!this.lm) {
      throw new Error('Model not initialized');
    }

    const result = await this.lm.complete({
      messages,
      options: {
        temperature: options.temperature,
        topP: options.topP,
        topK: options.topK,
        maxTokens: options.maxTokens,
        stopSequences: options.stopSequences,
      },
    });

    if (!result?.success) {
      const message = result?.response || 'Model returned no response';
      throw new Error(message);
    }

    return stripThinkingBlocks(result.response);
  }

  private fallbackParseTextToFacts(text: string, topic: string): Fact[] {
    const normalizedText = text.replace(/\r\n/g, '\n');
    const sentences: string[] = [];

    const lines = normalizedText.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length === 0) {
        continue;
      }

      // Split sentences while preserving punctuation.
      const matches = line.match(/[^.!?]+[.!?]?/g);
      if (matches) {
        for (const fragment of matches) {
          const cleaned = fragment.replace(/^[*-]\s*/, '').replace(/\s+/g, ' ').trim();
          if (cleaned.length > 0) {
            sentences.push(cleaned);
          }
        }
      } else {
        sentences.push(line.replace(/\s+/g, ' '));
      }
    }

    const uniqueFacts = new Set<string>();
    const facts: Fact[] = [];
    const timestamp = new Date().toISOString();

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length === 0) {
        continue;
      }

      const normalized = trimmed.toLowerCase();
      if (uniqueFacts.has(normalized)) {
        continue;
      }

      uniqueFacts.add(normalized);
      const bounded = trimmed.length > 200 ? trimmed.slice(0, 200).trimEnd() : trimmed;
      if (bounded.length === 0) {
        continue;
      }

      facts.push({
        id: 0,
        content: bounded,
        topic,
        source: 'default',
        created_at: timestamp,
      });

      if (facts.length >= 120) {
        break;
      }
    }

    const totalChunks = 1;
    this.emitProgress({ type: 'parse-start', topic, totalChunks });
    this.emitProgress({ type: 'parse-chunk-start', topic, chunkIndex: 1, totalChunks });
    this.emitProgress({
      type: 'parse-chunk-complete',
      topic,
      chunkIndex: 1,
      totalChunks,
      factsGenerated: facts.length,
    });
    this.emitProgress({
      type: 'parse-complete',
      topic,
      totalChunks,
      factsGenerated: facts.length,
    });

    return facts;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializing) {
      // Wait for ongoing initialization
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.initialized) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    this.initializing = true;

    try {
      // If cactus-react-native is not available, skip initialization gracefully.
      if (!CactusLMClass) {
        console.warn(
          '[AIService] cactus-react-native is not installed or failed to load. ' +
            'AI features are disabled for now. See CACTUS_INSTALL.md for setup.',
        );
        this.fallbackEnabled = true;
        this.initialized = true;
        this.initializing = false;
        return;
      }

      const config = getModelConfig();

      try {
        const lmInstance = await this.prepareModelInstance(config);

        if (typeof lmInstance.init === 'function') {
          await lmInstance.init();
        }

        this.lm = lmInstance;
        this.initialized = true;
        this.initializing = false;
        return;
      } catch (error) {
        console.error('[AIService] Failed to initialize Cactus model:', error);
      }

      console.warn(
        '[AIService] Falling back to heuristic processing because Cactus model initialization failed.',
      );
      this.lm = null;
      this.fallbackEnabled = true;
      this.initializing = false;
      this.initialized = true;
      return;
    } catch (error) {
      this.initializing = false;
      console.error('Failed to initialize AI service:', error);
      this.fallbackEnabled = true;
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Parse large text into 200-character facts
   */
  async parseTextToFacts(text: string, topic: string): Promise<Fact[]> {
    await this.ensureInitialized();

    if (this.fallbackEnabled || !this.lm) {
      return this.fallbackParseTextToFacts(text, topic);
    }

    try {
      const normalizedText = text.trim();
      if (normalizedText.length === 0) {
        return [];
      }

      // Split text into chunks for processing (up to 6000 chars per chunk to reduce completion calls)
      const chunkSize = normalizedText.length <= 6000 ? normalizedText.length : 6000;
      const chunks: string[] = [];
      
      for (let i = 0; i < normalizedText.length; i += chunkSize) {
        chunks.push(normalizedText.slice(i, i + chunkSize));
      }

      this.emitProgress({ type: 'parse-start', topic, totalChunks: chunks.length });
      const allFacts: Fact[] = [];

      for (let index = 0; index < chunks.length; index += 1) {
        const chunkIndex = index + 1;
        const chunk = chunks[index];
        this.emitProgress({
          type: 'parse-chunk-start',
          topic,
          chunkIndex,
          totalChunks: chunks.length,
        });
        const prompt = `You extract concise, standalone facts from text.

Rules:
- Only output the final facts.
- Each fact MUST be on its own line.
- Each fact MUST be 200 characters or less.
- Do NOT include any <think> tags or internal thoughts.
- Do NOT explain your reasoning.
- Do NOT add introductions or conclusions.
- Do NOT number the facts (no "1.", "2.", "-", etc.).
- Just output one fact per line.

Text:
${chunk}

Facts:`.trim();

        const messages: CompletionMessage[] = [
          {
            role: 'system',
            content:
              'You are an assistant that extracts short, standalone facts from text. ' +
              'Respond ONLY with the final facts, one per line. Do NOT include <think> tags, ' +
              'internal thoughts, or explanations. No numbering, no extra commentary.',
          },
          { role: 'user', content: prompt },
        ];

        let response: string;
        try {
          response = await this.runCompletion(messages, {
            temperature: 0.45,
            maxTokens: 256,
            stopSequences: ['\n\n\n']
          });
        } catch (completionError) {
          console.error('Error generating facts:', completionError);
          continue;
        }
        
        const cleanedResponse = stripThinkingBlocks(response);

        // Parse facts from response (split by newlines)
        const factLines = cleanedResponse
          .split('\n')
          .map((line) => line.trim())
          .map((line) => line.replace(/^[\d]+\s*[\.\)\-:]\s*/, '').replace(/^[-•]\s*/, '').trim())
          .filter((line) => line.length > 0 && line.length <= 200);

        // Create Fact objects
        for (const content of factLines) {
          if (content.length > 0) {
            allFacts.push({
              id: 0, // Will be set by database
              content: content.substring(0, 200), // Ensure max 200 chars
              topic,
              source: 'default',
              created_at: new Date().toISOString(),
            });
          }
        }

        this.emitProgress({
          type: 'parse-chunk-complete',
          topic,
          chunkIndex,
          totalChunks: chunks.length,
          factsGenerated: factLines.length,
        });
      }

      this.emitProgress({
        type: 'parse-complete',
        topic,
        totalChunks: chunks.length,
        factsGenerated: allFacts.length,
      });
      return allFacts;
    } catch (error) {
      console.error('Error parsing text to facts:', error);
      const message = error instanceof Error ? error.message : 'Unknown parsing error';
      this.emitProgress({ type: 'parse-error', topic, message });
      throw error;
    }
  }

  /**
   * Analyze user preferences based on interactions
   */
  async analyzeUserPreference(interactions: Interaction[]): Promise<PreferenceAnalysis> {
    await this.ensureInitialized();

    const baselineAnalysis = (): PreferenceAnalysis => {
      if (interactions.length === 0) {
        return {
          preferred_topics: [],
          disliked_topics: [],
          neutral_topics: [],
          overall_scores: {},
        };
      }

      const rightSwipes = interactions.filter((i) => i.direction === 'right').length;
      const leftSwipes = interactions.filter((i) => i.direction === 'left').length;
      const preferenceRatio = rightSwipes / (rightSwipes + leftSwipes || 1);

      return {
        preferred_topics: preferenceRatio > 0.6 ? ['general'] : [],
        disliked_topics: preferenceRatio < 0.4 ? ['general'] : [],
        neutral_topics: [],
        overall_scores: { general: Number(((preferenceRatio - 0.5) * 2).toFixed(2)) },
      };
    };

    if (this.fallbackEnabled || !this.lm) {
      return baselineAnalysis();
    }

    if (interactions.length === 0) {
      return baselineAnalysis();
    }

    try {
      // Group interactions by topic (we need to get facts first)
      // For now, we'll analyze based on swipe directions
      const rightSwipes = interactions.filter(i => i.direction === 'right').length;
      const leftSwipes = interactions.filter(i => i.direction === 'left').length;

      const prompt = `Based on the following user interactions, analyze their preferences:
- Right swipes (interested): ${rightSwipes}
- Left swipes (not interested): ${leftSwipes}
- Total interactions: ${interactions.length}

Analyze the pattern and provide a JSON response with:
{
  "preferred_topics": ["topic1", "topic2"],
  "disliked_topics": ["topic3"],
  "neutral_topics": ["topic4"],
  "overall_scores": {"topic1": 0.8, "topic2": 0.6, "topic3": -0.5}
}

Only respond with valid JSON.`;

      const messages: CompletionMessage[] = [
        {
          role: 'system',
          content:
            'You analyze interaction summaries and return JSON. ' +
            'Respond ONLY with the final JSON payload. Do NOT include <think> tags, reasoning, or commentary.',
        },
        { role: 'user', content: prompt },
      ];

      let response: string;
      try {
        response = await this.runCompletion(messages, {
          temperature: 0.6,
          maxTokens: 400,
          stopSequences: ['```'],
        });
      } catch (completionError) {
        console.error('Error analyzing preferences:', completionError);
        return {
          preferred_topics: [],
          disliked_topics: [],
          neutral_topics: [],
          overall_scores: {},
        };
      }

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          return analysis as PreferenceAnalysis;
        }
      } catch (parseError) {
        console.error('Error parsing preference analysis JSON:', parseError);
      }

      // Fallback: simple analysis based on ratios
      return baselineAnalysis();
    } catch (error) {
      console.error('Error analyzing user preference:', error);
      return baselineAnalysis();
    }
  }

  /**
   * Generate related facts for a topic when user swipes right
   */
  async generateRelatedFacts(topic: string, currentFact: string): Promise<string[]> {
    await this.ensureInitialized();

    if (this.fallbackEnabled || !this.lm) {
      return [];
    }

    try {
      const prompt = `Based on this fact about ${topic}:
"${currentFact}"

Generate 3 related, interesting facts about ${topic}. Each fact should be exactly 200 characters or less. Format each fact on a new line.

Related facts:`;

      const messages: CompletionMessage[] = [
        {
          role: 'system',
          content:
            'You generate related standalone facts. ' +
            'Respond ONLY with the final facts, each on its own line. ' +
            'Do NOT include <think> tags, internal reasoning, or commentary.',
        },
        { role: 'user', content: prompt },
      ];

      let response: string;
      try {
        response = await this.runCompletion(messages, {
          temperature: 0.7,
          maxTokens: 512,
        });
      } catch (completionError) {
        console.error('Error generating related facts:', completionError);
        return [];
      }
      
      // Parse facts from response
      const facts = response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line.length <= 200)
        .slice(0, 3); // Limit to 3 facts

      return facts;
    } catch (error) {
      console.error('Error generating related facts:', error);
      throw error;
    }
  }

  private parseQuizBatch(raw: string, expected: number): QuizQuestion[] {
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      return [];
    }

    const candidates = new Set<string>();
    const base = arrayMatch[0].trim();
    candidates.add(base);

    const sanitizedKeys = base.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
    const sanitizedValues = sanitizedKeys.replace(/'([^']*)'/g, (_, value: string) => {
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    const sanitizedTrailingCommas = sanitizedValues.replace(/,\s*([}\]])/g, '$1');
    candidates.add(sanitizedTrailingCommas);

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (!Array.isArray(parsed)) {
          continue;
        }
        const questions: QuizQuestion[] = parsed
          .filter((item: any) => typeof item === 'object' && item !== null)
          .map((item: any) => {
            const question = typeof item.question === 'string' ? item.question.trim() : '';
            const options = Array.isArray(item.options)
                ? item.options
                  .filter((option: unknown): option is string => typeof option === 'string' && option.trim().length > 0)
                  .map((option: string) => option.trim())
              : [];
            const numericAnswer = typeof item.correct_answer === 'number' ? item.correct_answer : 0;
            const normalizedAnswer = Number.isFinite(numericAnswer)
              ? Math.max(0, Math.min(options.length - 1, Math.floor(numericAnswer)))
              : 0;

            return {
              question,
              options,
              correct_answer: normalizedAnswer,
            };
          })
          .filter((item) => item.question.length > 0 && item.options.length === 4);

        if (questions.length > 0) {
          return questions.slice(0, expected > 0 ? expected : questions.length);
        }
      } catch {
        // Try next candidate
      }
    }

    return [];
  }

  async generateQuizQuestions(topic: string, factContents: string[]): Promise<QuizQuestion[]> {
    await this.ensureInitialized();

    if (this.fallbackEnabled || !this.lm || factContents.length === 0) {
      return [];
    }

    const limitedFacts = factContents.slice(0, 8);
    const promptFacts = limitedFacts
      .map((content, index) => `${index + 1}. ${content}`)
      .join('\n');

    const prompt = `You are creating quiz questions for the topic "${topic}". Use the numbered facts below to generate one multiple-choice question per fact. Each question must test understanding of the fact directly.

Facts:
${promptFacts}

Return a JSON array where each element is of the form:
{
  "question": "Question text?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": 0
}

Rules:
- Provide exactly ${limitedFacts.length} quiz objects in the same order as the facts above.
- Use double quotes around all keys and string values.
- Each options array must contain four concise answers (<80 characters).
- Set correct_answer to the zero-based index of the correct option.
- Reply with JSON only.`;

    const messages: CompletionMessage[] = [
      {
        role: 'system',
        content:
          'You generate multiple-choice quiz questions. ' +
          'Respond ONLY with the final JSON array described by the user. ' +
          'Do NOT include <think> tags, explanations, or commentary.',
      },
      { role: 'user', content: prompt },
    ];

    try {
      const response = await this.runCompletion(messages, {
        temperature: 0.35,
        maxTokens: 512,
        stopSequences: ['```'],
      });

      const parsed = this.parseQuizBatch(response, limitedFacts.length);
      if (parsed.length === 0) {
        console.warn('[AIService] Quiz generation returned no valid items.');
      }
      return parsed;
    } catch (error) {
      console.warn('[AIService] Quiz generation failed. Skipping quizzes.', error);
      return [];
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.lm) {
      try {
        if (typeof this.lm.destroy === 'function') {
          await this.lm.destroy();
        }
      } catch (error) {
        console.error('Error destroying model:', error);
      }
      this.lm = null;
      this.initialized = false;
    }
  }
}

export const aiService = new AIService();

