
-- Randomize sort_order for wallpapers
WITH shuffled AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY random())) * 1000 AS new_order
  FROM wallpapers
)
UPDATE wallpapers SET sort_order = shuffled.new_order
FROM shuffled WHERE wallpapers.id = shuffled.id;

-- Randomize sort_order for live_wallpapers
WITH shuffled AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY random())) * 1000 AS new_order
  FROM live_wallpapers
)
UPDATE live_wallpapers SET sort_order = shuffled.new_order
FROM shuffled WHERE live_wallpapers.id = shuffled.id;
