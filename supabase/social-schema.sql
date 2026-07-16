-- Zimo Supabase foundation schema.
-- Run this file in Supabase SQL Editor after creating a project.
-- It enables RLS for browser-safe access through the anon key.

create extension if not exists pgcrypto;

do $$
begin
  create type public.friendship_status as enum ('pending', 'accepted', 'rejected', 'blocked');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.post_audience as enum ('public', 'friends', 'close_friends', 'circle', 'private');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.creative_work_type as enum ('post', 'album', 'challenge', 'space', 'collab');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default 'Zimo user',
  avatar_url text,
  header_url text,
  bio text,
  city text,
  birthdate date,
  status_text text,
  status_emoji text,
  status_updated_at timestamptz,
  creative_mode boolean not null default false,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username is null or username ~ '^[a-zA-Z0-9_]{3,20}$'),
  constraint profiles_status_length check (status_text is null or char_length(status_text) <= 80)
);

create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, interest_id)
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  is_best_friend boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);

create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default '#111827',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint circles_name_length check (char_length(name) between 1 and 40)
);

create table if not exists public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (circle_id, profile_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  image_urls text[] not null default '{}',
  video_url text,
  audience public.post_audience not null default 'public',
  circle_id uuid references public.circles(id) on delete set null,
  creative_type public.creative_work_type,
  collaboration_parent_id uuid references public.posts(id) on delete set null,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_body_or_media check (char_length(content) > 0 or array_length(image_urls, 1) > 0 or video_url is not null)
);

create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'like',
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id, reaction)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  audience public.post_audience not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, post_id)
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  prompt text not null,
  cover_url text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.challenge_entries (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (challenge_id, post_id)
);

create table if not exists public.creative_spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  audience public.post_audience not null default 'friends',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creative_space_members (
  space_id uuid not null references public.creative_spaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (space_id, profile_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  is_group boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_pinned boolean not null default false,
  muted_until timestamptz,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  image_url text,
  audio_url text,
  reply_to_id uuid references public.messages(id) on delete set null,
  reactions jsonb not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_body_or_media check (char_length(content) > 0 or image_url is not null or audio_url is not null)
);

create table if not exists public.contact_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  remind_at timestamptz not null,
  note text,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid references public.profiles(id) on delete cascade,
  target_post_id uuid references public.posts(id) on delete cascade,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.soft_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles(id) on delete set null,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_posts_feed on public.posts(audience, created_at desc);
create index if not exists idx_posts_author on public.posts(author_id, created_at desc);
create index if not exists idx_friendships_requester on public.friendships(requester_id, status);
create index if not exists idx_friendships_addressee on public.friendships(addressee_id, status);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at desc);
create index if not exists idx_reminders_owner on public.contact_reminders(owner_id, remind_at);
create index if not exists idx_reports_status on public.reports(status, created_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_friendships_updated_at on public.friendships;
create trigger set_friendships_updated_at before update on public.friendships
for each row execute function public.set_updated_at();

drop trigger if exists set_circles_updated_at on public.circles;
create trigger set_circles_updated_at before update on public.circles
for each row execute function public.set_updated_at();

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at before update on public.posts
for each row execute function public.set_updated_at();

drop trigger if exists set_collections_updated_at on public.collections;
create trigger set_collections_updated_at before update on public.collections
for each row execute function public.set_updated_at();

drop trigger if exists set_challenges_updated_at on public.challenges;
create trigger set_challenges_updated_at before update on public.challenges
for each row execute function public.set_updated_at();

drop trigger if exists set_spaces_updated_at on public.creative_spaces;
create trigger set_spaces_updated_at before update on public.creative_spaces
for each row execute function public.set_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

drop trigger if exists set_messages_updated_at on public.messages;
create trigger set_messages_updated_at before update on public.messages
for each row execute function public.set_updated_at();

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = a and f.addressee_id = b) or
        (f.requester_id = b and f.addressee_id = a)
      )
  );
