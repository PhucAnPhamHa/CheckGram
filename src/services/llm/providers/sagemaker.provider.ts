import { InvokeEndpointCommand, SageMakerRuntimeClient } from "@aws-sdk/client-sagemaker-runtime";
import type { Config } from "../../../config.js";
import type { ILLMProvider, AnalyzeOptions, RewriteOptions, StandardSuggestion } from "../types.js";
import { normalizeSuggestions, normalizeVariations, parseJson, suggestionPrompt } from "../json.js";

export class AWSSageMakerProvider implements ILLMProvider {
  private readonly client: SageMakerRuntimeClient;
  constructor(private readonly config: Config) {
    this.client = new SageMakerRuntimeClient({ region: config.AWS_REGION });
  }
  private async complete(prompt: string) {
    if (!this.config.SAGEMAKER_ENDPOINT_NAME) throw new Error("SAGEMAKER_ENDPOINT_NAME is required");
    const response = await this.client.send(new InvokeEndpointCommand({
      EndpointName: this.config.SAGEMAKER_ENDPOINT_NAME,
      ContentType: "application/json",
      Body: new TextEncoder().encode(JSON.stringify({ inputs: prompt }))
    }));
    return new TextDecoder().decode(response.Body);
  }
  async analyzeText(options: AnalyzeOptions): Promise<StandardSuggestion[]> {
    return normalizeSuggestions(parseJson(await this.complete(suggestionPrompt(options))));
  }
  async rewriteText(options: RewriteOptions): Promise<string[]> {
    return normalizeVariations(parseJson(await this.complete(`Return only JSON {"variations":["...","...","..."]}. Rewrite in ${options.desiredTone} tone:\n${options.text}`)));
  }
}
