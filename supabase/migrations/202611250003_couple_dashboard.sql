-- Phase 4: private shared dashboard content and realtime authorization.
create or replace function public.is_active_couple_member(p_space_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.couple_members m
    join public.couple_spaces s on s.id = m.space_id
    where m.space_id = p_space_id and m.user_id = (select auth.uid())
      and m.membership_state = 'active' and s.status = 'connected'
  );
$$;
revoke all on function public.is_active_couple_member(uuid) from public, anon;
grant execute on function public.is_active_couple_member(uuid) to authenticated;

create table if not exists public.shared_love_notes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists shared_love_notes_space_created_idx on public.shared_love_notes(space_id,created_at desc);

create table if not exists public.shared_special_dates (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 100),
  occurs_on date not null,
  created_at timestamptz not null default now()
);
create index if not exists shared_special_dates_space_date_idx on public.shared_special_dates(space_id,occurs_on);

create table if not exists public.shared_memories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  caption text not null check (length(btrim(caption)) between 1 and 240),
  remembered_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists shared_memories_space_created_idx on public.shared_memories(space_id,created_at desc);

create table if not exists public.couple_activity_events (
  id bigint generated always as identity primary key,
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('love_note','special_date','memory','game_activity')),
  summary text not null check (length(summary) <= 160),
  created_at timestamptz not null default now()
);
create index if not exists couple_activity_space_created_idx on public.couple_activity_events(space_id,created_at desc);

alter table public.shared_love_notes enable row level security;
alter table public.shared_special_dates enable row level security;
alter table public.shared_memories enable row level security;
alter table public.couple_activity_events enable row level security;
create policy "Active couple members can read love notes" on public.shared_love_notes for select to authenticated using (public.is_active_couple_member(space_id));
create policy "Active couple members can read special dates" on public.shared_special_dates for select to authenticated using (public.is_active_couple_member(space_id));
create policy "Active couple members can read memories" on public.shared_memories for select to authenticated using (public.is_active_couple_member(space_id));
create policy "Active couple members can read activity" on public.couple_activity_events for select to authenticated using (public.is_active_couple_member(space_id));
grant select on public.shared_love_notes,public.shared_special_dates,public.shared_memories,public.couple_activity_events to authenticated;
revoke insert,update,delete on public.shared_love_notes,public.shared_special_dates,public.shared_memories,public.couple_activity_events from anon,authenticated;

-- Private Presence and Broadcast topics are scoped to a connected room.
create policy "Connected members can receive couple broadcasts" on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'broadcast' and split_part(realtime.topic(),':',1) = 'couple'
  and public.is_active_couple_member(nullif(split_part(realtime.topic(),':',2),'')::uuid)
);
create policy "Connected members can send couple broadcasts" on realtime.messages for insert to authenticated with check (
  realtime.messages.extension = 'broadcast' and split_part(realtime.topic(),':',1) = 'couple'
  and public.is_active_couple_member(nullif(split_part(realtime.topic(),':',2),'')::uuid)
);
create policy "Connected members can use couple presence" on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'presence' and split_part(realtime.topic(),':',1) = 'couple'
  and public.is_active_couple_member(nullif(split_part(realtime.topic(),':',2),'')::uuid)
);
create policy "Connected members can track couple presence" on realtime.messages for insert to authenticated with check (
  realtime.messages.extension = 'presence' and split_part(realtime.topic(),':',1) = 'couple'
  and public.is_active_couple_member(nullif(split_part(realtime.topic(),':',2),'')::uuid)
);

do $$ begin
  alter publication supabase_realtime add table public.shared_love_notes;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.shared_special_dates;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.shared_memories;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.couple_activity_events;
exception when duplicate_object then null; when undefined_object then null;
end $$;

create or replace function public.get_couple_dashboard()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); sid uuid; my_name text; my_avatar text; other_name text; other_avatar text; room_created timestamptz;
  notes jsonb; dates jsonb; memories jsonb; activity jsonb;