$$;

create or replace function public.is_close_friend(owner uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and f.is_best_friend = true
      and (
        (f.requester_id = owner and f.addressee_id = viewer) or
        (f.requester_id = viewer and f.addressee_id = owner)
      )
  );
$$;

create or replace function public.is_circle_member(target_circle_id uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members cm
    join public.circles c on c.id = cm.circle_id
    where cm.circle_id = target_circle_id
      and (cm.profile_id = viewer or c.owner_id = viewer)
  );
$$;

create or replace function public.can_read_post(
  target_author_id uuid,
  target_audience public.post_audience,
  target_circle_id uuid,
  viewer uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_audience = 'public'
    or viewer = target_author_id
    or (viewer is not null and target_audience = 'friends' and public.are_friends(target_author_id, viewer))
    or (viewer is not null and target_audience = 'close_friends' and public.is_close_friend(target_author_id, viewer))
    or (viewer is not null and target_audience = 'circle' and public.is_circle_member(target_circle_id, viewer));
$$;

alter table public.profiles enable row level security;
alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
alter table public.friendships enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.creative_spaces enable row level security;
alter table public.creative_space_members enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.contact_reminders enable row level security;
alter table public.reports enable row level security;
alter table public.soft_moderation_actions enable row level security;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles
for select using (true);

drop policy if exists "profiles are self managed" on public.profiles;
create policy "profiles are self managed" on public.profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "interests are readable" on public.interests;
create policy "interests are readable" on public.interests
for select using (true);

drop policy if exists "profile interests are readable" on public.profile_interests;
create policy "profile interests are readable" on public.profile_interests
for select using (true);

drop policy if exists "profile interests are self managed" on public.profile_interests;
create policy "profile interests are self managed" on public.profile_interests
for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "friendships visible to members" on public.friendships;
create policy "friendships visible to members" on public.friendships
for select using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "friend requests can be created" on public.friendships;
create policy "friend requests can be created" on public.friendships
for insert with check (auth.uid() = requester_id and requester_id <> addressee_id);

drop policy if exists "friendships can be answered" on public.friendships;
create policy "friendships can be answered" on public.friendships
for update using (auth.uid() in (requester_id, addressee_id))
with check (auth.uid() in (requester_id, addressee_id));

drop policy if exists "circles visible to owner" on public.circles;
create policy "circles visible to owner" on public.circles
for select using (auth.uid() = owner_id);

drop policy if exists "circles owner managed" on public.circles;
create policy "circles owner managed" on public.circles
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "circle members visible to owner" on public.circle_members;
create policy "circle members visible to owner" on public.circle_members
for select using (
  exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid())
);

drop policy if exists "circle members owner managed" on public.circle_members;
create policy "circle members owner managed" on public.circle_members
for all using (
  exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid())
) with check (
  exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid())
);

drop policy if exists "posts readable by audience" on public.posts;
create policy "posts readable by audience" on public.posts
for select using (public.can_read_post(author_id, audience, circle_id, auth.uid()));

drop policy if exists "posts author managed" on public.posts;
create policy "posts author managed" on public.posts
for all using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "post reactions readable when post readable" on public.post_reactions;
create policy "post reactions readable when post readable" on public.post_reactions
for select using (
  exists (
    select 1 from public.posts p
    where p.id = post_id
      and public.can_read_post(p.author_id, p.audience, p.circle_id, auth.uid())
  )
);

drop policy if exists "post reactions self managed" on public.post_reactions;
create policy "post reactions self managed" on public.post_reactions
for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "collections author managed" on public.collections;
create policy "collections author managed" on public.collections
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "collections readable" on public.collections;
create policy "collections readable" on public.collections
for select using (
  audience = 'public'
  or owner_id = auth.uid()
  or (audience = 'friends' and public.are_friends(owner_id, auth.uid()))
  or (audience = 'close_friends' and public.is_close_friend(owner_id, auth.uid()))
);

