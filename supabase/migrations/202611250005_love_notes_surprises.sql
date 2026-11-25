-- Phase 6: recipient-gated letters, couple surprises and in-app notifications.
create table if not exists public.love_notes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  template_id text not null check (template_id in ('postcard','pressed-flower','afterglow','little-letter')),
  title text not null check (length(btrim(title)) between 1 and 100),
  body text not null check (length(btrim(body)) between 1 and 5000),
  scheduled_reveal_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  unique (space_id,sender_id,client_request_id)
);
create index if not exists love_notes_recipient_schedule_idx on public.love_notes(recipient_id,scheduled_reveal_at desc,created_at desc);
create index if not exists love_notes_sender_created_idx on public.love_notes(sender_id,created_at desc);

create table if not exists public.love_note_user_states (
  note_id uuid not null references public.love_notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  is_favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (note_id,user_id)
);

create table if not exists public.couple_surprise_events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('wheel','daily','compliment','hug','kiss','challenge','date_idea','conversation')),
  event_key text not null check (length(event_key) between 1 and 100),
  result_category text not null check (result_category in ('compliment','romantic-task','funny-challenge','date-idea','memory-question','sweet-question','daily-surprise','virtual-hug','virtual-kiss')),
  result_text text not null check (length(btrim(result_text)) between 1 and 500),
  created_at timestamptz not null default now(),
  check (actor_id <> recipient_id),
  unique (space_id,kind,event_key)
);
create index if not exists couple_surprise_events_recent_idx on public.couple_surprise_events(space_id,created_at desc);

create table if not exists public.shuvia_notifications (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('love_note','surprise')),
  source_id uuid not null,
  summary text not null check (length(summary) between 1 and 160),
  target_path text not null check (target_path in ('/notes','/surprises')),
  available_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id,notification_type,source_id)
);
create index if not exists shuvia_notifications_inbox_idx on public.shuvia_notifications(user_id,available_at desc,read_at);

alter table public.love_notes enable row level security;
alter table public.love_note_user_states enable row level security;
alter table public.couple_surprise_events enable row level security;
alter table public.shuvia_notifications enable row level security;

create policy "Love note recipients can read released letters" on public.love_notes for select to authenticated using (
  recipient_id=(select auth.uid()) and scheduled_reveal_at<=now() and public.is_active_couple_member(space_id)
);
create policy "Users can read their own letter state" on public.love_note_user_states for select to authenticated using (user_id=(select auth.uid()));
create policy "Users can read their own available notifications" on public.shuvia_notifications for select to authenticated using (user_id=(select auth.uid()) and available_at<=now());

revoke all on public.love_notes,public.love_note_user_states,public.couple_surprise_events,public.shuvia_notifications from public,anon,authenticated;
grant all on public.love_notes,public.love_note_user_states,public.couple_surprise_events,public.shuvia_notifications to service_role;

alter table public.couple_activity_events drop constraint if exists couple_activity_events_event_type_check;
alter table public.couple_activity_events add constraint couple_activity_events_event_type_check
  check (event_type in ('love_note','special_date','memory','game_activity','surprise'));

-- Clients receive only a private, content-free Realtime broadcast and reload via authorized RPC.

