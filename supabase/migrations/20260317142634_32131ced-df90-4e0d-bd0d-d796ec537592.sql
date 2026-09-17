
UPDATE public.wallpapers
SET image_url = REPLACE(
  image_url,
  'https://pub-de6e465d65ed4e5bbc4515e0da940246.r2.dev/',
  'https://xalybgwfkpczxvhmwaxr.supabase.co/functions/v1/image-proxy/'
)
WHERE image_url LIKE '%pub-de6e465d%';
