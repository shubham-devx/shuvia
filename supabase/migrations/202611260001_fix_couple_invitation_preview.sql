-- Avoid PL/pgSQL's variable/column ambiguity for the current space id.
create or replace function public.preview_couple_invitation(p_token_hash text default null, p_code_hash text default null)
returns table(invitation_status text, space_status text, inviter_first_name text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid; invite_id uuid; v_space_id uuid; inviter uuid; invite_state text; room_state text; expiry timestamptz; inviter_name text;
begin
  uid := public.assert_verified_couple_user();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  if (p_token_hash is null) = (p_code_hash is null)
     or (p_token_hash is not null and p_token_hash !~ '^[0-9a-f]{64}$')
     or (p_code_hash is not null and p_code_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invitation is unavailable.' using errcode = '22023';
  end if;
  select i.id,i.space_id into invite_id,v_space_id from public.invitations i
    where (p_token_hash is not null and i.token_hash = p_token_hash)
       or (p_code_hash is not null and i.code_hash = p_code_hash);
  if invite_id is null then return; end if;
  perform 1 from public.couple_spaces s where s.id = v_space_id for update;
  select i.inviter_user_id,i.status,i.expires_at,p.full_name into inviter,invite_state,expiry,inviter_name
    from public.invitations i join public.profiles p on p.id = i.inviter_user_id where i.id = invite_id for update of i;
  select s.status into room_state from public.couple_spaces s where s.id = v_space_id;
  perform public.expire_couple_invitation(v_space_id);
  select i.status,s.status,i.expires_at into invite_state,room_state,expiry
    from public.invitations i join public.couple_spaces s on s.id = i.space_id where i.id = invite_id;
  if inviter = uid then invite_state := 'self'; end if;
  if inviter <> uid and exists (select 1 from public.couple_members m
      where m.user_id = uid and m.space_id <> v_space_id and m.membership_state in ('active','accepted')) then
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
