-- Production hardening: remove dangerous "Allow premium toggle for testing" RLS policies
-- and replace with admin-only update policies on wallpapers and live_wallpapers.

DROP POLICY IF EXISTS "Allow premium toggle for testing" ON public.wallpapers;
DROP POLICY IF EXISTS "Allow premium toggle for testing" ON public.live_wallpapers;

-- Allow only authenticated admins to update wallpaper records.
CREATE POLICY "Admins can update wallpapers"
ON public.wallpapers
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update live wallpapers"
ON public.live_wallpapers
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tighten the SECURITY DEFINER function so anon/public cannot execute it.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;