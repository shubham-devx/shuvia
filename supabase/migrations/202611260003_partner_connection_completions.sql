-- Complete the existing partner flow without replacing its tables or users.
-- Invite secrets remain hashed; consent remains an explicit authenticated RPC.

alter table public.invitations drop constraint if exists invitations_status_check;
alter table public.invitations add constraint invitations_status_check
  check (status in ('pending','accepted','declined','expired','cancelled'));
alter table public.invitations add column if not exists declined_by uuid references auth.users(id) on delete set null;
alter table public.couple_spaces drop constraint if exists couple_spaces_status_check;
alter table public.couple_spaces add constraint couple_spaces_status_check
  check (status in ('waiting_for_partner','invitation_sent','invitation_accepted','invitation_declined','connected','invitation_expired','connection_cancelled','disconnected'));
alter table public.couple_spaces drop constraint if exists couple_spaces_content_policy_check;
alter table public.couple_spaces add constraint couple_spaces_content_policy_check
  check (content_policy in ('delete_on_disconnect','retain_on_disconnect'));
alter table public.couple_spaces alter column content_policy set default 'retain_on_disconnect';
update public.couple_spaces set content_policy = 'retain_on_disconnect' where content_policy = 'delete_on_disconnect';

alter table public.couple_spaces add column if not exists relationship_code text;
create unique index if not exists couple_spaces_relationship_code_key
  on public.couple_spaces(relationship_code) where relationship_code is not null;

create or replace function public.assign_relationship_code()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'connected' and new.relationship_code is null then
    new.relationship_code := 'SH-' || upper(pg_catalog.substr(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 12));
  end if;
  return new;
end;
$$;
drop trigger if exists couple_spaces_relationship_code on public.couple_spaces;
create trigger couple_spaces_relationship_code before insert or update of status on public.couple_spaces
  for each row execute function public.assign_relationship_code();
update public.couple_spaces set relationship_code = 'SH-' || upper(pg_catalog.substr(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 12))
  where status = 'connected' and relationship_code is null;

create or replace function public.get_my_relationship_code()
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; code text;
begin
  uid := public.assert_verified_couple_user();
  select s.relationship_code into code from public.couple_spaces s
    join public.couple_members m on m.space_id = s.id
    where m.user_id = uid and m.membership_state = 'active' and s.status = 'connected'
    order by s.created_at desc limit 1;
  return code;
end;
$$;
revoke all on function public.get_my_relationship_code() from public, anon;
grant execute on function public.get_my_relationship_code() to authenticated;

