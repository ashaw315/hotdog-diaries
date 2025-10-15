-- Phase 5.12.3: Unblock Prod Forecast Now
-- Run this in Supabase Studio → SQL Editor (Production Project)

-- public.scheduled_posts (idempotent)
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

-- Conditional FK to content_queue(id)
do $
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='content_queue'
  ) then
    if exists (
      select 1 from information_schema.table_constraints
      where table_schema='public' and table_name='scheduled_posts'
        and constraint_name='scheduled_posts_content_fk'
    ) then
      alter table public.scheduled_posts drop constraint scheduled_posts_content_fk;
    end if;

    alter table public.scheduled_posts
    add constraint scheduled_posts_content_fk
    foreign key (content_id) references public.content_queue(id) on delete cascade;
  end if;
end $;

-- Indexes
create index if not exists idx_scheduled_posts_day
  on public.scheduled_posts (date_trunc('day', scheduled_post_time));
create index if not exists idx_scheduled_posts_slot
  on public.scheduled_posts (scheduled_slot_index);
create index if not exists idx_scheduled_posts_content
  on public.scheduled_posts (content_id);

-- RLS + policies
alter table public.scheduled_posts enable row level security;

do $
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='scheduled_posts'
      and policyname='scheduled_posts select for authenticated'
  ) then
    create policy "scheduled_posts select for authenticated"
      on public.scheduled_posts for select to authenticated using (true);
  end if;
end $;

do $
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='scheduled_posts'
      and policyname='scheduled_posts all for service-role'
  ) then
    create policy "scheduled_posts all for service-role"
      on public.scheduled_posts for all to service_role using (true) with check (true);
  end if;
end $;

-- updated_at trigger
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

-- Force PostgREST to reload schemas
select pg_notify('pgrst', 'reload schema');

-- Verification query - run this separately to confirm table exists:
-- select table_name from information_schema.tables where table_schema='public' and table_name='scheduled_posts';