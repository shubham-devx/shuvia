-- The inviter already consented when creating the invitation. Once the invited
-- partner explicitly accepts, activate both members so shared features unlock.
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
  -- Keep the established lock order: space, invitation, then membership rows.
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
    values (current_space,uid,'partner','active',now());
  update public.invitations set status = 'accepted',accepted_by = uid,accepted_at = now() where id = invite_id;
  update public.couple_spaces set status = 'connected' where id = current_space;
  insert into public.connection_events(space_id,actor_user_id,event_type,details)
    values (current_space,uid,'invitation_accepted','{"partner_consent":true,"content_policy":"delete_on_disconnect"}');
  insert into public.connection_events(space_id,actor_user_id,event_type,details)
    values (current_space,uid,'connection_confirmed','{"owner_confirmation":false,"owner_consented_at_invitation":true,"automatic_after_partner_acceptance":true}');
  return query select 'connected'::text;
end;
$$;
revoke all on function public.accept_couple_invitation(text,text,boolean) from public, anon;
grant execute on function public.accept_couple_invitation(text,text,boolean) to authenticated;
