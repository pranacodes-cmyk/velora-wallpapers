-- Remove ALL remaining superhero static wallpapers
-- Keeping ONLY: Dr Doom Destruction (id: b5f8c334), Dr Doom Magic (id: cb3537e6), Doom Sorcery Power (static, id: if exists)
-- NOT touching non-superhero entries like "Ronin Spider Lily Moon", "Spider Lily Field", "Samurai Spider Lily"

DELETE FROM wallpapers WHERE title IN (
  -- Black Panther
  'Black Panther Claws', 'Black Panther Golden Eyes', 'Black Panther Kinetic',
  'Black Panther Mask', 'Black Panther Wakanda', 'Animal Black Panther 01',
  -- Cap
  'Cap Shield Throw', 'Hero Cap Shield 01',
  -- Dark Spider / Spider Verse (superhero)
  'Dark Spider', 'Spider Verse',
  -- Doom (keep only Dr Doom Destruction, Dr Doom Magic, Doom Sorcery Power)
  'Doom Ascension', 'Doom Beyonder Power', 'Doom Conquest', 'Doom Cosmic Power',
  'Doom God Emperor', 'Doom Infinity Conquest', 'Doom Infinity Victor',
  'Doom Latveria Throne', 'Doom Master Cosmic Wrath', 'Doom Master Infinity Sovereign',
  'Doom Master Iron Gaze', 'Doom Master Throne Victory', 'Doom Obsidian Throne',
  'Doom Storm Rampart', 'Doom Vibranium Throne', 'Doom Vs Strange', 'Doom War Commander',
  -- Hero prefixed
  'Hero Ironman Rain 01', 'Hero Lightning Flight', 'Hero Loki Bifrost 01',
  'Hero Panther Vibranium 01', 'Hero Superman Sky 01', 'Hero Thor Lightning 01',
  -- Iron Man / Ironman
  'Iron Flight', 'Iron Repulsor Blast', 'Ironman City Flight', 'Ironman Damaged Helm',
  'Ironman Glow', 'Ironman Hulkbuster', 'Ironman Last Stand', 'Ironman Snap',
  'Ironman Space Guardian', 'Ironman Space Hover', 'Ironman Suit Up',
  'Ironman Unibeam Space', 'Ironman Workshop',
  -- Panther
  'Panther Biolume Live', 'Panther Dark Forest', 'Panther Glow', 'Panther Glow Jungle',
  'Panther Jungle', 'Panther Vibranium Throne',
  -- Phoenix / Superhero generic
  'Phoenix Hero', 'Superhero Cosmic Power', 'Superhero Iron Helmet',
  'Superhero Rooftop', 'Superhero Team', 'Superhero Vigilante',
  -- Superman
  'Superman Storm Flight',
  -- Thor
  'Thor Allfather', 'Thor Asgard Throne', 'Thor Berserker Rage', 'Thor Bifrost Bridge',
  'Thor God Storm', 'Thor Ironman Backtoback', 'Thor Lightning Summit',
  'Thor Mountain Storm', 'Thor Stormbreaker Space', 'Thor Thunderstrike',
  'Thor Vs Ironman', 'Thor Worthy'
);