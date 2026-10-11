
-- Reset all to free first
UPDATE wallpapers SET is_premium = false;

-- Randomly set ~50% to premium
UPDATE wallpapers SET is_premium = true
WHERE id IN (
  SELECT id FROM wallpapers ORDER BY random() LIMIT (SELECT count(*) / 2 FROM wallpapers)
);
