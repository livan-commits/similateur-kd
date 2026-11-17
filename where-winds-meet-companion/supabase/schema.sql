-- Supabase starter schema for the Where Winds Meet Companion.
-- Run once in the Supabase SQL editor after creating a project.
-- The browser client must use only the publishable/anon key; never expose service_role.

create table public.companion_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version > 0),
  revision bigint not null default 0 check (revision >= 0),
  payload jsonb not null default '{"quests":[],"journal":[],"checks":{},"builds":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companion_state_payload_is_object
    check (jsonb_typeof(payload) = 'object')
);

alter table public.companion_state enable row level security;

revoke all on table public.companion_state from anon, authenticated;
grant select, insert, update, delete on table public.companion_state to authenticated;

create policy "Users can read their own companion state"
  on public.companion_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own companion state"
  on public.companion_state
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own companion state"
  on public.companion_state
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own companion state"
  on public.companion_state
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_companion_state_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;

create trigger companion_state_updated_at
  before update on public.companion_state
  for each row
  execute function public.set_companion_state_updated_at();

comment on table public.companion_state is
  'Private per-user companion data. Access is restricted by RLS to auth.uid().';
comment on column public.companion_state.payload is
  'Versioned companion data document; contains no game account credentials or session tokens.';