-- Invitations expire after 24 hours, including regenerated invitations.
create or replace function public.create_couple_space(p_token_hash text, p_code_hash text, p_owner_consents boolean)
returns table(invitation_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid; new_space uuid; expires timestamptz := now() + interval '24 hours';
begin
  uid := public.assert_verified_couple_user();
  if p_owner_consents is distinct from true then raise exception 'Consent to the room policy is required.' using errcode = '22023'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_code_hash !~ '^[0-9a-f]{64}$' then raise exception 'Could not create that invitation.' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if exists (select 1 from public.couple_members m where m.user_id = uid and m.membership_state in ('active','accepted')) then
    raise exception 'You already have an active couple space.' using errcode = '23505';
  end if;
  insert into public.couple_spaces(owner_user_id,status,owner_consented_at) values (uid,'waiting_for_partner',now()) returning id into new_space;
  insert into public.couple_members(space_id,user_id,role,membership_state,consented_at) values (new_space,uid,'owner','active',now());
  insert into public.invitations(space_id,inviter_user_id,token_hash,code_hash,expires_at) values (new_space,uid,p_token_hash,p_code_hash,expires);
  update public.couple_spaces set status = 'invitation_sent' where id = new_space;
  insert into public.connection_events(space_id,actor_user_id,event_type,details)
    values (new_space,uid,'space_created','{"owner_consent":true,"content_policy":"retain_on_disconnect"}'),
           (new_space,uid,'invitation_sent',jsonb_build_object('expires_at',expires));
  return query select expires;
end;
$$;
revoke all on function public.create_couple_space(text,text,boolean) from public, anon;
grant execute on function public.create_couple_space(text,text,boolean) to authenticated;

create or replace function public.regenerate_couple_invitation(p_token_hash text, p_code_hash text)
returns table(invitation_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid; current_space uuid; expires timestamptz := now() + interval '24 hours';
begin
  uid := public.assert_verified_couple_user();
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_code_hash !~ '^[0-9a-f]{64}$' then raise exception 'Could not regenerate that invitation.' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select s.id into current_space from public.couple_spaces s
    where s.owner_user_id = uid and s.status in ('waiting_for_partner','invitation_sent','invitation_declined','invitation_expired')
    order by s.created_at desc limit 1 for update;
  if current_space is null then raise exception 'There is no invitation to regenerate.' using errcode = 'P0002'; end if;
  update public.invitations set status = 'cancelled' where space_id = current_space and status = 'pending';
  insert into public.invitations(space_id,inviter_user_id,token_hash,code_hash,expires_at)
    values (current_space,uid,p_token_hash,p_code_hash,expires);
  update public.couple_spaces set status = 'invitation_sent', ended_at = null where id = current_space;
  insert into public.connection_events(space_id,actor_user_id,event_type,details)
    values (current_space,uid,'invitation_regenerated',jsonb_build_object('expires_at',expires));
  return query select expires;
end;
$$;
revoke all on function public.regenerate_couple_invitation(text,text) from public, anon;
grant execute on function public.regenerate_couple_invitation(text,text) to authenticated;

create or replace function public.decline_couple_invitation(p_token_hash text default null, p_code_hash text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; invitation_id uuid; current_space uuid; inviter uuid; declined_user uuid; invitation_state text; expiry timestamptz;
begin
  uid := public.assert_verified_couple_user();
  if (p_token_hash is null) = (p_code_hash is null)
     or (p_token_hash is not null and p_token_hash !~ '^[0-9a-f]{64}$')
     or (p_code_hash is not null and p_code_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invitation is unavailable.' using errcode = '22023';
  end if;
  select i.id,i.space_id into invitation_id,current_space from public.invitations i
    where (p_token_hash is not null and i.token_hash = p_token_hash)
       or (p_code_hash is not null and i.code_hash = p_code_hash);
  if invitation_id is null then raise exception 'This invitation is unavailable.' using errcode = 'P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  perform 1 from public.couple_spaces s where s.id = current_space for update;
  select i.inviter_user_id,i.status,i.expires_at,i.declined_by into inviter,invitation_state,expiry,declined_user
    from public.invitations i where i.id = invitation_id for update;
  if inviter = uid then raise exception 'You cannot decline your own invitation.' using errcode = '22023'; end if;
  if invitation_state = 'declined' and declined_user = uid then return 'declined'; end if;
  perform public.expire_couple_invitation(current_space);
  if invitation_state <> 'pending' or expiry <= now() then raise exception 'This invitation is no longer active.' using errcode = '23505'; end if;
  update public.invitations set status = 'declined',declined_by = uid where id = invitation_id;
  update public.couple_spaces set status = 'invitation_declined' where id = current_space and status = 'invitation_sent';
  insert into public.connection_events(space_id,actor_user_id,event_type,details)
    values (current_space,uid,'invitation_cancelled','{"recipient_declined":true}');
  return 'declined';
end;
$$;
revoke all on function public.decline_couple_invitation(text,text) from public, anon;
grant execute on function public.decline_couple_invitation(text,text) to authenticated;

-- Return only the inviter's name and private avatar object key; the app signs
-- that key for display and never exposes invitation or account secrets.
drop function public.preview_couple_invitation(text,text);
create function public.preview_couple_invitation(p_token_hash text default null, p_code_hash text default null)
returns table(invitation_status text, space_status text, inviter_first_name text, expires_at timestamptz, inviter_avatar_path text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid; invitation_id uuid; v_space_id uuid; inviter uuid; invitation_state text; room_state text;
  expiry timestamptz; inviter_name text; avatar_path text;
begin
  uid := public.assert_verified_couple_user();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if (p_token_hash is null) = (p_code_hash is null)
     or (p_token_hash is not null and p_token_hash !~ '^[0-9a-f]{64}$')
     or (p_code_hash is not null and p_code_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invitation is unavailable.' using errcode = '22023';
  end if;
  select i.id,i.space_id into invitation_id,v_space_id from public.invitations i
    where (p_token_hash is not null and i.token_hash = p_token_hash)
       or (p_code_hash is not null and i.code_hash = p_code_hash);
  if invitation_id is null then return; end if;
  perform 1 from public.couple_spaces s where s.id = v_space_id for update;
  select i.inviter_user_id,i.status,i.expires_at,p.full_name,p.avatar_url
    into inviter,invitation_state,expiry,inviter_name,avatar_path
    from public.invitations i join public.profiles p on p.id = i.inviter_user_id
    where i.id = invitation_id for update of i;
  select s.status into room_state from public.couple_spaces s where s.id = v_space_id;
  perform public.expire_couple_invitation(v_space_id);
  select i.status,s.status,i.expires_at into invitation_state,room_state,expiry
    from public.invitations i join public.couple_spaces s on s.id = i.space_id where i.id = invitation_id;
  if inviter = uid then invitation_state := 'self'; end if;
  if inviter <> uid and exists (select 1 from public.couple_members m
      where m.user_id = uid and m.space_id <> v_space_id and m.membership_state in ('active','accepted')) then
    return query select 'already_connected'::text,room_state,null::text,expiry,null::text;
    return;
  end if;
  return query select invitation_state,room_state,
    case when invitation_state in ('pending','accepted') then coalesce(nullif(pg_catalog.split_part(pg_catalog.btrim(inviter_name),' ',1),''),'Someone special') else null end,
    expiry,case when invitation_state in ('pending','accepted') then avatar_path else null end;
end;
$$;
revoke all on function public.preview_couple_invitation(text,text) from public, anon;
grant execute on function public.preview_couple_invitation(text,text) to authenticated;

-- A repeated acceptance by the same recipient returns the established result.
create or replace function public.accept_couple_invitation(p_token_hash text default null, p_code_hash text default null, p_partner_consents boolean default false)
returns table(space_status text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid; invitation_id uuid; current_space uuid; inviter uuid; invite_state text;
  room_state text; expiry timestamptz; recipient uuid;
begin
  uid := public.assert_verified_couple_user();
  if p_partner_consents is distinct from true then raise exception 'Consent to the room policy is required.' using errcode = '22023'; end if;
  if (p_token_hash is null) = (p_code_hash is null)
     or (p_token_hash is not null and p_token_hash !~ '^[0-9a-f]{64}$')
     or (p_code_hash is not null and p_code_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invitation is unavailable.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select i.id,i.space_id into invitation_id,current_space from public.invitations i
    where (p_token_hash is not null and i.token_hash = p_token_hash)
       or (p_code_hash is not null and i.code_hash = p_code_hash);
  if invitation_id is null then raise exception 'This invitation is unavailable.' using errcode = 'P0002'; end if;
  perform 1 from public.couple_spaces s where s.id = current_space for update;
  select i.inviter_user_id,i.status,i.expires_at,i.accepted_by
    into inviter,invite_state,expiry,recipient from public.invitations i where i.id = invitation_id for update;
  select s.status into room_state from public.couple_spaces s where s.id = current_space;
  if inviter = uid then raise exception 'You cannot accept your own invitation.' using errcode = '22023'; end if;
  if invite_state = 'accepted' and recipient = uid then return query select room_state; return; end if;
  perform public.expire_couple_invitation(current_space);
  select i.status,s.status,i.expires_at into invite_state,room_state,expiry
    from public.invitations i join public.couple_spaces s on s.id=i.space_id where i.id=invitation_id;
  if invite_state = 'expired' or expiry <= now() then return query select 'invitation_expired'::text; return; end if;
  if invite_state <> 'pending' or room_state <> 'invitation_sent' then raise exception 'This invitation has already been used or cancelled.' using errcode = '23505'; end if;
  if exists (select 1 from public.couple_members m where m.user_id=uid and m.membership_state in ('active','accepted')) then
    raise exception 'End your current couple connection before joining another.' using errcode = '23505';
  end if;
  insert into public.couple_members(space_id,user_id,role,membership_state,consented_at)
    values(current_space,uid,'partner','active',now());
  update public.invitations set status='accepted',accepted_by=uid,accepted_at=now() where id=invitation_id;
  update public.couple_spaces set status='connected' where id=current_space;
  insert into public.connection_events(space_id,actor_user_id,event_type,details)
    values(current_space,uid,'invitation_accepted','{"partner_consent":true,"content_policy":"retain_on_disconnect"}'),
          (current_space,uid,'connection_confirmed','{"owner_confirmation":false,"owner_consented_at_invitation":true,"automatic_after_partner_acceptance":true}');
  return query select 'connected'::text;
end;
$$;
revoke all on function public.accept_couple_invitation(text,text,boolean) from public,anon;
grant execute on function public.accept_couple_invitation(text,text,boolean) to authenticated;

-- Preserve shared memories, notes, dates, and activity when a relationship ends.
-- Their existing connected-membership checks make the archived data inaccessible
-- to former members while retaining it for an explicit retention/export policy.
create or replace function public.disconnect_couple_space()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid; current_space uuid;
begin
  uid := public.assert_verified_couple_user();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select s.id into current_space from public.couple_spaces s join public.couple_members m on m.space_id=s.id
    where m.user_id=uid and m.membership_state='active' and s.status='connected'
    order by s.created_at desc limit 1 for update of s;
  if current_space is null then raise exception 'There is no connected space to disconnect.' using errcode='P0002'; end if;
  update public.couple_members set membership_state='disconnected',ended_at=now()
    where space_id=current_space and membership_state in ('active','accepted');
  update public.couple_spaces set status='disconnected',ended_at=now() where id=current_space;
  insert into public.connection_events(space_id,actor_user_id,event_type,details)
    values(current_space,uid,'connection_disconnected','{"shared_content":"retained_inaccessible"}');
end;
$$;
revoke all on function public.disconnect_couple_space() from public,anon;
grant execute on function public.disconnect_couple_space() to authenticated;

notify pgrst, 'reload schema';
