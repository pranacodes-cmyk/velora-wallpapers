create table if not exists public.pray_pauses (
  id uuid primary key default gen_random_uuid(),
  slot int not null,
  lang text not null,
  verse text not null,
  reference text not null,
  prayer text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (slot, lang)
);

grant select on public.pray_pauses to anon;
grant select on public.pray_pauses to authenticated;
grant all on public.pray_pauses to service_role;

alter table public.pray_pauses enable row level security;

create policy "Sacred pauses are public read"
on public.pray_pauses for select
to anon, authenticated
using (active);

create index if not exists pray_pauses_lang_slot_idx on public.pray_pauses (lang, slot);