export const DEFAULT_AI_USAGE_BUDGET_USD = 1;

export class AiBudgetExceededError extends Error {
  public constructor(
    public readonly currentEstimatedCost: number,
    public readonly budgetUsd: number,
  ) {
    super(
      `AI usage budget exceeded: current estimated cost is $${currentEstimatedCost.toFixed(
        6,
      )}, budget is $${budgetUsd.toFixed(2)}.`,
    );
    this.name = "AiBudgetExceededError";
  }
}

export function assertWithinAiBudget(
  currentEstimatedCost: number,
  budgetUsd: number,
): void {
  if (!Number.isFinite(currentEstimatedCost) || currentEstimatedCost < 0) {
    throw new Error("Current estimated AI cost must be a non-negative finite number.");
  }

  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
    throw new Error("AI usage budget must be a positive finite number.");
  }

  if (currentEstimatedCost >= budgetUsd) {
    throw new AiBudgetExceededError(currentEstimatedCost, budgetUsd);
  }
}