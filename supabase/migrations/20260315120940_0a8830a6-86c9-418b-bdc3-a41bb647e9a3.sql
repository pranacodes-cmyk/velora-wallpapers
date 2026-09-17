
-- Fix miscategorized live wallpapers: move "heroes" category items to "samurai" 
UPDATE live_wallpapers SET category = 'samurai' 
WHERE category = 'heroes';

-- Clean up empty categories that have no wallpapers
DELETE FROM categories WHERE slug IN ('live-wallpaper', 'optical-illusion', 'relationship', 'wildlife')
AND NOT EXISTS (SELECT 1 FROM wallpapers WHERE category_id = categories.id);