drop policy if exists "collection items follow collection" on public.collection_items;
create policy "collection items follow collection" on public.collection_items
for select using (
  exists (
    select 1 from public.collections c
    where c.id = collection_id
      and (c.owner_id = auth.uid() or c.audience = 'public' or public.are_friends(c.owner_id, auth.uid()))
  )
);

drop policy if exists "collection items owner managed" on public.collection_items;
create policy "collection items owner managed" on public.collection_items
for all using (
  exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())
) with check (
  exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())
);

drop policy if exists "challenges readable" on public.challenges;
create policy "challenges readable" on public.challenges
for select using (true);

drop policy if exists "challenges creator managed" on public.challenges;
create policy "challenges creator managed" on public.challenges
for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

drop policy if exists "challenge entries readable" on public.challenge_entries;
create policy "challenge entries readable" on public.challenge_entries
for select using (true);

drop policy if exists "challenge entries self managed" on public.challenge_entries;
create policy "challenge entries self managed" on public.challenge_entries
for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "spaces readable by members" on public.creative_spaces;
create policy "spaces readable by members" on public.creative_spaces
for select using (
  owner_id = auth.uid()
  or audience = 'public'
  or exists (
    select 1 from public.creative_space_members m
    where m.space_id = id and m.profile_id = auth.uid()
  )
);

drop policy if exists "spaces owner managed" on public.creative_spaces;
create policy "spaces owner managed" on public.creative_spaces
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "space members visible to members" on public.creative_space_members;
create policy "space members visible to members" on public.creative_space_members
for select using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.creative_spaces s
    where s.id = space_id and s.owner_id = auth.uid()
  )
);

drop policy if exists "space members owner managed" on public.creative_space_members;
create policy "space members owner managed" on public.creative_space_members
for all using (
  exists (select 1 from public.creative_spaces s where s.id = space_id and s.owner_id = auth.uid())
) with check (
  exists (select 1 from public.creative_spaces s where s.id = space_id and s.owner_id = auth.uid())
);

drop policy if exists "conversations visible to members" on public.conversations;
create policy "conversations visible to members" on public.conversations
for select using (
  exists (
    select 1 from public.conversation_members m
    where m.conversation_id = id and m.profile_id = auth.uid()
  )
);

drop policy if exists "conversations can be created" on public.conversations;
create policy "conversations can be created" on public.conversations
for insert with check (auth.uid() = created_by);

drop policy if exists "conversation members visible to members" on public.conversation_members;
create policy "conversation members visible to members" on public.conversation_members
for select using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.conversation_members mine
    where mine.conversation_id = conversation_id and mine.profile_id = auth.uid()
  )
);

drop policy if exists "conversation members self update" on public.conversation_members;
create policy "conversation members self update" on public.conversation_members
for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "messages visible to conversation members" on public.messages;
create policy "messages visible to conversation members" on public.messages
for select using (
  exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conversation_id and m.profile_id = auth.uid()
  )
);

drop policy if exists "messages sent by members" on public.messages;
create policy "messages sent by members" on public.messages
for insert with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conversation_id and m.profile_id = auth.uid()
  )
);

drop policy if exists "messages sender update" on public.messages;
create policy "messages sender update" on public.messages
for update using (auth.uid() = sender_id) with check (auth.uid() = sender_id);

drop policy if exists "reminders owner managed" on public.contact_reminders;
create policy "reminders owner managed" on public.contact_reminders
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "reports can be created" on public.reports;
create policy "reports can be created" on public.reports
for insert with check (auth.uid() = reporter_id);

drop policy if exists "reports visible to reporter" on public.reports;
create policy "reports visible to reporter" on public.reports
for select using (auth.uid() = reporter_id);

drop policy if exists "moderation hidden from clients" on public.soft_moderation_actions;
create policy "moderation hidden from clients" on public.soft_moderation_actions
for select using (false);

