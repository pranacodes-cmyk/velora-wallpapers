DELETE FROM wallpapers WHERE category_id IN (
  SELECT id FROM categories WHERE slug IN ('daily-verse', 'christmas', 'minimal-christian', 'faith-hope')
);

DELETE FROM live_wallpapers WHERE category IN ('daily-verse', 'christmas', 'minimal-christian', 'faith-hope');

DELETE FROM categories WHERE slug IN ('daily-verse', 'christmas', 'minimal-christian', 'faith-hope');