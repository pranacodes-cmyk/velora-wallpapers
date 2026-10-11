
-- Step 1: Delete ALL live wallpapers in the 'superheroes' category EXCEPT Doom Sorcery Power
DELETE FROM live_wallpapers 
WHERE category = 'superheroes' 
AND id != '712fe4c1-9f87-445b-98f9-c8d110a08be5';

-- Step 2: Delete remaining superhero-themed live wallpapers by title pattern (in other categories)
DELETE FROM live_wallpapers 
WHERE id NOT IN ('bfbfadc0-3d79-4710-9968-6211d685de9a', '712fe4c1-9f87-445b-98f9-c8d110a08be5')
AND (
  LOWER(title) SIMILAR TO '%(iron|spider man|batman|superman|captain|hulk|thor|venom|flash|deadpool|wolverine|black panther|scarlet witch|thanos|joker|aquaman|wonder woman|green lantern|magneto|moon knight|ghost rid|web swing|cap rain|speed force|mystic portal|strange|marvel|avenger|loki|hawk|phoenix ascend|sorcerer portal|thunder strike|green smash)%'
);

-- Step 3: Delete ALL static wallpapers in the Superheroes category EXCEPT Doom ones
DELETE FROM wallpapers 
WHERE category_id = '06914059-7e53-4daf-af24-5fde96ae63d0'
AND id NOT IN ('100b4730-466f-4693-86c1-511d84de7c75', 'b5f8c334-e0ab-4ac5-bf5c-321d1cdfc7b6', 'cb3537e6-fc56-4720-a4f7-b037530d7fdd');

-- Step 4: Delete remaining superhero-themed static wallpapers in other categories  
DELETE FROM wallpapers
WHERE id NOT IN ('100b4730-466f-4693-86c1-511d84de7c75', 'b5f8c334-e0ab-4ac5-bf5c-321d1cdfc7b6', 'cb3537e6-fc56-4720-a4f7-b037530d7fdd')
AND (
  LOWER(title) SIMILAR TO '%(iron man|spider man|batman|superman|captain america|hulk|thor|venom|flash|deadpool|wolverine|black panther|scarlet witch|scarlet chaos|thanos|joker|aquaman|wonder woman|green lantern|magneto|moon knight|ghost rider|web swing|cap rain|speed force|mystic portal|strange|marvel|avenger|loki|hawkman|scarlet speed)%'
);

-- Step 5: Move the 3 Doom static wallpapers to a more appropriate category (fantasy/dark)
-- First check if there's a 'dark' or 'fantasy' category, otherwise keep them
UPDATE wallpapers SET category_id = (SELECT id FROM categories WHERE slug = 'fantasy' LIMIT 1)
WHERE id IN ('100b4730-466f-4693-86c1-511d84de7c75', 'b5f8c334-e0ab-4ac5-bf5c-321d1cdfc7b6', 'cb3537e6-fc56-4720-a4f7-b037530d7fdd')
AND EXISTS (SELECT 1 FROM categories WHERE slug = 'fantasy');

-- Step 6: Move Doom Sorcery Power live wallpaper out of superheroes to fantasy
UPDATE live_wallpapers SET category = 'fantasy'
WHERE id = '712fe4c1-9f87-445b-98f9-c8d110a08be5';

-- Step 7: Delete the Superheroes category
DELETE FROM categories WHERE id = '06914059-7e53-4daf-af24-5fde96ae63d0';

-- Step 8: Also clean up "Witch Enchanted Spell" from fantasy if it's superhero-related (Scarlet Witch)
DELETE FROM live_wallpapers WHERE id = '174b1e48-fd43-4bbb-bba5-0416a8555c70' AND LOWER(title) = 'witch enchanted spell';

-- Step 9: Remove "Scarlet Chaos Magic" static wallpaper
DELETE FROM wallpapers WHERE id = 'c549d426-1312-4085-adce-62da439ad2d3';

-- Step 10: Remove "Speed Force Run" and "Web Swing Night" from static (viral/other categories)
DELETE FROM wallpapers WHERE id IN ('cfda7238-f112-4aab-af0c-712341f98f33', '9d00c7ef-7367-472a-836b-322f327e9e51', '60cd886c-5b05-4fb2-91f4-4161932be398');
