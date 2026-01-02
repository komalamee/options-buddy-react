-- Run this SQL after Railway PostgreSQL is set up
-- This whitelists the two admin emails

INSERT INTO email_whitelist (email, added_at)
VALUES
  ('komalamee@gmail.com', NOW()),
  ('hjjamin@gmail.com', NOW())
ON CONFLICT (email) DO NOTHING;
