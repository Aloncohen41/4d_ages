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

-- the fill-in pages of a printed baby book (teeth, birth story, food…): one row per template per child
create table if not exists public.classics (
  child_id text not null references public.children(id) on delete cascade,
  id text not null,                          -- the template: 'teeth', 'birth', 'food'…
  data jsonb not null default '{}',          -- the words, by field
  media jsonb not null default '{}',         -- the pictures, by field: {field: [{id, path, kind}]}
  client_ts bigint not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (child_id, id)
);

-- First foods: one row per try of a food (see src/lib/foods.ts). Health information, so only parents and editors may read it.
create table if not exists public.food_tries (
  child_id text not null references public.children(id) on delete cascade,
  id text not null,
  food text not null,                        -- a food from the app's list ('egg', 'peanut'…) or one added by hand
  date date,
  amount text,                               -- 'taste' | 'some' | 'portion'
  liked text,                                -- 'yes' | 'meh' | 'no'
  reaction text,                             -- 'none' | 'mild' | 'serious'
  note text,                                 -- what the reaction was
  client_ts bigint not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (child_id, id)
);

-- hearts and comments: one per person per post (a heart, a comment, or both), from anyone who can see the post
create table if not exists public.reactions (
  child_id text not null references public.children(id) on delete cascade,
  memory_id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author text not null default '',          -- the name shown beside it
  heart boolean not null default false,
  comment text not null default '',
  updated_at timestamptz not null default now(),
  primary key (memory_id, user_id)
);
create index if not exists reactions_child on public.reactions (child_id, updated_at);

create index if not exists memories_child_updated on public.memories (child_id, updated_at);

-- ---------- added later (each line is safe to run again) ----------
alter table public.children add column if not exists gender text;          -- 'girl' | 'boy' | 'unspecified'
alter table public.relatives add column if not exists nickname text;        -- what the child calls them
alter table public.relatives add column if not exists description text;     -- who they are, for the child to read later
alter table public.memories add column if not exists head_cm numeric;       -- head circumference, with a measurement
-- sharing by person: a member is an owner or editor (sees and changes everything) or a viewer, who only sees the posts with the people listed
alter table public.child_members add column if not exists people text[] not null default '{}';   -- viewers: the family members whose posts they see
alter table public.invites add column if not exists role text not null default 'editor';        -- 'editor' | 'viewer'
alter table public.invites add column if not exists people text[] not null default '{}';
alter table public.invites add column if not exists email text;              -- an invite for one person: only this email can use it

-- people a family has blocked from a child's book: they can't join again with any code until they're unblocked
create table if not exists public.child_blocks (
  child_id text not null references public.children(id) on delete cascade,
  email text not null,
  user_id uuid,
  blocked_by uuid default auth.uid(),
  blocked_at timestamptz not null default now(),
  primary key (child_id, email)
);
alter table public.child_blocks enable row level security;
drop policy if exists blocks_read on public.child_blocks;
create policy blocks_read on public.child_blocks for select to authenticated using (public.is_editor(child_id));
-- a pet's book (kind = 'pet'): what kind of pet, the breed, the dog's size (for dog years), whether the birthday is a guess, and the day they came home
alter table public.children add column if not exists kind text;
alter table public.children add column if not exists species text;
alter table public.children add column if not exists breed text;
alter table public.children add column if not exists dog_size text;
alter table public.children add column if not exists birth_approx boolean not null default false;
alter table public.children add column if not exists gotcha_day date;
alter table public.memories add column if not exists end_date date;          -- a pregnancy symptom: the last day of the time it lasted
-- a family member who IS one of the children or pets (a sibling, "Our dog"): which profile. Deleting that profile removes them from every family.
alter table public.relatives add column if not exists child_ref text;
-- how a family member is related, for the family tree: who they are to the child, whose side they're on, who they're with, and (a cousin's
-- parent, a great-grandparent's child) who links them
alter table public.relatives add column if not exists kin text;
alter table public.relatives add column if not exists side text;
alter table public.relatives add column if not exists partner_id text;
alter table public.relatives add column if not exists through_id text;
-- (and any left over from a profile that's gone)
update public.relatives r set deleted = true, client_ts = (extract(epoch from now()) * 1000)::bigint
  where r.child_ref is not null and not r.deleted and not exists (select 1 from public.children c where c.id = r.child_ref);
alter table public.memories add column if not exists health_kind text;      -- health log entries: 'checkup' | 'vaccination' | 'illness' | 'medicine' | 'other'
alter table public.children add column if not exists expecting boolean not null default false;   -- not born yet: birth is the due date
alter table public.children add column if not exists food_goal smallint;   -- Foods & allergens: tries without a reaction for a food to be done (3, 4 or 5; empty is 3)

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
  foreach t in array array['children','memories','custom_defs','relatives','classics','food_tries','reactions'] loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before insert or update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------- who may see a child ----------
create or replace function public.is_member(cid text) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.child_members where child_id = cid and user_id = auth.uid());
$$;

-- an owner or editor: sees everything and may change it (a viewer may only look)
create or replace function public.is_editor(cid text) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.child_members where child_id = cid and user_id = auth.uid() and role <> 'viewer');
$$;

