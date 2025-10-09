-- Create table in public schema
create table if not exists public.scheduled_posts (
  id bigserial primary key,
  content_id bigint not null,
  platform text not null,
  content_type text not null check (content_type in ('image','video','text','link')),
  source text,
  title text,
  scheduled_post_time timestamptz not null,
  scheduled_slot_index int not null check (scheduled_slot_index between 0 and 5),
  actual_posted_at timestamptz,
  reasoning text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional—if you have public.content_queue(id)
do $
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'content_queue'
  ) then
    alter table public.scheduled_posts
      add constraint scheduled_posts_content_fk
      foreign key (content_id) references public.content_queue(id) on delete cascade;
  end if;
end $;

-- Indexes for day + slot + content lookups
create index if not exists idx_scheduled_posts_day
  on public.scheduled_posts (date_trunc('day', scheduled_post_time));

create index if not exists idx_scheduled_posts_slot
  on public.scheduled_posts (scheduled_slot_index);

create index if not exists idx_scheduled_posts_content
  on public.scheduled_posts (content_id);

-- RLS (optional—service role bypasses RLS anyway)
alter table public.scheduled_posts enable row level security;

-- Allow authenticated reads if you ever need client-side; otherwise omit and use service role on server
create policy "scheduled_posts select for authenticated"
  on public.scheduled_posts
  for select
  to authenticated
  using (true);

-- Service-role writes/reads (service role bypasses RLS, but ok to include)
create policy "scheduled_posts all for service-role"
  on public.scheduled_posts
  for all
  to service_role
  using (true)
  with check (true);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $
begin
  new.updated_at = now();
  return new;
end $;

drop trigger if exists trg_scheduled_posts_updated_at on public.scheduled_posts;
create trigger trg_scheduled_posts_updated_at
before update on public.scheduled_posts
for each row execute procedure public.set_updated_at();

-- Nudge PostgREST to refresh schema (safe if hosted)
select pg_notify('pgrst', 'reload schema');