import assert from "node:assert/strict";
import test from "node:test";

import {
  AiBudgetExceededError,
  assertWithinAiBudget,
} from "../../dist/domain/ai-budget.js";

test("allows usage below the budget", () => {
  assert.doesNotThrow(() => {
    assertWithinAiBudget(0.5, 1);
  });
});

test("rejects usage exactly at the budget", () => {
  assert.throws(
    () => {
      assertWithinAiBudget(1, 1);
    },
    (error) => error instanceof AiBudgetExceededError,
  );
});

test("rejects usage above the budget", () => {
  assert.throws(
    () => {
      assertWithinAiBudget(1.25, 1);
    },
    (error) => error instanceof AiBudgetExceededError,
  );
});

test("rejects a negative current cost", () => {
  assert.throws(() => {
    assertWithinAiBudget(-0.01, 1);
  });
});

test("rejects an invalid budget", () => {
  assert.throws(() => {
    assertWithinAiBudget(0.5, 0);
  });
});