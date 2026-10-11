--
-- PostgreSQL database dump
--

\restrict Ha5kKD7lqVhUEcAggu9Nn1DcGKwCZUgiBnrk1w7yw39rSOV2BrHAo1p7r51X3cn

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


ALTER TYPE public.app_role OWNER TO postgres;

--
-- Name: pending_asset_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.pending_asset_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE public.pending_asset_status OWNER TO postgres;

--
-- Name: pending_asset_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.pending_asset_type AS ENUM (
    'static',
    'live'
);


ALTER TYPE public.pending_asset_type OWNER TO postgres;

--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    thumbnail_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: live_wallpapers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.live_wallpapers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subtitle text,
    video_url text NOT NULL,
    category text DEFAULT 'nature'::text NOT NULL,
    is_premium boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    thumbnail_url text
);


ALTER TABLE public.live_wallpapers OWNER TO postgres;

--
-- Name: pending_assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pending_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_type public.pending_asset_type NOT NULL,
    category_slug text NOT NULL,
    title text NOT NULL,
    image_url text NOT NULL,
    video_url text,
    prompt text,
    model text,
    status public.pending_asset_status DEFAULT 'pending'::public.pending_asset_status NOT NULL,
    is_premium boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone
);


ALTER TABLE public.pending_assets OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: wallpapers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallpapers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    category_id uuid,
    image_url text NOT NULL,
    is_premium boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    upscale_status text DEFAULT 'pending'::text NOT NULL,
    upscale_attempted_at timestamp with time zone
);


ALTER TABLE public.wallpapers OWNER TO postgres;

--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: live_wallpapers live_wallpapers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_wallpapers
    ADD CONSTRAINT live_wallpapers_pkey PRIMARY KEY (id);


--
-- Name: pending_assets pending_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_assets
    ADD CONSTRAINT pending_assets_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: wallpapers wallpapers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallpapers
    ADD CONSTRAINT wallpapers_pkey PRIMARY KEY (id);


--
-- Name: idx_pending_assets_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pending_assets_category ON public.pending_assets USING btree (category_slug);


--
-- Name: idx_pending_assets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pending_assets_status ON public.pending_assets USING btree (status);


--
-- Name: idx_pending_assets_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pending_assets_type ON public.pending_assets USING btree (asset_type);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: idx_wallpapers_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wallpapers_category ON public.wallpapers USING btree (category_id);


--
-- Name: idx_wallpapers_premium; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wallpapers_premium ON public.wallpapers USING btree (is_premium);


--
-- Name: wallpapers_upscale_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX wallpapers_upscale_status_idx ON public.wallpapers USING btree (upscale_status);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wallpapers wallpapers_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallpapers
    ADD CONSTRAINT wallpapers_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: categories Admins can manage categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage categories" ON public.categories TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: live_wallpapers Admins can manage live wallpapers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage live wallpapers" ON public.live_wallpapers TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pending_assets Admins can manage pending assets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage pending assets" ON public.pending_assets TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: wallpapers Admins can manage wallpapers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage wallpapers" ON public.wallpapers TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: live_wallpapers Admins can update live wallpapers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update live wallpapers" ON public.live_wallpapers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: wallpapers Admins can update wallpapers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update wallpapers" ON public.wallpapers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: categories Anyone can view categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);


--
-- Name: live_wallpapers Anyone can view live wallpapers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view live wallpapers" ON public.live_wallpapers FOR SELECT USING (true);


--
-- Name: wallpapers Anyone can view wallpapers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view wallpapers" ON public.wallpapers FOR SELECT USING (true);


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: live_wallpapers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.live_wallpapers ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_assets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pending_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: wallpapers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wallpapers ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO sandbox_exec;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO sandbox_exec;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.categories TO anon;
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;
GRANT SELECT,INSERT ON TABLE public.categories TO sandbox_exec;


--
-- Name: TABLE live_wallpapers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.live_wallpapers TO anon;
GRANT ALL ON TABLE public.live_wallpapers TO authenticated;
GRANT ALL ON TABLE public.live_wallpapers TO service_role;
GRANT SELECT,INSERT ON TABLE public.live_wallpapers TO sandbox_exec;


--
-- Name: TABLE pending_assets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pending_assets TO anon;
GRANT ALL ON TABLE public.pending_assets TO authenticated;
GRANT ALL ON TABLE public.pending_assets TO service_role;
GRANT SELECT,INSERT ON TABLE public.pending_assets TO sandbox_exec;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec;


--
-- Name: TABLE wallpapers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wallpapers TO anon;
GRANT ALL ON TABLE public.wallpapers TO authenticated;
GRANT ALL ON TABLE public.wallpapers TO service_role;
GRANT SELECT,INSERT ON TABLE public.wallpapers TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict Ha5kKD7lqVhUEcAggu9Nn1DcGKwCZUgiBnrk1w7yw39rSOV2BrHAo1p7r51X3cn

