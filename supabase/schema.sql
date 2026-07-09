create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  attending boolean not null default true,
  allergies text,
  plus_one_name text,
  plus_one_allergies text,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.wall_posts (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  message text,
  image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null check (score >= 0),
  total integer not null check (total > 0),
  created_at timestamptz not null default now()
);

alter table public.rsvps enable row level security;
alter table public.wall_posts enable row level security;
alter table public.quiz_scores enable row level security;

drop policy if exists "Anyone can insert rsvps" on public.rsvps;
create policy "Anyone can insert rsvps"
on public.rsvps for insert
to anon
with check (true);

drop policy if exists "Anyone can read wall posts" on public.wall_posts;
create policy "Anyone can read wall posts"
on public.wall_posts for select
to anon
using (true);

drop policy if exists "Anyone can insert wall posts" on public.wall_posts;
create policy "Anyone can insert wall posts"
on public.wall_posts for insert
to anon
with check (true);

drop policy if exists "Anyone can read quiz scores" on public.quiz_scores;
create policy "Anyone can read quiz scores"
on public.quiz_scores for select
to anon
using (true);

drop policy if exists "Anyone can insert quiz scores" on public.quiz_scores;
create policy "Anyone can insert quiz scores"
on public.quiz_scores for insert
to anon
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wall-images',
  'wall-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can upload wall images" on storage.objects;
create policy "Anyone can upload wall images"
on storage.objects for insert
to anon
with check (bucket_id = 'wall-images');

drop policy if exists "Anyone can read wall images" on storage.objects;
create policy "Anyone can read wall images"
on storage.objects for select
to anon
using (bucket_id = 'wall-images');
