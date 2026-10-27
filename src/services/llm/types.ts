export type LLMProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "azure"
  | "aws-bedrock"
  | "sagemaker"
  | "groq"
  | "ollama";

export interface AnalyzeOptions {
  text: string;
  tone: string;
  contextUrl?: string;
  context?: string;
}

export interface RewriteOptions {
  text: string;
  desiredTone: string;
}

export interface StandardSuggestion {
  startOffset: number;
  endOffset: number;
  category: "Correctness" | "Clarity" | "Engagement" | "Delivery";
  originalText: string;
  replacements: string[];
  explanation: string;
}

export interface ILLMProvider {
  analyzeText(options: AnalyzeOptions): Promise<StandardSuggestion[]>;
  rewriteText(options: RewriteOptions): Promise<string[]>;
}
