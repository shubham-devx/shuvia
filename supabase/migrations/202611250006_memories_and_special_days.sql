-- Phase 7: room-scoped scrapbook memories and recurring special days.
alter table public.shared_memories
  add column if not exists title text not null default 'A moment to remember' check (length(btrim(title)) between 1 and 120),
  add column if not exists photo_path text,
  add column if not exists updated_at timestamptz not null default now();
alter table public.shared_memories drop constraint if exists shared_memories_caption_check;
alter table public.shared_memories add constraint shared_memories_caption_check check(length(btrim(caption)) between 0 and 2000);
create index if not exists shared_memories_room_timeline_idx on public.shared_memories(space_id,remembered_on desc,created_at desc);

alter table public.shared_special_dates
  add column if not exists event_type text not null default 'custom' check(event_type in ('relationship_start','anniversary','birthday','custom')),
  add column if not exists repeats_yearly boolean not null default false,
  add column if not exists person_id uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
create unique index if not exists shared_special_dates_one_relationship_start on public.shared_special_dates(space_id) where event_type='relationship_start';
create index if not exists shared_special_dates_room_calendar_idx on public.shared_special_dates(space_id,occurs_on);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('shuvia-memories','shuvia-memories',false,8388608,array['image/webp','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['image/webp','image/jpeg','image/png'];

drop policy if exists "Active couple members can read memory photos" on storage.objects;
create policy "Active couple members can read memory photos" on storage.objects for select to authenticated using(
  case when bucket_id='shuvia-memories' and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.is_active_couple_member(split_part(name,'/',1)::uuid) else false end
);
drop policy if exists "Active couple members can upload memory photos" on storage.objects;
create policy "Active couple members can upload memory photos" on storage.objects for insert to authenticated with check(
  case when bucket_id='shuvia-memories' and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.is_active_couple_member(split_part(name,'/',1)::uuid) else false end
);
drop policy if exists "Active couple members can update memory photos" on storage.objects;
create policy "Active couple members can update memory photos" on storage.objects for update to authenticated using(
  case when bucket_id='shuvia-memories' and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.is_active_couple_member(split_part(name,'/',1)::uuid) else false end
) with check(case when bucket_id='shuvia-memories' and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.is_active_couple_member(split_part(name,'/',1)::uuid) else false end);
drop policy if exists "Active couple members can delete memory photos" on storage.objects;
create policy "Active couple members can delete memory photos" on storage.objects for delete to authenticated using(
  case when bucket_id='shuvia-memories' and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.is_active_couple_member(split_part(name,'/',1)::uuid) else false end
);

create or replace function public.consume_auth_rate_limit(
 p_bucket text,p_key text,p_max_requests integer,p_window_seconds integer
)
returns boolean language plpgsql security definer set search_path='' as $$
declare allowed boolean;
begin
 if p_bucket not in ('recovery-email','onboarding','couple-create','couple-regenerate','couple-code','game-start','love-note-send','surprise-send','memory-write')
  or length(p_key)<>64 or p_max_requests<1 or p_max_requests>20 or p_window_seconds<60 or p_window_seconds>604800 then return false; end if;
 insert into public.auth_rate_limits(bucket,key_hash,window_started_at,request_count) values(p_bucket,p_key,now(),1)
 on conflict(bucket,key_hash) do update set
  window_started_at=case when public.auth_rate_limits.window_started_at<now()-pg_catalog.make_interval(secs=>p_window_seconds) then now() else public.auth_rate_limits.window_started_at end,
  request_count=case when public.auth_rate_limits.window_started_at<now()-pg_catalog.make_interval(secs=>p_window_seconds) then 1 else public.auth_rate_limits.request_count+1 end
 returning request_count<=p_max_requests into allowed;
 delete from public.auth_rate_limits where window_started_at<now()-interval '1 day';
 return allowed;
end; $$;
revoke all on function public.consume_auth_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_auth_rate_limit(text,text,integer,integer) to service_role;

create or replace function public.get_couple_memories(p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; rows jsonb; mine text; partner text;
begin
 sid:=public.assert_shuvia_private_actor(p_actor_id);
 select full_name into mine from public.profiles where id=p_actor_id;
 select p.full_name into partner from public.couple_members m join public.profiles p on p.id=m.user_id
  where m.space_id=sid and m.user_id<>p_actor_id and m.membership_state='active' limit 1;
 select coalesce(jsonb_agg(x order by x.remembered_on desc,x.created_at desc),'[]'::jsonb) into rows from(
  select m.id,m.title,m.caption as description,m.remembered_on,m.photo_path,m.created_at,m.updated_at,m.created_by,p.full_name as contributor
  from public.shared_memories m join public.profiles p on p.id=m.created_by where m.space_id=sid
  order by m.remembered_on desc,m.created_at desc limit 300
 ) x;
 return jsonb_build_object('space_id',sid,'your_name',coalesce(mine,'You'),'partner_name',coalesce(partner,'Your person'),'memories',rows);
end; $$;
revoke all on function public.get_couple_memories(uuid) from public,anon,authenticated;
grant execute on function public.get_couple_memories(uuid) to service_role;

create or replace function public.create_couple_memory(p_actor_id uuid,p_memory_id uuid,p_title text,p_description text,p_date date,p_photo_path text)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid; new_id uuid;
begin
 sid:=public.assert_shuvia_private_actor(p_actor_id);
 perform 1 from public.couple_spaces where id=sid and status='connected' for update;
 if length(btrim(coalesce(p_title,''))) not between 1 and 120 or length(btrim(coalesce(p_description,'')))>2000 or p_date is null or p_date>current_date then raise exception 'Check the memory title, description, and date.' using errcode='22023'; end if;
 if p_photo_path is not null and (left(p_photo_path,length(sid::text)+1)<>sid::text||'/' or length(p_photo_path)>300) then raise exception 'This photo does not belong to your shared space.' using errcode='42501'; end if;
 insert into public.shared_memories(id,space_id,created_by,title,caption,remembered_on,photo_path)
 values(p_memory_id,sid,p_actor_id,btrim(p_title),btrim(coalesce(p_description,'')),p_date,p_photo_path) returning id into new_id;
 insert into public.couple_activity_events(space_id,actor_id,event_type,summary) values(sid,p_actor_id,'memory','Added a shared memory');
 return new_id;
end; $$;
revoke all on function public.create_couple_memory(uuid,uuid,text,text,date,text) from public,anon,authenticated;
grant execute on function public.create_couple_memory(uuid,uuid,text,text,date,text) to service_role;

create or replace function public.update_couple_memory(p_actor_id uuid,p_memory_id uuid,p_title text,p_description text,p_date date,p_photo_path text,p_replace_photo boolean)
returns text language plpgsql security definer set search_path='' as $$
declare sid uuid; previous_path text;
begin
 sid:=public.assert_shuvia_private_actor(p_actor_id);
 perform 1 from public.couple_spaces where id=sid and status='connected' for update;
 select photo_path into previous_path from public.shared_memories where id=p_memory_id and space_id=sid for update;
 if not found then raise exception 'That memory is no longer available.' using errcode='P0002'; end if;
 if length(btrim(coalesce(p_title,''))) not between 1 and 120 or length(btrim(coalesce(p_description,'')))>2000 or p_date is null or p_date>current_date then raise exception 'Check the memory title, description, and date.' using errcode='22023'; end if;
 if p_replace_photo and p_photo_path is not null and left(p_photo_path,length(sid::text)+1)<>sid::text||'/' then raise exception 'This photo does not belong to your shared space.' using errcode='42501'; end if;
 update public.shared_memories set title=btrim(p_title),caption=btrim(coalesce(p_description,'')),remembered_on=p_date,
  photo_path=case when p_replace_photo then p_photo_path else photo_path end,updated_at=now() where id=p_memory_id;
 insert into public.couple_activity_events(space_id,actor_id,event_type,summary) values(sid,p_actor_id,'memory','Updated a shared memory');
 return case when p_replace_photo then previous_path else null end;
end; $$;
revoke all on function public.update_couple_memory(uuid,uuid,text,text,date,text,boolean) from public,anon,authenticated;
grant execute on function public.update_couple_memory(uuid,uuid,text,text,date,text,boolean) to service_role;

create or replace function public.delete_couple_memory(p_actor_id uuid,p_memory_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare sid uuid; previous_path text;
begin
 sid:=public.assert_shuvia_private_actor(p_actor_id);
 perform 1 from public.couple_spaces where id=sid and status='connected' for update;
 delete from public.shared_memories where id=p_memory_id and space_id=sid returning photo_path into previous_path;
 if not found then raise exception 'That memory is no longer available.' using errcode='P0002'; end if;
 insert into public.couple_activity_events(space_id,actor_id,event_type,summary) values(sid,p_actor_id,'memory','Removed a shared memory');
 return previous_path;
end; $$;
revoke all on function public.delete_couple_memory(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_couple_memory(uuid,uuid) to service_role;

create or replace function public.get_couple_special_days(p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; rows jsonb; mine text; partner text;
begin
 sid:=public.assert_shuvia_private_actor(p_actor_id);
 select full_name into mine from public.profiles where id=p_actor_id;
 select p.full_name into partner from public.couple_members m join public.profiles p on p.id=m.user_id where m.space_id=sid and m.user_id<>p_actor_id and m.membership_state='active' limit 1;
 select coalesce(jsonb_agg(x order by x.occurs_on),'[]'::jsonb) into rows from(
  select d.id,d.event_type,d.title,d.occurs_on,d.repeats_yearly,d.person_id,case when d.person_id=p_actor_id then coalesce(mine,'You') when d.person_id is not null then coalesce(partner,'Your person') end as person_name,d.created_by
  from public.shared_special_dates d where d.space_id=sid
 ) x;
 return jsonb_build_object('space_id',sid,'your_name',coalesce(mine,'You'),'partner_name',coalesce(partner,'Your person'),'dates',rows);
end; $$;
revoke all on function public.get_couple_special_days(uuid) from public,anon,authenticated;
grant execute on function public.get_couple_special_days(uuid) to service_role;

create or replace function public.save_couple_special_day(p_actor_id uuid,p_id uuid,p_event_type text,p_title text,p_date date,p_repeats boolean,p_person_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid; new_id uuid;
begin
 sid:=public.assert_shuvia_private_actor(p_actor_id);
 perform 1 from public.couple_spaces where id=sid and status='connected' for update;
 if p_event_type not in ('relationship_start','anniversary','birthday','custom') or length(btrim(coalesce(p_title,''))) not between 1 and 100 or p_date is null then raise exception 'Add a name, date, and event type.' using errcode='22023'; end if;
 if p_event_type='relationship_start' and p_date>current_date then raise exception 'The relationship start date cannot be in the future.' using errcode='22023'; end if;
 if p_event_type in ('anniversary','custom') and not p_repeats and p_date<current_date then raise exception 'Choose a future date, or make this an annual reminder.' using errcode='22023'; end if;
 if p_event_type='birthday' and (p_person_id is null or not exists(select 1 from public.couple_members where space_id=sid and user_id=p_person_id and membership_state='active')) then raise exception 'Choose someone in your shared space for this birthday.' using errcode='22023'; end if;
 if p_event_type<>'birthday' and p_person_id is not null then raise exception 'Only birthdays have a person attached.' using errcode='22023'; end if;
 if p_event_type='birthday' and not p_repeats then raise exception 'Birthdays repeat every year.' using errcode='22023'; end if;
 if p_id is not null then
   update public.shared_special_dates set event_type=p_event_type,title=btrim(p_title),occurs_on=p_date,repeats_yearly=p_repeats,person_id=p_person_id,updated_at=now()
    where id=p_id and space_id=sid returning id into new_id;
   if new_id is null then raise exception 'That special day is no longer available.' using errcode='P0002'; end if;
 elsif p_event_type='relationship_start' then
   insert into public.shared_special_dates(space_id,created_by,event_type,title,occurs_on,repeats_yearly,person_id)
   values(sid,p_actor_id,p_event_type,btrim(p_title),p_date,false,null)
   on conflict(space_id) where event_type='relationship_start' do update set title=excluded.title,occurs_on=excluded.occurs_on,updated_at=now()
   returning id into new_id;
 else
   insert into public.shared_special_dates(space_id,created_by,event_type,title,occurs_on,repeats_yearly,person_id)
   values(sid,p_actor_id,p_event_type,btrim(p_title),p_date,p_repeats,p_person_id) returning id into new_id;
 end if;
 insert into public.couple_activity_events(space_id,actor_id,event_type,summary) values(sid,p_actor_id,'special_date',case when p_event_type='birthday' then 'Added a birthday reminder' else 'Added a special day' end);
 return new_id;
end; $$;
revoke all on function public.save_couple_special_day(uuid,uuid,text,text,date,boolean,uuid) from public,anon,authenticated;
grant execute on function public.save_couple_special_day(uuid,uuid,text,text,date,boolean,uuid) to service_role;

create or replace function public.delete_couple_special_day(p_actor_id uuid,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 sid:=public.assert_shuvia_private_actor(p_actor_id);
 perform 1 from public.couple_spaces where id=sid and status='connected' for update;
 delete from public.shared_special_dates where id=p_id and space_id=sid;
 if not found then raise exception 'That special day is no longer available.' using errcode='P0002'; end if;
 insert into public.couple_activity_events(space_id,actor_id,event_type,summary) values(sid,p_actor_id,'special_date','Removed a special day');
end; $$;
revoke all on function public.delete_couple_special_day(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_couple_special_day(uuid,uuid) to service_role;
