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

-- Atomic compare-and-swap write: concurrent devices cannot silently overwrite
-- a snapshot based on an older revision. A NULL expected revision means "insert
-- only if no row exists". A false result asks the client to re-read and merge.
create or replace function public.save_companion_state(
  p_expected_revision bigint,
  p_schema_version integer,
  p_payload jsonb
)
returns table(saved boolean, revision bigint)
language plpgsql
security invoker
set search_path = ''
as $
declare
  v_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_schema_version is null or p_schema_version <= 0 then
    raise exception 'Invalid schema version' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Payload must be a JSON object' using errcode = '22023';
  end if;

  if p_expected_revision is null then
    insert into public.companion_state as current_state (user_id, schema_version, payload)
    values (auth.uid(), p_schema_version, p_payload)
    on conflict (user_id) do nothing
    returning current_state.revision into v_revision;
  else
    update public.companion_state as current_state
       set schema_version = p_schema_version,
           payload = p_payload
     where current_state.user_id = auth.uid()
       and current_state.revision = p_expected_revision
    returning current_state.revision into v_revision;
  end if;

  if v_revision is not null then
    return query select true, v_revision;
    return;
  end if;

  select current_state.revision
    into v_revision
    from public.companion_state as current_state
   where current_state.user_id = auth.uid();

  return query select false, v_revision;
end;
$;

revoke all on function public.save_companion_state(bigint, integer, jsonb) from public, anon;
grant execute on function public.save_companion_state(bigint, integer, jsonb) to authenticated;

comment on table public.companion_state is
  'Private per-user companion data. Access is restricted by RLS to auth.uid().';
comment on column public.companion_state.payload is
  'Versioned companion data document; contains no game account credentials or session tokens.';
