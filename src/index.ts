console.log("FlyRank capstone backend");import express from "express";

import { createImageIngestionRouter } from "./api/image-ingestion.js";
import { createPostImageRetrievalRouter } from "./api/post-image-retrieval.js";
import { createSuggestionReviewRouter } from "./api/suggestion-review.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use(createImageIngestionRouter());
  app.use(createPostImageRetrievalRouter());
  app.use(createSuggestionReviewRouter());

  return app;
}

const app = createApp();

app.listen(3000, () => {
  console.log("HTTP server listening on port 3000.");
});