begin
  perform public.assert_verified_couple_user();
  select s.id,s.created_at into sid,room_created from public.couple_spaces s
    join public.couple_members m on m.space_id=s.id where m.user_id=uid and m.membership_state='active' and s.status='connected' limit 1;
  if sid is null then raise exception 'Connect your person to open the shared home.' using errcode='P0002'; end if;
  select full_name,avatar_url into my_name,my_avatar from public.profiles where id=uid;
  select p.full_name,p.avatar_url into other_name,other_avatar from public.couple_members m
    join public.profiles p on p.id=m.user_id where m.space_id=sid and m.user_id<>uid and m.membership_state='active' limit 1;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into notes from (
    select n.id,n.body,n.created_at,p.full_name as author_name from public.shared_love_notes n join public.profiles p on p.id=n.author_id where n.space_id=sid order by n.created_at desc limit 3
  ) x;
  select coalesce(jsonb_agg(x order by x.occurs_on),'[]'::jsonb) into dates from (
    select d.id,d.title,d.occurs_on from public.shared_special_dates d where d.space_id=sid and d.occurs_on >= current_date order by d.occurs_on limit 3
  ) x;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into memories from (
    select m.id,m.caption,m.remembered_on,m.created_at,p.full_name as author_name from public.shared_memories m join public.profiles p on p.id=m.created_by where m.space_id=sid order by m.created_at desc limit 3
  ) x;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into activity from (
    select e.id,e.event_type,e.summary,e.created_at,p.full_name as actor_name from public.couple_activity_events e left join public.profiles p on p.id=e.actor_id where e.space_id=sid order by e.created_at desc limit 5
  ) x;
  select coalesce(e.created_at,room_created) into room_created from public.connection_events e where e.space_id=sid and e.event_type='connection_confirmed' order by e.created_at limit 1;
  return jsonb_build_object('space_id',sid,'your_name',coalesce(my_name,'there'),'your_avatar_url',my_avatar,'partner_name',coalesce(other_name,'your person'),'partner_avatar_url',other_avatar,'connected_at',room_created,'notes',notes,'dates',dates,'memories',memories,'activity',activity);
end;
$$;
revoke all on function public.get_couple_dashboard() from public,anon;
grant execute on function public.get_couple_dashboard() to authenticated;

create or replace function public.add_couple_dashboard_item(p_kind text,p_title text,p_body text default null,p_date date default current_date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); sid uuid; new_id uuid; clean_title text := btrim(coalesce(p_title,'')); clean_body text := btrim(coalesce(p_body,''));
begin
  perform public.assert_verified_couple_user();
  select s.id into sid from public.couple_spaces s join public.couple_members m on m.space_id=s.id
    where m.user_id=uid and m.membership_state='active' and s.status='connected' limit 1;
  if sid is null then raise exception 'Connect your person before sharing here.' using errcode='P0002'; end if;
  if p_kind='game_activity' and length(clean_title) between 1 and 100 then
    insert into public.couple_activity_events(space_id,actor_id,event_type,summary) values(sid,uid,'game_activity','Started a shared round: '||clean_title) returning id into new_id;
  elsif p_kind='note' and length(clean_body) between 1 and 500 then
    insert into public.shared_love_notes(space_id,author_id,body) values(sid,uid,clean_body) returning id into new_id;
    insert into public.couple_activity_events(space_id,actor_id,event_type,summary) values(sid,uid,'love_note','Left a little love note');
  elsif p_kind='date' and length(clean_title) between 1 and 100 and p_date >= current_date then
    insert into public.shared_special_dates(space_id,created_by,title,occurs_on) values(sid,uid,clean_title,p_date) returning id into new_id;
    insert into public.couple_activity_events(space_id,actor_id,event_type,summary) values(sid,uid,'special_date','Added a special date: '||clean_title);
  elsif p_kind='memory' and length(clean_body) between 1 and 240 then
    insert into public.shared_memories(space_id,created_by,caption,remembered_on) values(sid,uid,clean_body,p_date) returning id into new_id;
    insert into public.couple_activity_events(space_id,actor_id,event_type,summary) values(sid,uid,'memory','Added a shared memory');
  else raise exception 'Please check the details and try again.' using errcode='22023';
  end if;
  return new_id;
end;
$$;
revoke all on function public.add_couple_dashboard_item(text,text,text,date) from public,anon;
grant execute on function public.add_couple_dashboard_item(text,text,text,date) to authenticated;

-- Remove every shared artifact atomically when either partner disconnects.
create or replace function public.disconnect_couple_space()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid; current_space uuid;
begin
  uid := public.assert_verified_couple_user();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select s.id into current_space from public.couple_spaces s join public.couple_members m on m.space_id=s.id
    where m.user_id=uid and m.membership_state='active' and s.status='connected' order by s.created_at desc limit 1 for update of s;
  if current_space is null then raise exception 'There is no connected space to disconnect.' using errcode='P0002'; end if;
  delete from public.shared_love_notes where space_id=current_space;
  delete from public.shared_special_dates where space_id=current_space;
  delete from public.shared_memories where space_id=current_space;
  delete from public.couple_activity_events where space_id=current_space;
  update public.couple_members set membership_state='disconnected',ended_at=now() where space_id=current_space and membership_state in ('active','accepted');
  update public.couple_spaces set status='disconnected',ended_at=now(),content_deleted_at=now() where id=current_space;
  insert into public.connection_events(space_id,actor_user_id,event_type,details) values(current_space,uid,'connection_disconnected','{"shared_content":"deleted_on_disconnect"}');
end;
$$;
revoke all on function public.disconnect_couple_space() from public,anon;
grant execute on function public.disconnect_couple_space() to authenticated;
