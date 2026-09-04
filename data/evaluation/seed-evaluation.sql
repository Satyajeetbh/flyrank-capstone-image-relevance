-- Stage 13 evaluation entity fixture.
-- This file intentionally seeds no embeddings. Generate those with
-- scripts/generate-evaluation-corpus.mjs using the existing OpenAI provider.
-- Safe to re-run: fixed UUIDs and existing primary keys are used.

INSERT INTO images (id, source_url, storage_reference, processing_status)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'https://example.test/evaluation/red-fox.jpg', 'evaluation/red-fox.jpg', 'completed'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'https://example.test/evaluation/gray-wolf.jpg', 'evaluation/gray-wolf.jpg', 'completed'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'https://example.test/evaluation/brown-bear.jpg', 'evaluation/brown-bear.jpg', 'completed'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'https://example.test/evaluation/eagle.jpg', 'evaluation/eagle.jpg', 'completed'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'https://example.test/evaluation/golden-retriever.jpg', 'evaluation/golden-retriever.jpg', 'completed'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'https://example.test/evaluation/tabby-cat.jpg', 'evaluation/tabby-cat.jpg', 'completed'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7', 'https://example.test/evaluation/horse.jpg', 'evaluation/horse.jpg', 'completed'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8', 'https://example.test/evaluation/deer.jpg', 'evaluation/deer.jpg', 'completed'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9', 'https://example.test/evaluation/rabbit.jpg', 'evaluation/rabbit.jpg', 'completed'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'https://example.test/evaluation/tiger.jpg', 'evaluation/tiger.jpg', 'completed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO image_metadata (image_id, subject, category, attributes, caption, vision_confidence, review_status)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'red fox', 'animal', '["red fur", "outdoors"]'::jsonb, 'A red fox outdoors.', 0.96, 'approved'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'gray wolf', 'animal', '["gray fur", "outdoors"]'::jsonb, 'A gray wolf outdoors.', 0.96, 'approved'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'brown bear', 'animal', '["brown fur", "outdoors"]'::jsonb, 'A brown bear outdoors.', 0.96, 'approved'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'eagle', 'bird', '["wings", "sky"]'::jsonb, 'An eagle in the sky.', 0.96, 'approved'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'golden retriever', 'animal', '["golden fur", "pet"]'::jsonb, 'A golden retriever.', 0.96, 'approved'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'tabby cat', 'animal', '["striped fur", "pet"]'::jsonb, 'A tabby cat.', 0.96, 'approved'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7', 'horse', 'animal', '["mane", "outdoors"]'::jsonb, 'A horse outdoors.', 0.96, 'approved'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8', 'deer', 'animal', '["antlers", "outdoors"]'::jsonb, 'A deer outdoors.', 0.96, 'approved'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9', 'rabbit', 'animal', '["ears", "outdoors"]'::jsonb, 'A rabbit outdoors.', 0.96, 'approved'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'tiger', 'animal', '["stripes", "wild"]'::jsonb, 'A tiger outdoors.', 0.96, 'approved')
ON CONFLICT (image_id) DO NOTHING;

INSERT INTO posts (id, title, content, expected_subject, expected_category)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'Red fox wildlife', 'A post about a red fox in the wild.', 'red fox', 'animal'),
  ('22222222-2222-4222-8222-222222222222', 'Gray wolf wildlife', 'A post about a gray wolf in the wild.', 'gray wolf', 'animal'),
  ('33333333-3333-4333-8333-333333333333', 'Brown bear wildlife', 'A post about a brown bear in the wild.', 'brown bear', 'animal'),
  ('44444444-4444-4444-8444-444444444444', 'Eagle in flight', 'A post about an eagle in flight.', 'eagle', 'bird'),
  ('55555555-5555-4555-8555-555555555555', 'Golden retriever', 'A post about a golden retriever.', 'golden retriever', 'animal'),
  ('66666666-6666-4666-8666-666666666666', 'Tabby cat', 'A post about a tabby cat.', 'tabby cat', 'animal'),
  ('77777777-7777-4777-8777-777777777777', 'Horse outdoors', 'A post about a horse outdoors.', 'horse', 'animal'),
  ('88888888-8888-4888-8888-888888888888', 'Deer wildlife', 'A post about a deer in the wild.', 'deer', 'animal'),
  ('99999999-9999-4999-8999-999999999999', 'Rabbit outdoors', 'A post about a rabbit outdoors.', 'rabbit', 'animal'),
  ('abababab-abab-4aba-8aba-abababababab', 'Tiger wildlife', 'A post about a tiger in the wild.', 'tiger', 'animal')
ON CONFLICT (id) DO NOTHING;
