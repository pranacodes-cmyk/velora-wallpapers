-- Delete all superhero STATIC wallpapers except Doom City Destruction and Doom Sorcery Power
DELETE FROM wallpapers WHERE id IN (
  -- Batman
  'ce5bb7d8-2a54-4dfe-b6b0-5188675bbc7a', 'c2f332ca-b0f9-4eca-9d13-be1f58d2158e',
  '8e3a2639-8354-4de7-afbf-7d6008dac50f', 'f586c5d1-4988-4463-9313-aed68f8a4732',
  '9cd79a99-305a-4b85-ac27-fb5d1331a9c5', '3342095f-d5ad-4ac9-83b9-c9bee34abd52',
  'e50e75e2-adf7-4c59-9b9e-ebd150839764',
  -- Deadpool
  '493e2deb-05ff-4d52-9eed-7774a5d0accc', '673f5459-2114-41c0-91fb-c5d6c38165aa',
  '4808bf2a-5754-4ff2-8e77-17e7940bb0c1', '18e7d4fe-15fb-4947-8d9e-d4257a4f4035',
  '8895f458-35c6-43b4-ae62-bbb0dd2b6a88',
  -- Doom (throne/mask only - keeping destruction & magic)
  'ca1b4d3b-cffa-4bf3-8e7a-a0df0b9ca9bf', '03fcf892-d460-4388-a3b2-8a33c9b96972',
  'd4081604-8c0a-4249-8626-b5a1cef03cb6', '39c00485-d018-4cf1-8a2c-b65b2c1032a3',
  'a6dc6e09-6ebc-4547-84c1-1b75d5931a9d', 'f8b1ebe5-c6ee-4422-8c09-93408922d8dd',
  -- Flash
  '5cd7be17-0298-4761-b742-9aeeb50d77a0', '5bd31ba7-b843-483d-8301-f61f8287c39c',
  'b39744c8-ebc0-47f0-8b3e-a116bac1f5cb', '9533e13d-c443-4fc4-841e-a93334543c60',
  '4bfbf6ff-e415-4cb3-a77e-7cfda1455a90',
  -- Iron Man
  '9beb136c-4af7-4c22-b540-1437cf8c4e5d', '87dd4ba2-d764-49b3-b118-eca64a554260',
  'c962280a-404d-474b-a3fa-4938066757cf', 'a9da4695-943c-4b89-a260-7d548a899aed',
  -- Spider-Man
  '9a3b249a-6e4d-4dc4-a754-ad792c9ceb35', 'ede252ce-5131-4259-9045-254c6deb2c05',
  '1bb05cdd-013c-4373-8266-bb4a65bf8171', 'e44a71a1-ff7b-4f1e-ba4f-0a5ba083a98d',
  '8b5222fa-ab7b-457a-a08d-a13355abf2b4', '648545f8-bfb8-4ef1-bfd9-69994f71813e',
  'cd2a066b-88e0-4448-b8fa-82b7fd212510',
  -- Venom
  '3bc9468f-8b29-4de6-a634-f8873c5f4d19', '91a32fc5-d07e-4ae5-b0f2-58cc3988caa4',
  'bf2f2819-f2e7-481a-8f26-cac15c196175', '3b531a1d-e343-49dd-b1a0-4749c9f2afab',
  '9a2733d9-9761-419e-a725-bde1ca9255e1', 'd2fe573a-fd1c-4f01-800e-7ed320a3b271',
  'c7c92136-bbf6-48a4-9dc8-de3c7aab5d14',
  -- Wolverine
  '35703a4d-74cf-42a6-8c62-59fe02674286', '8477c8fc-db6e-4f2a-a3ff-d3793266b8cc',
  '44ff7ad9-bbd6-4389-9585-4a75d49c16a1', 'ac6d2d5c-5c1b-426d-b11a-0c8c3ad12cd4',
  'd495a00c-83cc-4cd7-aba3-4f2d17502f3f', '5ed45169-6a3e-4a51-8e52-12b5dde9711d'
);

-- Delete Batman Vigil live wallpaper (keeping Doom City Destruction & Doom Sorcery Power)
DELETE FROM live_wallpapers WHERE id = 'a772e107-f1d2-4a40-862d-385890ed6ba7';