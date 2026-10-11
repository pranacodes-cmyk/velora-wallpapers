INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Reels are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'reels');