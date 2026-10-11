
-- Drop broad SELECT (list) policies on storage.objects for public buckets.
-- Files in public buckets remain accessible via their public CDN URLs;
-- this only blocks listing the bucket contents through the API.
DROP POLICY IF EXISTS "Public wallpaper access" ON storage.objects;
DROP POLICY IF EXISTS "Reels are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Narrations are publicly readable" ON storage.objects;

-- Revoke direct EXECUTE on the SECURITY DEFINER role-check helper.
-- It is still callable from RLS policies (which run as the policy owner),
-- but signed-in clients can no longer invoke it via RPC.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
