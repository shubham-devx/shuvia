-- Harden couple-space lookup ordering and invitation decline expiry checks
-- without altering existing table schemas or RLS boundaries.

create or replace function public.get_my_couple_space()
returns table(state text,is_owner boolean,created_at timestamptz,invitation_expires_at timestamptz,partner_name text,partner_avatar_url text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid; current_space uuid; current_state text; owner_id uuid; created timestamptz; expiry timestamptz; other_name text; other_avatar text;
begin
  uid := public.assert_verified_couple_user();
  select s.id,s.status,s.owner_user_id,s.created_at into current_space,current_state,owner_id,created
    from public.couple_spaces s join public.couple_members m on m.space_id = s.id
    where m.user_id = uid
    order by (m.membership_state in ('active','accepted')) desc, s.created_at desc
    limit 1 for update of s;
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
  select i.status,i.expires_at into invitation_state,expiry
    from public.invitations i where i.id = invitation_id;
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

notify pgrst, 'reload schema';
