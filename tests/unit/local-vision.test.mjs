import assert from "node:assert/strict";
import test from "node:test";

import { LocalVisionProvider } from "../../dist/providers/local-vision.js";

test("loads and validates local image metadata by image id", async () => {
  const provider = new LocalVisionProvider();

  const result = await provider.understandImage({
    imageId: "animal-tiger",
    imageUrl: "https://example.test/animal-tiger.jpg",
  });

  assert.deepEqual(result.output, {
  "subject": "tiger",
  "category": "animals",
  "attributes": [
  "orange and black striped coat",
  "white underbelly",
  "standing posture",
  "front paws resting on a log",
  "green foliage background"
  ],
  "caption": "A large tiger stands with its front paws elevated on a fallen log in a lush environment.",
  "confidence": 0.99
  });

  assert.equal(result.usage, null);
});

test("rejects missing local metadata", async () => {
  const provider = new LocalVisionProvider();

  await assert.rejects(
    () =>
      provider.understandImage({
        imageId: "does-not-exist",
        imageUrl: "https://example.test/does-not-exist.jpg",
      }),
    /Local vision metadata was not found/,
  );
});