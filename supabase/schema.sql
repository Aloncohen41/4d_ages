-- =====================================================================
-- 4D Ages — sharing a child between parents
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- It is safe to run more than once.
-- =====================================================================

-- ---------- tables ----------
create table if not exists public.children (
  id text primary key,
  name text not null default '',
  birth date not null,
  theme text default 'pink',
  emoji text default '🐣',
  avatar_photo_id text,
  growth_ref text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_ts bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.child_members (
  child_id text not null references public.children(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor',
  email text,
  created_at timestamptz not null default now(),
  primary key (child_id, user_id)
);

create table if not exists public.invites (
  code text primary key,
  child_id text not null references public.children(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- every kind of memory (photo, story, milestone, first, last, measurement) is one row in one table
create table if not exists public.memories (
  id text primary key,
  child_id text not null references public.children(id) on delete cascade,
  type text not null default 'photo',
  title text,
  description text default '',
  date date,
  time text,
  location text,
  milestone_id text,
  height_cm numeric,
  weight_kg numeric,
  emoji text default '📷',
  palette text default 'peach',
  source text default '',
  created_at_ts bigint not null default 0,
  tags jsonb not null default '[]',    -- [{id, name, category, member}]
  media jsonb not null default '[]',   -- [{id, path, kind}]
  client_ts bigint not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_defs (
  child_id text not null references public.children(id) on delete cascade,
  id text not null,
  label text default '',
  emoji text default '🌟',
  hint text default '',
  category text,
  client_ts bigint not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (child_id, id)
);

create table if not exists public.relatives (
  child_id text not null references public.children(id) on delete cascade,
  id text not null,
  name text default '',
  relation text default 'Family',
  custom_label text,
  emoji text default '🙂',
  client_ts bigint not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (child_id, id)
);

create index if not exists memories_child_updated on public.memories (child_id, updated_at);

-- ---------- added later (each line is safe to run again) ----------
alter table public.children add column if not exists gender text;          -- 'girl' | 'boy' | 'unspecified'
alter table public.relatives add column if not exists nickname text;        -- what the child calls them
alter table public.relatives add column if not exists description text;     -- who they are, for the child to read later

-- ---------- the server stamps every change (used as the "what's new" cursor) ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['children','memories','custom_defs','relatives'] loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before insert or update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------- who may see a child ----------
create or replace function public.is_member(cid text) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.child_members where child_id = cid and user_id = auth.uid());
$$;

-- ---------- row level security: only members of a child can touch its data ----------
alter table public.children enable row level security;
alter table public.child_members enable row level security;
alter table public.invites enable row level security;
alter table public.memories enable row level security;
alter table public.custom_defs enable row level security;
alter table public.relatives enable row level security;

drop policy if exists children_select on public.children;
drop policy if exists children_insert on public.children;
drop policy if exists children_update on public.children;
drop policy if exists children_delete on public.children;
create policy children_select on public.children for select to authenticated using (public.is_member(id) or owner_id = auth.uid());
create policy children_insert on public.children for insert to authenticated with check (owner_id = auth.uid());
create policy children_update on public.children for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
create policy children_delete on public.children for delete to authenticated using (owner_id = auth.uid());

drop policy if exists cm_select on public.child_members;
drop policy if exists cm_insert on public.child_members;
drop policy if exists cm_delete on public.child_members;
create policy cm_select on public.child_members for select to authenticated using (public.is_member(child_id));
create policy cm_insert on public.child_members for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.children c where c.id = child_id and c.owner_id = auth.uid()));
create policy cm_delete on public.child_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.children c where c.id = child_id and c.owner_id = auth.uid()));

drop policy if exists invites_select on public.invites;
drop policy if exists invites_insert on public.invites;
create policy invites_select on public.invites for select to authenticated using (public.is_member(child_id));
create policy invites_insert on public.invites for insert to authenticated with check (public.is_member(child_id) and created_by = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['memories','custom_defs','relatives'] loop
    execute format('drop policy if exists member_all on public.%I', t);
    execute format('create policy member_all on public.%I for all to authenticated using (public.is_member(child_id)) with check (public.is_member(child_id))', t);
  end loop;
end $$;

-- ---------- invite codes ----------
create or replace function public.create_invite(p_child text) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_member(p_child) then
    raise exception 'You are not part of this child';
  end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites (code, child_id, created_by, expires_at)
  values (v_code, p_child, auth.uid(), now() + interval '7 days');
  return v_code;
end $$;

create or replace function public.join_child(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare v_inv public.invites; v_child public.children;
begin
  select * into v_inv from public.invites where code = upper(trim(p_code)) and expires_at > now();
  if not found then
    raise exception 'That code is invalid or has expired';
  end if;
  insert into public.child_members (child_id, user_id, role, email)
  values (v_inv.child_id, auth.uid(), 'editor', (select email from auth.users where id = auth.uid()))
  on conflict do nothing;
  delete from public.invites where code = v_inv.code;   -- single use
  select * into v_child from public.children where id = v_inv.child_id;
  return row_to_json(v_child);
end $$;

-- ---------- deleting your account (Settings → Remove my data and delete my account) ----------
-- The app first removes the photos of every child that will be deleted, then calls this. A child this account owns but shares with
-- another parent is handed over to them (it is their book too); every other child it owns is deleted with its memories.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r record;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  for r in
    select c.id,
           (select m.user_id from public.child_members m where m.child_id = c.id and m.user_id <> v_uid order by m.created_at limit 1) as heir
    from public.children c where c.owner_id = v_uid
  loop
    if r.heir is not null then
      update public.children set owner_id = r.heir where id = r.id;
      update public.child_members set role = 'owner' where child_id = r.id and user_id = r.heir;
    else
      delete from public.children where id = r.id;   -- memories, custom milestones, family and invites go with it
    end if;
  end loop;
  delete from public.child_members where user_id = v_uid;
  delete from public.invites where created_by = v_uid;
  delete from auth.users where id = v_uid;
end $$;

grant execute on function public.create_invite(text) to authenticated;
grant execute on function public.join_child(text) to authenticated;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- private storage for photos and videos ----------
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;

drop policy if exists media_member_all on storage.objects;
create policy media_member_all on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.is_member((storage.foldername(name))[1]))
  with check (bucket_id = 'media' and public.is_member((storage.foldername(name))[1]));
