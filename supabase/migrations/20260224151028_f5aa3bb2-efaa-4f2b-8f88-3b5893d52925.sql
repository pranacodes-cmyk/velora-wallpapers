
-- Remove duplicate live_wallpapers: keep the row with the lowest sort_order per filename
DELETE FROM live_wallpapers
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY SUBSTRING(video_url FROM '[^/]+$')
             ORDER BY sort_order ASC
           ) AS rn
    FROM live_wallpapers
  ) ranked
  WHERE rn > 1
);

-- Remove duplicate wallpapers: keep the row with the lowest sort_order per filename
DELETE FROM wallpapers
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY SUBSTRING(image_url FROM '[^/]+$')
             ORDER BY sort_order ASC
           ) AS rn
    FROM wallpapers
  ) ranked
  WHERE rn > 1
);
