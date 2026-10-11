
insert into storage.buckets (id, name, public)
values ('narrations', 'narrations', true)
on conflict (id) do nothing;

create policy "Narrations are publicly readable"
on storage.objects for select
using (bucket_id = 'narrations');

create policy "Service role manages narrations"
on storage.objects for all
to service_role
using (bucket_id = 'narrations')
with check (bucket_id = 'narrations');