-- a viewer sees a memory only when one of the people they were given is tagged in it
create or replace function public.can_see_memory(cid text, p_tags jsonb) returns boolean
language sql security definer stable set search_path = public as $$
  select public.is_editor(cid) or exists (
    select 1 from public.child_members m, jsonb_array_elements(coalesce(p_tags, '[]'::jsonb)) t
    where m.child_id = cid and m.user_id = auth.uid() and m.role = 'viewer' and (t->>'member') = any(m.people)
  );
$$;

-- ---------- row level security: only members of a child can touch its data ----------
alter table public.children enable row level security;
alter table public.child_members enable row level security;
alter table public.invites enable row level security;
alter table public.memories enable row level security;
alter table public.custom_defs enable row level security;
alter table public.relatives enable row level security;
alter table public.classics enable row level security;
alter table public.food_tries enable row level security;
alter table public.reactions enable row level security;

drop policy if exists children_select on public.children;
drop policy if exists children_insert on public.children;
drop policy if exists children_update on public.children;
drop policy if exists children_delete on public.children;
create policy children_select on public.children for select to authenticated using (public.is_member(id) or owner_id = auth.uid());
create policy children_insert on public.children for insert to authenticated with check (owner_id = auth.uid());
create policy children_update on public.children for update to authenticated
  using (public.is_editor(id) or owner_id = auth.uid()) with check (public.is_editor(id) or owner_id = auth.uid());
create policy children_delete on public.children for delete to authenticated using (owner_id = auth.uid());

drop policy if exists cm_select on public.child_members;
drop policy if exists cm_insert on public.child_members;
drop policy if exists cm_delete on public.child_members;
-- you always see your own membership (and the other members of a child you're in). Seeing your own row matters: adding yourself as the
-- first member with "insert, or skip if it's there" makes the database check the new row is visible to you, and before this rule it
-- wasn't (you weren't a member yet), so the first membership could never be added and sharing a child failed every time.
create policy cm_select on public.child_members for select to authenticated using (user_id = auth.uid() or public.is_member(child_id));
create policy cm_insert on public.child_members for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.children c where c.id = child_id and c.owner_id = auth.uid()));
create policy cm_delete on public.child_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.children c where c.id = child_id and c.owner_id = auth.uid()));

drop policy if exists invites_select on public.invites;
drop policy if exists invites_insert on public.invites;
create policy invites_select on public.invites for select to authenticated using (public.is_member(child_id));
create policy invites_insert on public.invites for insert to authenticated with check (public.is_editor(child_id) and created_by = auth.uid());
drop policy if exists invites_delete on public.invites;
create policy invites_delete on public.invites for delete to authenticated using (created_by = auth.uid() or public.is_editor(child_id));   -- cancel an invite

-- every member may read the custom milestones and the family; only editors may change anything. Memories are read as can_see_memory
-- allows; the fill-in pages (classics) are for editors only.
do $$
declare t text;
begin
  foreach t in array array['memories','custom_defs','relatives','classics','food_tries'] loop
    execute format('drop policy if exists member_all on public.%I', t);
    execute format('drop policy if exists member_read on public.%I', t);
    execute format('drop policy if exists editor_write on public.%I', t);
    execute format('drop policy if exists editor_update on public.%I', t);
    execute format('drop policy if exists editor_delete on public.%I', t);
    execute format('create policy editor_write on public.%I for insert to authenticated with check (public.is_editor(child_id))', t);
    execute format('create policy editor_update on public.%I for update to authenticated using (public.is_editor(child_id)) with check (public.is_editor(child_id))', t);
    execute format('create policy editor_delete on public.%I for delete to authenticated using (public.is_editor(child_id))', t);
  end loop;
