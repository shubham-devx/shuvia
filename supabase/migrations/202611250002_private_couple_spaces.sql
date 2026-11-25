-- Phase 3 stores connection metadata only. There are no shared-content tables;
-- future room content must be deleted in the disconnect transaction.
create table if not exists public.couple_spaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting_for_partner'
    check (status in ('waiting_for_partner','invitation_sent','invitation_accepted','connected','invitation_expired','connection_cancelled','disconnected')),
  owner_consented_at timestamptz not null default now(),
  content_policy text not null default 'delete_on_disconnect' check (content_policy = 'delete_on_disconnect'),
  content_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.couple_members (
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','partner')),
  membership_state text not null check (membership_state in ('active','accepted','cancelled','disconnected')),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  primary key (space_id, user_id),
  unique (space_id, role)
);
create unique index if not exists couple_members_one_open_space_per_user
  on public.couple_members(user_id) where membership_state in ('active','accepted');

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending','accepted','expired','cancelled')),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invitations_space_pending_idx on public.invitations(space_id,status,expires_at desc);

create table if not exists public.connection_events (
  id bigint generated always as identity primary key,
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('space_created','invitation_sent','invitation_regenerated','invitation_accepted','connection_confirmed','invitation_cancelled','invitation_expired','connection_disconnected')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists connection_events_space_created_idx on public.connection_events(space_id,created_at desc);

alter table public.couple_spaces enable row level security;
alter table public.couple_members enable row level security;
alter table public.invitations enable row level security;
alter table public.connection_events enable row level security;

drop policy if exists "Couple participants can read their space" on public.couple_spaces;
create policy "Couple participants can read their space" on public.couple_spaces for select to authenticated using (
  exists (select 1 from public.couple_members m where m.space_id = id and m.user_id = (select auth.uid()))
);
drop policy if exists "Couple participants can read membership rows" on public.couple_members;
drop policy if exists "Users can read their own membership row" on public.couple_members;
create policy "Users can read their own membership row" on public.couple_members for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Couple participants can read connection events" on public.connection_events;
create policy "Couple participants can read connection events" on public.connection_events for select to authenticated using (
  exists (select 1 from public.couple_members m where m.space_id = connection_events.space_id and m.user_id = (select auth.uid()))
);
-- Invitation rows and all mutation access stay behind narrow, authenticated RPCs.
revoke all on public.couple_spaces, public.couple_members, public.invitations, public.connection_events from anon, authenticated;

create or replace function public.assert_verified_couple_user()
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); confirmed boolean; onboarded boolean;
begin
  if uid is null then raise exception 'Log in to continue.' using errcode = '42501'; end if;
  select u.email_confirmed_at is not null into confirmed from auth.users u where u.id = uid;
  if confirmed is distinct from true then raise exception 'Verify your email before using couple spaces.' using errcode = '42501'; end if;
  select p.onboarding_completed into onboarded from public.profiles p where p.id = uid;
  if onboarded is distinct from true then raise exception 'Finish onboarding before using couple spaces.' using errcode = '42501'; end if;
  return uid;
end;
$$;
revoke all on function public.assert_verified_couple_user() from public, anon, authenticated;

create or replace function public.guard_couple_member_capacity()
returns trigger language plpgsql set search_path = '' as $$
declare expected_owner uuid; occupied integer;
begin
  if new.membership_state not in ('active','accepted') then return new; end if;
  select s.owner_user_id into expected_owner from public.couple_spaces s where s.id = new.space_id for update;
  if expected_owner is null then raise exception 'Couple space does not exist.' using errcode = '23503'; end if;
  if (new.role = 'owner' and new.user_id <> expected_owner) or (new.role = 'partner' and new.user_id = expected_owner) then
    raise exception 'Invalid couple membership.' using errcode = '23514';
  end if;
  select count(*) into occupied from public.couple_members m
    where m.space_id = new.space_id and m.membership_state in ('active','accepted') and m.user_id <> new.user_id;
  if occupied >= 2 then raise exception 'A couple space can have only two people.' using errcode = '23514'; end if;
  return new;
end;
$$;
drop trigger if exists couple_member_capacity_guard on public.couple_members;
create trigger couple_member_capacity_guard before insert or update of membership_state,role,space_id,user_id
  on public.couple_members for each row execute function public.guard_couple_member_capacity();

