/// The four prayer backgrounds, as absolute public URLs — exactly what
/// `src/pages/Devotional.tsx` resolves via `toAbsoluteAssetUrl(...)`.
const kDevotionalBackgrounds = <String>[
  'https://pub-d9ad13d080884ba18697f09f5aa3b7e9.r2.dev/a/v1/7a117aeb-de37-4151-8fc7-c1936b225d28/ca88f419-b530-4d8d-9bbc-537eeb11c3f4/devotional-bg-1.jpg',
  'https://pub-d9ad13d080884ba18697f09f5aa3b7e9.r2.dev/a/v1/7a117aeb-de37-4151-8fc7-c1936b225d28/b748fe87-594e-410d-9fc1-97f614e93b2b/devotional-bg-2.jpg',
  'https://pub-d9ad13d080884ba18697f09f5aa3b7e9.r2.dev/a/v1/7a117aeb-de37-4151-8fc7-c1936b225d28/7dc9a612-ce27-4ce3-874a-b23450e5ca80/devotional-bg-3.jpg',
  'https://pub-d9ad13d080884ba18697f09f5aa3b7e9.r2.dev/a/v1/7a117aeb-de37-4151-8fc7-c1936b225d28/411e408e-b09a-4de9-bf85-ca4fc7355b28/devotional-bg-4.jpg',
];

/// Ambient prayer music (same R2 object the web app streams).
const kPrayerMusicUrl =
    'https://pub-d9ad13d080884ba18697f09f5aa3b7e9.r2.dev/audio/prayer_background_music.mp3';