end $$;
create policy member_read on public.memories for select to authenticated using (public.can_see_memory(child_id, tags));
create policy member_read on public.custom_defs for select to authenticated using (public.is_member(child_id));
create policy member_read on public.relatives for select to authenticated using (public.is_member(child_id));
create policy member_read on public.classics for select to authenticated using (public.is_editor(child_id));
create policy member_read on public.food_tries for select to authenticated using (public.is_editor(child_id));   -- not view-only family

-- reactions: seen by whoever can see the post; each person writes only their own
create or replace function public.can_see_post(p_memory text) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.memories m where m.id = p_memory and not m.deleted and public.can_see_memory(m.child_id, m.tags));
$$;
drop policy if exists reactions_read on public.reactions;
drop policy if exists reactions_insert on public.reactions;
drop policy if exists reactions_update on public.reactions;
drop policy if exists reactions_delete on public.reactions;
create policy reactions_read on public.reactions for select to authenticated using (public.can_see_post(memory_id));
create policy reactions_insert on public.reactions for insert to authenticated with check (user_id = auth.uid() and public.is_member(child_id) and public.can_see_post(memory_id));
create policy reactions_update on public.reactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_see_post(memory_id));
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid() or public.is_editor(child_id));

-- ---------- a child always has its owner as a member ----------
-- The owner is added the moment a child is created, whichever app version uploads it. (Before this, an upload could leave a child in the
-- cloud with no members: no one could then share it, and sharing failed every time.)
create or replace function public.add_owner_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.child_members (child_id, user_id, role, email)
  values (new.id, new.owner_id, 'owner', (select email from auth.users where id = new.owner_id))
  on conflict (child_id, user_id) do nothing;
  return new;
end $$;
drop trigger if exists trg_owner_member on public.children;
create trigger trg_owner_member after insert on public.children for each row execute function public.add_owner_member();

-- repair: children uploaded before that, still without their owner as a member
insert into public.child_members (child_id, user_id, role, email)
select c.id, c.owner_id, 'owner', (select email from auth.users where id = c.owner_id)
from public.children c
where c.owner_id is not null and not exists (select 1 from public.child_members m where m.child_id = c.id and m.user_id = c.owner_id)
on conflict (child_id, user_id) do nothing;

-- the app's sample family (exploring before signing in) is never kept in an account: remove any that was uploaded by mistake
delete from public.children where id in ('maya', 'leo') and not exists (select 1 from public.memories m where m.child_id = children.id);

-- ---------- invite codes ----------
-- A child's book has at most two parents (owner and editor); a pet's book up to six owners. Any number of family members may be invited to view.
create or replace function public.max_parents(cid text) returns int
language sql stable security definer set search_path = public as $$
  select case when (select kind from public.children where id = cid) = 'pet' then 6 else 2 end
$$;
create or replace function public.parent_count(cid text) returns int
language sql security definer stable set search_path = public as $$
  select count(*)::int from public.child_members where child_id = cid and role <> 'viewer';
$$;

