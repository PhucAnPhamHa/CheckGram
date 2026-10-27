import type { Config } from "../../config.js";
import type { ILLMProvider, LLMProviderType } from "./types.js";
import { AnthropicProvider } from "./providers/anthropic.provider.js";
import { AWSBedrockProvider } from "./providers/bedrock.provider.js";
import { AzureOpenAIProvider } from "./providers/azure.provider.js";
import { GoogleGeminiProvider } from "./providers/google.provider.js";
import { OpenAIProvider } from "./providers/openai.provider.js";
import { AWSSageMakerProvider } from "./providers/sagemaker.provider.js";

export class LLMFactory {
  static getProvider(type: LLMProviderType = "openai", config: Config): ILLMProvider {
    switch (type) {
      case "google": return new GoogleGeminiProvider(config);
      case "azure": return new AzureOpenAIProvider(config);
      case "aws-bedrock": return new AWSBedrockProvider(config);
      case "sagemaker": return new AWSSageMakerProvider(config);
      case "anthropic": return new AnthropicProvider(config);
      case "openai": return new OpenAIProvider(config);
      case "groq":
      case "ollama":
        throw new Error(`Provider ${type} is not configured in this deployment`);
      default: return new OpenAIProvider(config);
    }
  }
}
