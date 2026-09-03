-- Foreign-key, relationship, status, review, job, and usage indexes.
CREATE INDEX IF NOT EXISTS idx_images_processing_status
    ON images (processing_status);

CREATE INDEX IF NOT EXISTS idx_image_metadata_review_status
    ON image_metadata (review_status);

CREATE INDEX IF NOT EXISTS idx_image_embeddings_image_id
    ON image_embeddings (image_id);

CREATE INDEX IF NOT EXISTS idx_posts_expected_subject_category
    ON posts (expected_subject, expected_category);

CREATE INDEX IF NOT EXISTS idx_post_embeddings_post_id
    ON post_embeddings (post_id);

CREATE INDEX IF NOT EXISTS idx_suggestions_post_id
    ON suggestions (post_id);

CREATE INDEX IF NOT EXISTS idx_suggestions_image_id
    ON suggestions (image_id);

CREATE INDEX IF NOT EXISTS idx_suggestions_score
    ON suggestions (similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_suggestions_guard_status
    ON suggestions (guard_status);

CREATE INDEX IF NOT EXISTS idx_reviews_suggestion_id
    ON reviews (suggestion_id);

CREATE INDEX IF NOT EXISTS idx_reviews_decision
    ON reviews (decision);

CREATE INDEX IF NOT EXISTS idx_ai_usage_entity
    ON ai_usage (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_status
    ON ai_usage (status);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at
    ON ai_usage (created_at);

CREATE INDEX IF NOT EXISTS idx_jobs_status
    ON jobs (status);

CREATE INDEX IF NOT EXISTS idx_jobs_type_status
    ON jobs (type, status);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at
    ON jobs (created_at);