-- An invite gives full access (an editor, the default), or view-only access to the posts with the chosen people (p_people).
-- Earlier app versions call it with the child only, which gives full access as before.
drop function if exists public.create_invite(text);
drop function if exists public.create_invite(text, text[]);
create or replace function public.create_invite(p_child text, p_people text[] default null, p_email text default null) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_editor(p_child) then
    raise exception 'You are not part of this child';
  end if;
  if p_people is null and public.parent_count(p_child) >= public.max_parents(p_child) then
    raise exception 'This book already has as many parents as it can (two for a child, six for a pet). Someone has to be removed before another can join.';
  end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  if p_email is not null and exists (select 1 from public.child_blocks where child_id = p_child and email = lower(trim(p_email))) then
    raise exception 'That email is blocked from this book. Unblock it first (Settings, Who can see your children).';
  end if;
  insert into public.invites (code, child_id, created_by, expires_at, role, people, email)
  values (v_code, p_child, auth.uid(), now() + interval '7 days',
          case when p_people is null then 'editor' else 'viewer' end, coalesce(p_people, '{}'), nullif(lower(trim(coalesce(p_email, ''))), ''));
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
  if exists (select 1 from public.child_blocks b where b.child_id = v_inv.child_id
             and (b.user_id = auth.uid() or b.email = lower((select email from auth.users where id = auth.uid())))) then
    raise exception 'You don''t have access to this book.';
  end if;
  if v_inv.email is not null and v_inv.email <> lower((select email from auth.users where id = auth.uid())) then
    raise exception 'This code was made for a different email address. Sign in with that email, or ask for a new code.';
  end if;
  if v_inv.role <> 'viewer' and not exists (select 1 from public.child_members where child_id = v_inv.child_id and user_id = auth.uid() and role <> 'viewer')
     and public.parent_count(v_inv.child_id) >= public.max_parents(v_inv.child_id) then
    raise exception 'This book already has as many parents as it can (two for a child, six for a pet). Someone has to be removed first.';
  end if;
  -- joining again with a new code updates what you can see (someone already an owner or editor keeps that)
  insert into public.child_members (child_id, user_id, role, email, people)
  values (v_inv.child_id, auth.uid(), v_inv.role, (select email from auth.users where id = auth.uid()), v_inv.people)
  on conflict (child_id, user_id) do update set
    role = case when public.child_members.role in ('owner', 'editor') then public.child_members.role else excluded.role end,
    people = case when public.child_members.role in ('owner', 'editor') then '{}' else excluded.people end;
  delete from public.invites where code = v_inv.code;   -- single use
  select * into v_child from public.children where id = v_inv.child_id;
  return row_to_json(v_child);
end $$;