create or replace function public.consume_auth_rate_limit(
  p_bucket text,p_key text,p_max_requests integer,p_window_seconds integer
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare allowed boolean;
begin
  if p_bucket not in ('recovery-email','onboarding','couple-create','couple-regenerate','couple-code','game-start','love-note-send','surprise-send')
     or length(p_key) <> 64 or p_max_requests < 1 or p_max_requests > 20
     or p_window_seconds < 60 or p_window_seconds > 604800 then return false; end if;
  insert into public.auth_rate_limits(bucket,key_hash,window_started_at,request_count) values(p_bucket,p_key,now(),1)
  on conflict (bucket,key_hash) do update set
    window_started_at=case when public.auth_rate_limits.window_started_at < now()-pg_catalog.make_interval(secs=>p_window_seconds) then now() else public.auth_rate_limits.window_started_at end,
    request_count=case when public.auth_rate_limits.window_started_at < now()-pg_catalog.make_interval(secs=>p_window_seconds) then 1 else public.auth_rate_limits.request_count+1 end
  returning request_count <= p_max_requests into allowed;
  delete from public.auth_rate_limits where window_started_at < now()-interval '1 day';
  return allowed;
end;
$$;
revoke all on function public.consume_auth_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_auth_rate_limit(text,text,integer,integer) to service_role;

create or replace function public.assert_shuvia_private_actor(p_actor_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sid uuid; confirmed boolean; onboarded boolean;
begin
  if p_actor_id is null then raise exception 'Sign in to continue.' using errcode='42501'; end if;
  select u.email_confirmed_at is not null into confirmed from auth.users u where u.id=p_actor_id;
  select p.onboarding_completed into onboarded from public.profiles p where p.id=p_actor_id;
  if confirmed is distinct from true then raise exception 'Verify your email before using this feature.' using errcode='42501'; end if;
  if onboarded is distinct from true then raise exception 'Finish onboarding before using this feature.' using errcode='42501'; end if;
  select s.id into sid from public.couple_spaces s join public.couple_members m on m.space_id=s.id
    where m.user_id=p_actor_id and m.membership_state='active' and s.status='connected' limit 1;
  if sid is null then raise exception 'Connect your person before using this feature.' using errcode='42501'; end if;
  return sid;
end;
$$;
revoke all on function public.assert_shuvia_private_actor(uuid) from public,anon,authenticated;
grant execute on function public.assert_shuvia_private_actor(uuid) to service_role;

create or replace function public.send_love_note(p_actor_id uuid,p_request_id uuid,p_template_id text,p_title text,p_body text,p_reveal_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sid uuid; partner uuid; note_id uuid; prior_reveal timestamptz; reveal timestamptz := coalesce(p_reveal_at,now());
begin
  sid := public.assert_shuvia_private_actor(p_actor_id);
  perform 1 from public.couple_spaces s where s.id=sid for update;
  if p_template_id not in ('postcard','pressed-flower','afterglow','little-letter') then raise exception 'Choose a letter style.' using errcode='22023'; end if;
  if length(btrim(coalesce(p_title,''))) not between 1 and 100 or length(btrim(coalesce(p_body,''))) not between 1 and 5000 then raise exception 'Add a title and a letter of up to 5,000 characters.' using errcode='22023'; end if;
  if reveal < now()-interval '10 seconds' or reveal > now()+interval '30 days' then raise exception 'Choose a reveal time from now to 30 days from now.' using errcode='22023'; end if;
  select n.id,n.scheduled_reveal_at into note_id,prior_reveal from public.love_notes n where n.space_id=sid and n.sender_id=p_actor_id and n.client_request_id=p_request_id;
  if found then return jsonb_build_object('id',note_id,'scheduled_reveal_at',prior_reveal); end if;
  select m.user_id into partner from public.couple_members m where m.space_id=sid and m.user_id<>p_actor_id and m.membership_state='active' limit 1;
  if partner is null then raise exception 'Your person is not connected to this space.' using errcode='42501'; end if;
  insert into public.love_notes(space_id,sender_id,recipient_id,client_request_id,template_id,title,body,scheduled_reveal_at)
    values(sid,p_actor_id,partner,p_request_id,p_template_id,btrim(p_title),btrim(p_body),reveal) returning id into note_id;
  insert into public.love_note_user_states(note_id,user_id) values(note_id,p_actor_id),(note_id,partner);
  insert into public.shuvia_notifications(space_id,user_id,notification_type,source_id,summary,target_path,available_at)
    values(sid,partner,'love_note',note_id,'Your person left you a little letter.','/notes',reveal);
  insert into public.couple_activity_events(space_id,actor_id,event_type,summary)
    values(sid,p_actor_id,'love_note','A little love letter is on its way');
  return jsonb_build_object('id',note_id,'scheduled_reveal_at',reveal);
end;
$$;
revoke all on function public.send_love_note(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.send_love_note(uuid,uuid,text,text,text,timestamptz) to service_role;

create or replace function public.get_couple_love_notes(p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sid uuid; partner uuid; my_name text; partner_name text; received jsonb; sent jsonb; notices jsonb; next_reveal timestamptz;
begin
  sid := public.assert_shuvia_private_actor(p_actor_id);
  select m.user_id,p.full_name into partner,partner_name from public.couple_members m join public.profiles p on p.id=m.user_id
    where m.space_id=sid and m.user_id<>p_actor_id and m.membership_state='active' limit 1;
  select full_name into my_name from public.profiles where id=p_actor_id;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into received from (
    select n.id,n.template_id,case when n.scheduled_reveal_at<=now() then n.title else 'A little letter is on its way' end as title,
      case when n.scheduled_reveal_at<=now() then n.body else null end as body,n.scheduled_reveal_at,n.created_at,
      coalesce(st.read_at is not null,false) as is_read,coalesce(st.is_favorite,false) as is_favorite,
      case when n.scheduled_reveal_at<=now() then p.full_name else null end as sender_name
    from public.love_notes n left join public.love_note_user_states st on st.note_id=n.id and st.user_id=p_actor_id
      join public.profiles p on p.id=n.sender_id where n.space_id=sid and n.recipient_id=p_actor_id
    order by n.created_at desc limit 40
  ) x;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into sent from (
    select n.id,n.template_id,'Sent with love'::text as title,null::text as body,n.scheduled_reveal_at,n.created_at,st.read_at is not null as is_read,false as is_favorite,null::text as sender_name
    from public.love_notes n left join public.love_note_user_states st on st.note_id=n.id and st.user_id=n.recipient_id
    where n.space_id=sid and n.sender_id=p_actor_id order by n.created_at desc limit 40
  ) x;
  select min(n.scheduled_reveal_at) into next_reveal from public.love_notes n where n.space_id=sid and n.recipient_id=p_actor_id and n.scheduled_reveal_at>now();
  select coalesce(jsonb_agg(q.item order by q.created_at desc),'[]'::jsonb) into notices from (
    select jsonb_build_object('id',n.id,'notification_type',n.notification_type,'summary',n.summary,'target_path',n.target_path,'created_at',n.created_at) as item,n.created_at
    from public.shuvia_notifications n where n.space_id=sid and n.user_id=p_actor_id and n.available_at<=now() and n.read_at is null order by n.created_at desc limit 10
  ) q;
  return jsonb_build_object('space_id',sid,'user_id',p_actor_id,'your_name',coalesce(my_name,'You'),'partner_name',coalesce(partner_name,'Your person'),
    'received',received,'sent',sent,'next_reveal_at',next_reveal,'notifications',notices);
end;
$$;
revoke all on function public.get_couple_love_notes(uuid) from public,anon,authenticated;
grant execute on function public.get_couple_love_notes(uuid) to service_role;

create or replace function public.mark_love_note_read(p_actor_id uuid,p_note_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sid uuid; note public.love_notes%rowtype;
begin
  sid := public.assert_shuvia_private_actor(p_actor_id);
  select * into note from public.love_notes n where n.id=p_note_id and n.space_id=sid and n.recipient_id=p_actor_id for update;
  if not found then raise exception 'This letter is not available to your account.' using errcode='P0002'; end if;
  if note.scheduled_reveal_at>now() then raise exception 'This letter is not ready to open yet.' using errcode='42501'; end if;
  update public.love_note_user_states set read_at=coalesce(read_at,now()),updated_at=now() where note_id=p_note_id and user_id=p_actor_id;
  update public.shuvia_notifications set read_at=coalesce(read_at,now()) where user_id=p_actor_id and notification_type='love_note' and source_id=p_note_id;
  return jsonb_build_object('id',note.id,'title',note.title,'body',note.body,'template_id',note.template_id,'sender_name',(select p.full_name from public.profiles p where p.id=note.sender_id));
end;
$$;
revoke all on function public.mark_love_note_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mark_love_note_read(uuid,uuid) to service_role;

create or replace function public.toggle_love_note_favorite(p_actor_id uuid,p_note_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare sid uuid; current_value boolean;
begin
  sid := public.assert_shuvia_private_actor(p_actor_id);
  if not exists(select 1 from public.love_notes n where n.id=p_note_id and n.space_id=sid and n.recipient_id=p_actor_id and n.scheduled_reveal_at<=now()) then
    raise exception 'This letter is not available to your account.' using errcode='P0002';
  end if;
  update public.love_note_user_states set is_favorite=not is_favorite,updated_at=now() where note_id=p_note_id and user_id=p_actor_id returning is_favorite into current_value;
  return coalesce(current_value,false);
end;
$$;
revoke all on function public.toggle_love_note_favorite(uuid,uuid) from public,anon,authenticated;
grant execute on function public.toggle_love_note_favorite(uuid,uuid) to service_role;

create or replace function public.create_couple_surprise(p_actor_id uuid,p_kind text,p_event_key text,p_result_category text,p_result_text text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sid uuid; partner uuid; existing public.couple_surprise_events%rowtype; new_id uuid;
begin
  sid := public.assert_shuvia_private_actor(p_actor_id);
  perform 1 from public.couple_spaces s where s.id=sid for update;
  if p_kind not in ('wheel','daily','compliment','hug','kiss','challenge','date_idea','conversation') then raise exception 'Choose a surprise from the Shuvia collection.' using errcode='22023'; end if;
  if length(coalesce(p_event_key,'')) not between 1 and 100 or length(btrim(coalesce(p_result_text,''))) not between 1 and 500 then raise exception 'This surprise is not available.' using errcode='22023'; end if;
  select m.user_id into partner from public.couple_members m where m.space_id=sid and m.user_id<>p_actor_id and m.membership_state='active' limit 1;
  if partner is null then raise exception 'Your person is not connected to this space.' using errcode='42501'; end if;
  select * into existing from public.couple_surprise_events e where e.space_id=sid and e.kind=p_kind and e.event_key=p_event_key;
  if found then return to_jsonb(existing); end if;
  if p_kind='wheel' then
    select * into existing from public.couple_surprise_events e where e.space_id=sid and e.kind='wheel' and e.created_at>now()-interval '10 seconds' order by e.created_at desc limit 1;
    if found then return to_jsonb(existing); end if;
  end if;
  insert into public.couple_surprise_events(space_id,actor_id,recipient_id,kind,event_key,result_category,result_text)
    values(sid,p_actor_id,partner,p_kind,p_event_key,p_result_category,p_result_text) returning id into new_id;
  insert into public.shuvia_notifications(space_id,user_id,notification_type,source_id,summary,target_path)
    values(sid,partner,'surprise',new_id,case p_kind when 'hug' then 'Your person sent you a virtual hug.' when 'kiss' then 'Your person sent you a virtual kiss.' else 'Your person left you a small surprise.' end,'/surprises');
  insert into public.couple_activity_events(space_id,actor_id,event_type,summary)
    values(sid,p_actor_id,'surprise',case p_kind when 'hug' then 'A virtual hug arrived' when 'kiss' then 'A virtual kiss arrived' else 'A small surprise arrived' end);
  return (select to_jsonb(e) from public.couple_surprise_events e where e.id=new_id);
end;
$$;
revoke all on function public.create_couple_surprise(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_couple_surprise(uuid,text,text,text,text) to service_role;

create or replace function public.get_couple_surprise_room(p_actor_id uuid,p_today_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sid uuid; daily jsonb; events jsonb; notifications jsonb;
begin
  sid := public.assert_shuvia_private_actor(p_actor_id);
  select jsonb_build_object('id',e.id,'kind',e.kind,'result_category',e.result_category,'result_text',e.result_text,'created_at',e.created_at)
    into daily from public.couple_surprise_events e where e.space_id=sid and e.kind='daily' and e.event_key=p_today_key limit 1;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into events from (
    select e.id,e.kind,e.result_category,e.result_text,e.created_at,p.full_name as actor_name from public.couple_surprise_events e
      join public.profiles p on p.id=e.actor_id where e.space_id=sid order by e.created_at desc limit 20
  ) x;
  select coalesce(jsonb_agg(q.item order by q.created_at desc),'[]'::jsonb) into notifications from (
    select jsonb_build_object('id',n.id,'summary',n.summary,'target_path',n.target_path,'created_at',n.created_at) as item,n.created_at
    from public.shuvia_notifications n where n.space_id=sid and n.user_id=p_actor_id and n.notification_type='surprise' and n.available_at<=now() and n.read_at is null order by n.created_at desc limit 10
  ) q;
  return jsonb_build_object('space_id',sid,'daily',daily,'events',events,'notifications',notifications);
end;
$$;
revoke all on function public.get_couple_surprise_room(uuid,text) from public,anon,authenticated;
grant execute on function public.get_couple_surprise_room(uuid,text) to service_role;

create or replace function public.mark_shuvia_notification_read(p_actor_id uuid,p_notification_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  sid := public.assert_shuvia_private_actor(p_actor_id);
  update public.shuvia_notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and space_id=sid and user_id=p_actor_id and available_at<=now();
  if not found then raise exception 'This notification is not available.' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.mark_shuvia_notification_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mark_shuvia_notification_read(uuid,uuid) to service_role;

-- Remove letters, surprise results, and notifications in the same disconnect transaction.
create or replace function public.delete_private_content_on_disconnect()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='disconnected' and old.status is distinct from 'disconnected' then
    delete from public.shuvia_notifications where space_id=new.id;
    delete from public.love_note_user_states s using public.love_notes n where s.note_id=n.id and n.space_id=new.id;
    delete from public.love_notes where space_id=new.id;
    delete from public.couple_surprise_events where space_id=new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists delete_private_content_on_disconnect on public.couple_spaces;
create trigger delete_private_content_on_disconnect after update of status on public.couple_spaces
  for each row execute function public.delete_private_content_on_disconnect();
revoke all on function public.delete_private_content_on_disconnect() from public,anon,authenticated;
