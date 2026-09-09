import type { ProviderUsage } from "../domain/ai-usage.js";

export interface UsagePricing {
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export const AI_USAGE_PRICING: Readonly<Record<string, UsagePricing>> =
  Object.freeze({
    "gpt-4.1-mini": {
      inputCostPerMillion: 0.4,
      outputCostPerMillion: 1.6,
    },
    "text-embedding-3-small": {
      inputCostPerMillion: 0.02,
      outputCostPerMillion: 0,
    },
    "gemini-embedding-2": {
          inputCostPerMillion: 0,
          outputCostPerMillion: 0,
        },
  });

export function calculateEstimatedCost(
  usage: ProviderUsage,
  pricing: UsagePricing | undefined = AI_USAGE_PRICING[usage.model],
): number | null {
  if (!pricing) {
    return null;
  }

  return (
    (usage.inputUnits / 1_000_000) * pricing.inputCostPerMillion +
    (usage.outputUnits / 1_000_000) * pricing.outputCostPerMillion
  );
}