-- before joining: does this person already have this access? Then the app says so and the invite is left for whoever it was meant for (opening
-- your own invite link no longer uses it up). The child's name is only returned to someone who can already see the book.
create or replace function public.check_invite(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare v_inv public.invites; v_mine public.child_members;
begin
  select * into v_inv from public.invites where code = upper(trim(p_code)) and expires_at > now();
  if not found then
    return json_build_object('already', false);
  end if;
  select * into v_mine from public.child_members where child_id = v_inv.child_id and user_id = auth.uid();
  if not found then
    return json_build_object('already', false);
  end if;
  if v_mine.role in ('owner', 'editor') or (v_inv.role = 'viewer' and coalesce(v_mine.people, '{}') @> coalesce(v_inv.people, '{}') and coalesce(v_inv.people, '{}') @> coalesce(v_mine.people, '{}')) then
    return json_build_object('already', true, 'child_id', v_inv.child_id, 'name', (select name from public.children where id = v_inv.child_id), 'role', v_mine.role);
  end if;
  return json_build_object('already', false);
end $$;
revoke execute on function public.check_invite(text) from public, anon;
grant execute on function public.check_invite(text) to authenticated;

-- ---------- who has access: removing someone, and what a viewer sees ----------
-- The owner may remove anyone; the other parent may remove viewers (and leave themselves). The owner can't be removed by someone else.
drop function if exists public.remove_member(text, uuid);
create or replace function public.remove_member(p_child text, p_user uuid, p_block boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare v_me text; v_them text; v_email text;
begin
  select role into v_me from public.child_members where child_id = p_child and user_id = auth.uid();
  select role into v_them from public.child_members where child_id = p_child and user_id = p_user;
  if v_me is null or v_them is null then
    raise exception 'That person is not part of this book';
  end if;
  if p_user <> auth.uid() and not (v_me = 'owner' or (v_me = 'editor' and v_them = 'viewer')) then
    raise exception 'Only the parent who created the book can remove the other parent';
  end if;
  if v_them = 'owner' then
    raise exception 'The parent who created the book can''t be removed';
  end if;
  select coalesce(m.email, (select email from auth.users where id = p_user)) into v_email from public.child_members m where m.child_id = p_child and m.user_id = p_user;
  delete from public.child_members where child_id = p_child and user_id = p_user;
  delete from public.invites where child_id = p_child and created_by = p_user;   -- their unused codes stop working too
  if p_block and p_user <> auth.uid() and v_email is not null then
    insert into public.child_blocks (child_id, email, user_id) values (p_child, lower(v_email), p_user)
    on conflict (child_id, email) do update set user_id = excluded.user_id, blocked_at = now();
    delete from public.invites where child_id = p_child and email = lower(v_email);
  end if;
end $$;

-- block an email that hasn't joined (yet), or unblock one
create or replace function public.block_email(p_child text, p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_editor(p_child) then raise exception 'You are not part of this child'; end if;
  insert into public.child_blocks (child_id, email) values (p_child, lower(trim(p_email))) on conflict do nothing;
  delete from public.invites where child_id = p_child and email = lower(trim(p_email));
end $$;
create or replace function public.unblock_email(p_child text, p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_editor(p_child) then raise exception 'You are not part of this child'; end if;
  delete from public.child_blocks where child_id = p_child and email = lower(trim(p_email));
end $$;
grant execute on function public.block_email(text, text) to authenticated;
grant execute on function public.unblock_email(text, text) to authenticated;

create or replace function public.set_member_people(p_child text, p_user uuid, p_people text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_editor(p_child) then
    raise exception 'You are not part of this child';
  end if;
  update public.child_members set people = coalesce(p_people, '{}') where child_id = p_child and user_id = p_user and role = 'viewer';
end $$;

grant execute on function public.remove_member(text, uuid, boolean) to authenticated;
grant execute on function public.set_member_people(text, uuid, text[]) to authenticated;
grant execute on function public.parent_count(text) to authenticated;
grant execute on function public.max_parents(text) to authenticated;

-- ---------- live updates: a change on one phone reaches the other at once (row-level security still decides who hears what) ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['children','memories','custom_defs','relatives','classics','food_tries','child_members','reactions'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
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
           (select m.user_id from public.child_members m where m.child_id = c.id and m.user_id <> v_uid and m.role <> 'viewer' order by m.created_at limit 1) as heir
    from public.children c where c.owner_id = v_uid
  loop
    if r.heir is not null then
      update public.children set owner_id = r.heir where id = r.id;
      update public.child_members set role = 'owner' where child_id = r.id and user_id = r.heir;
    else
      delete from public.children where id = r.id;   -- memories, custom milestones, family, classics, invites and viewers go with it
    end if;
  end loop;
  delete from public.child_members where user_id = v_uid;
  delete from public.invites where created_by = v_uid;
  delete from auth.users where id = v_uid;
end $$;

-- deleting a child's profile. The parent who created it: if the other parent is in the book, it is handed over to them (it is their book too)
-- and the creator leaves; otherwise the child is deleted with everything in it. Anyone else just leaves. Returns 'handed', 'deleted' or 'left'.
create or replace function public.delete_child(p_child text) returns text
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_heir uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  select owner_id into v_owner from public.children where id = p_child;
  if v_owner is null then
    return 'deleted'; -- already gone
  end if;
  if v_owner <> v_uid then
    delete from public.child_members where child_id = p_child and user_id = v_uid;
    return 'left';
  end if;
  select m.user_id into v_heir from public.child_members m
    where m.child_id = p_child and m.user_id <> v_uid and m.role <> 'viewer' order by m.created_at limit 1;
  if v_heir is not null then
    update public.children set owner_id = v_heir where id = p_child;
    update public.child_members set role = 'owner' where child_id = p_child and user_id = v_heir;
    delete from public.child_members where child_id = p_child and user_id = v_uid;
    return 'handed';
  end if;
  delete from public.children where id = p_child; -- memories, family, classics, invites, reactions and viewers go with it
  -- and they leave their brothers' and sisters' families too
  update public.relatives set deleted = true, client_ts = (extract(epoch from now()) * 1000)::bigint where child_ref = p_child and not deleted;
  return 'deleted';
end $$;
revoke execute on function public.delete_child(text) from public, anon;
grant execute on function public.delete_child(text) to authenticated;

grant execute on function public.create_invite(text, text[], text) to authenticated;
grant execute on function public.join_child(text) to authenticated;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- private storage for photos and videos ----------
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;

-- every member may download (a viewer only learns the paths of the posts they can see); only editors may upload or remove
drop policy if exists media_member_all on storage.objects;
drop policy if exists media_member_read on storage.objects;
drop policy if exists media_editor_insert on storage.objects;
drop policy if exists media_editor_update on storage.objects;
drop policy if exists media_editor_delete on storage.objects;
create policy media_member_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_member((storage.foldername(name))[1]));
create policy media_editor_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_editor((storage.foldername(name))[1]));
create policy media_editor_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_editor((storage.foldername(name))[1]))
  with check (bucket_id = 'media' and public.is_editor((storage.foldername(name))[1]));
create policy media_editor_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_editor((storage.foldername(name))[1]));