create or replace function public.expire_couple_invitation(p_space_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  update public.invitations i set status = 'expired'
    where i.space_id = p_space_id and i.status = 'pending' and i.expires_at <= now();
  get diagnostics changed = row_count;
  if changed > 0 then
    update public.couple_spaces s set status = 'invitation_expired' where s.id = p_space_id and s.status = 'invitation_sent';
    insert into public.connection_events(space_id,actor_user_id,event_type) values (p_space_id,null,'invitation_expired');
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.expire_couple_invitation(uuid) from public, anon, authenticated;

create or replace function public.create_couple_space(p_token_hash text, p_code_hash text, p_owner_consents boolean)
returns table(invitation_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid; new_space uuid; expires timestamptz := now() + interval '7 days';
begin
  uid := public.assert_verified_couple_user();
  if p_owner_consents is distinct from true then raise exception 'Consent to the room policy is required.' using errcode = '22023'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Could not create that invitation.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if exists (select 1 from public.couple_members m where m.user_id = uid and m.membership_state in ('active','accepted')) then
    raise exception 'You already have an active couple space.' using errcode = '23505';
  end if;
  insert into public.couple_spaces(owner_user_id,status,owner_consented_at) values (uid,'waiting_for_partner',now()) returning id into new_space;
  insert into public.couple_members(space_id,user_id,role,membership_state,consented_at) values (new_space,uid,'owner','active',now());
  insert into public.invitations(space_id,inviter_user_id,token_hash,code_hash,expires_at) values (new_space,uid,p_token_hash,p_code_hash,expires);
  update public.couple_spaces set status = 'invitation_sent' where id = new_space;
  insert into public.connection_events(space_id,actor_user_id,event_type,details)
    values (new_space,uid,'space_created','{"owner_consent":true,"content_policy":"delete_on_disconnect"}'),
           (new_space,uid,'invitation_sent',jsonb_build_object('expires_at',expires));
  return query select expires;
end;
$$;
revoke all on function public.create_couple_space(text,text,boolean) from public, anon;
grant execute on function public.create_couple_space(text,text,boolean) to authenticated;

create or replace function public.regenerate_couple_invitation(p_token_hash text, p_code_hash text)
returns table(invitation_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid; current_space uuid; expires timestamptz := now() + interval '7 days';
begin
  uid := public.assert_verified_couple_user();
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Could not regenerate that invitation.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select s.id into current_space from public.couple_spaces s
    where s.owner_user_id = uid and s.status in ('waiting_for_partner','invitation_sent','invitation_expired')
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

create or replace function public.preview_couple_invitation(p_token_hash text default null, p_code_hash text default null)
returns table(invitation_status text, space_status text, inviter_first_name text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid; invite_id uuid; space_id uuid; inviter uuid; invite_state text; room_state text; expiry timestamptz; inviter_name text;
begin
  uid := public.assert_verified_couple_user();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if (p_token_hash is null) = (p_code_hash is null)
     or (p_token_hash is not null and p_token_hash !~ '^[0-9a-f]{64}$')
     or (p_code_hash is not null and p_code_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invitation is unavailable.' using errcode = '22023';
  end if;
  select i.id,i.space_id into invite_id,space_id from public.invitations i
    where (p_token_hash is not null and i.token_hash = p_token_hash)
       or (p_code_hash is not null and i.code_hash = p_code_hash);
  if invite_id is null then return; end if;
  perform 1 from public.couple_spaces s where s.id = space_id for update;
  select i.inviter_user_id,i.status,i.expires_at,p.full_name into inviter,invite_state,expiry,inviter_name
    from public.invitations i join public.profiles p on p.id = i.inviter_user_id where i.id = invite_id for update of i;
  select s.status into room_state from public.couple_spaces s where s.id = space_id;
  perform public.expire_couple_invitation(space_id);
  select i.status,s.status,i.expires_at into invite_state,room_state,expiry
    from public.invitations i join public.couple_spaces s on s.id = i.space_id where i.id = invite_id;
  if inviter = uid then invite_state := 'self'; end if;
  if inviter <> uid and exists (select 1 from public.couple_members m
      where m.user_id = uid and m.space_id <> space_id and m.membership_state in ('active','accepted')) then
    return query select 'already_connected'::text,room_state,null::text,expiry;
    return;
  end if;
  return query select invite_state,room_state,
    case when invite_state in ('pending','accepted') then coalesce(nullif(pg_catalog.split_part(pg_catalog.btrim(inviter_name),' ',1),''),'Someone special') else null end,
    expiry;
end;
$$;
revoke all on function public.preview_couple_invitation(text,text) from public, anon;
grant execute on function public.preview_couple_invitation(text,text) to authenticated;

create or replace function public.accept_couple_invitation(p_token_hash text default null, p_code_hash text default null, p_partner_consents boolean default false)
returns table(space_status text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid; invite_id uuid; current_space uuid; inviter uuid; invite_state text; room_state text; expiry timestamptz;
begin
  uid := public.assert_verified_couple_user();
  if p_partner_consents is distinct from true then raise exception 'Consent to the room policy is required.' using errcode = '22023'; end if;
  if (p_token_hash is null) = (p_code_hash is null)
     or (p_token_hash is not null and p_token_hash !~ '^[0-9a-f]{64}$')
     or (p_code_hash is not null and p_code_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invitation is unavailable.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select i.id,i.space_id into invite_id,current_space from public.invitations i
    where (p_token_hash is not null and i.token_hash = p_token_hash)
       or (p_code_hash is not null and i.code_hash = p_code_hash);
  if invite_id is null then raise exception 'This invitation is unavailable.' using errcode = 'P0002'; end if;
  -- All connection mutations lock the space before invitations/members.
  perform 1 from public.couple_spaces s where s.id = current_space for update;
  select i.inviter_user_id,i.status,i.expires_at into inviter,invite_state,expiry
    from public.invitations i where i.id = invite_id for update;
  if inviter = uid then raise exception 'You cannot accept your own invitation.' using errcode = '22023'; end if;
  perform public.expire_couple_invitation(current_space);
  select i.status,s.status,i.expires_at into invite_state,room_state,expiry
    from public.invitations i join public.couple_spaces s on s.id = i.space_id where i.id = invite_id;
  if invite_state = 'expired' or expiry <= now() then return query select 'invitation_expired'::text; return; end if;
  if invite_state <> 'pending' or room_state <> 'invitation_sent' then
    raise exception 'This invitation has already been used or cancelled.' using errcode = '23505';
  end if;
  if exists (select 1 from public.couple_members m where m.user_id = uid and m.membership_state in ('active','accepted')) then
    raise exception 'End your current couple connection before joining another.' using errcode = '23505';
  end if;
  insert into public.couple_members(space_id,user_id,role,membership_state,consented_at)
    values (current_space,uid,'partner','accepted',now());
  update public.invitations set status = 'accepted',accepted_by = uid,accepted_at = now() where id = invite_id;
  update public.couple_spaces set status = 'invitation_accepted' where id = current_space;
  insert into public.connection_events(space_id,actor_user_id,event_type,details)
    values (current_space,uid,'invitation_accepted','{"partner_consent":true,"content_policy":"delete_on_disconnect"}');
  return query select 'invitation_accepted'::text;
end;
$$;
revoke all on function public.accept_couple_invitation(text,text,boolean) from public, anon;
grant execute on function public.accept_couple_invitation(text,text,boolean) to authenticated;

create or replace function public.withdraw_couple_acceptance()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid; current_space uuid; invite_id uuid;
begin
  uid := public.assert_verified_couple_user();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select s.id into current_space from public.couple_spaces s
    join public.couple_members m on m.space_id = s.id
    where m.user_id = uid and m.role = 'partner' and m.membership_state = 'accepted'
      and s.status = 'invitation_accepted' order by s.created_at desc limit 1 for update of s;
  if current_space is null then raise exception 'There is no accepted invitation to withdraw.' using errcode = 'P0002'; end if;
  select i.id into invite_id from public.invitations i
    where i.space_id = current_space and i.accepted_by = uid and i.status = 'accepted' for update;
  update public.invitations set status = 'cancelled' where id = invite_id;
  update public.couple_members set membership_state = 'cancelled',ended_at = now()
    where space_id = current_space and membership_state in ('active','accepted');
  update public.couple_spaces set status = 'connection_cancelled',ended_at = now() where id = current_space;
  insert into public.connection_events(space_id,actor_user_id,event_type) values (current_space,uid,'invitation_cancelled');
end;
$$;
revoke all on function public.withdraw_couple_acceptance() from public, anon;
grant execute on function public.withdraw_couple_acceptance() to authenticated;

create or replace function public.confirm_couple_connection()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid; current_space uuid; partner uuid;
begin
  uid := public.assert_verified_couple_user();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select s.id into current_space from public.couple_spaces s
    join public.couple_members m on m.space_id = s.id
    where s.owner_user_id = uid and m.user_id = uid and m.role = 'owner' and m.membership_state = 'active'
      and s.status = 'invitation_accepted' for update of s;
  if current_space is null then raise exception 'There is no accepted invitation to confirm.' using errcode = 'P0002'; end if;
  select m.user_id into partner from public.couple_members m
    where m.space_id = current_space and m.role = 'partner' and m.membership_state = 'accepted' and m.consented_at is not null for update;
  if partner is null then raise exception 'Your person has not accepted yet.' using errcode = '23514'; end if;
  update public.couple_members set membership_state = 'active' where space_id = current_space and user_id = partner;
  update public.couple_spaces set status = 'connected' where id = current_space;
  insert into public.connection_events(space_id,actor_user_id,event_type,details)
    values (current_space,uid,'connection_confirmed','{"owner_confirmation":true}');
end;
$$;
revoke all on function public.confirm_couple_connection() from public, anon;
grant execute on function public.confirm_couple_connection() to authenticated;

create or replace function public.cancel_couple_connection()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid; current_space uuid;
begin
  uid := public.assert_verified_couple_user();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select s.id into current_space from public.couple_spaces s
    where s.owner_user_id = uid and s.status in ('waiting_for_partner','invitation_sent','invitation_expired','invitation_accepted')
    order by s.created_at desc limit 1 for update;
  if current_space is null then raise exception 'There is no pending connection to cancel.' using errcode = 'P0002'; end if;
  update public.invitations set status = 'cancelled' where space_id = current_space and status = 'pending';
  update public.couple_members set membership_state = 'cancelled',ended_at = now()
    where space_id = current_space and membership_state in ('active','accepted');
  update public.couple_spaces set status = 'connection_cancelled',ended_at = now() where id = current_space;
  insert into public.connection_events(space_id,actor_user_id,event_type) values (current_space,uid,'invitation_cancelled');
end;
$$;
revoke all on function public.cancel_couple_connection() from public, anon;
grant execute on function public.cancel_couple_connection() to authenticated;

create or replace function public.disconnect_couple_space()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid; current_space uuid;
begin
  uid := public.assert_verified_couple_user();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select s.id into current_space from public.couple_spaces s
    join public.couple_members m on m.space_id = s.id
    where m.user_id = uid and m.membership_state = 'active' and s.status = 'connected'
    order by s.created_at desc limit 1 for update of s;
  if current_space is null then raise exception 'There is no connected space to disconnect.' using errcode = 'P0002'; end if;
  -- Phase 3 stores no shared content. Future room-content tables must be
  -- cleared in this transaction before this state change commits.
  update public.couple_members set membership_state = 'disconnected',ended_at = now()
    where space_id = current_space and membership_state in ('active','accepted');
  update public.couple_spaces set status = 'disconnected',ended_at = now(),content_deleted_at = now() where id = current_space;
  insert into public.connection_events(space_id,actor_user_id,event_type,details)
    values (current_space,uid,'connection_disconnected','{"shared_content":"deleted_on_disconnect"}');
end;
$$;
revoke all on function public.disconnect_couple_space() from public, anon;
grant execute on function public.disconnect_couple_space() to authenticated;

create or replace function public.get_my_couple_space()
returns table(state text,is_owner boolean,created_at timestamptz,invitation_expires_at timestamptz,partner_name text,partner_avatar_url text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid; current_space uuid; current_state text; owner_id uuid; created timestamptz; expiry timestamptz; other_name text; other_avatar text;
begin
  uid := public.assert_verified_couple_user();
  select s.id,s.status,s.owner_user_id,s.created_at into current_space,current_state,owner_id,created
    from public.couple_spaces s join public.couple_members m on m.space_id = s.id
    where m.user_id = uid order by s.created_at desc limit 1 for update of s;
  if current_space is null then return; end if;
  perform public.expire_couple_invitation(current_space);
  select s.status into current_state from public.couple_spaces s where s.id = current_space;
  select i.expires_at into expiry from public.invitations i
    where i.space_id = current_space and i.status = 'pending' order by i.created_at desc limit 1;
  select p.full_name,p.avatar_url into other_name,other_avatar
    from public.couple_members m join public.profiles p on p.id = m.user_id
    where m.space_id = current_space and m.user_id <> uid
      and m.membership_state in ('active','accepted','disconnected','cancelled') limit 1;
  return query select current_state,owner_id = uid,created,expiry,other_name,other_avatar;
end;
$$;
revoke all on function public.get_my_couple_space() from public, anon;
grant execute on function public.get_my_couple_space() to authenticated;

-- Extend Phase 2's database-backed limiter for invite-code attempts and
-- invitation mutations; only the server's service-role client may call it.
create or replace function public.consume_auth_rate_limit(
  p_bucket text,p_key text,p_max_requests integer,p_window_seconds integer
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare allowed boolean;
begin
  if p_bucket not in ('recovery-email','onboarding','couple-create','couple-regenerate','couple-code')
     or length(p_key) <> 64 or p_max_requests < 1 or p_max_requests > 20
     or p_window_seconds < 60 or p_window_seconds > 604800 then
    return false;
  end if;
  insert into public.auth_rate_limits(bucket,key_hash,window_started_at,request_count)
  values (p_bucket,p_key,now(),1)
  on conflict (bucket,key_hash) do update set
    window_started_at = case
      when public.auth_rate_limits.window_started_at < now() - pg_catalog.make_interval(secs => p_window_seconds) then now()
      else public.auth_rate_limits.window_started_at end,
    request_count = case
      when public.auth_rate_limits.window_started_at < now() - pg_catalog.make_interval(secs => p_window_seconds) then 1
      else public.auth_rate_limits.request_count + 1 end
  returning request_count <= p_max_requests into allowed;
  delete from public.auth_rate_limits where window_started_at < now() - interval '1 day';
  return allowed;
end;
$$;
revoke all on function public.consume_auth_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text,text,integer,integer) to service_role;
