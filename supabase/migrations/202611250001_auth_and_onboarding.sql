create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  onboarding_completed boolean not null default false,
  legal_accepted_at timestamptz,
  legal_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  expectations text[] not null default '{}',
  relationship_type text,
  interested_activities text[] not null default '{}',
  discovery_source text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;

create or replace function public.is_current_user_email_verified()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid()) and email_confirmed_at is not null
  );
$$;
revoke all on function public.is_current_user_email_verified() from public, anon;
grant execute on function public.is_current_user_email_verified() to authenticated;

drop policy if exists "Users read their profile" on public.profiles;
create policy "Users read their profile" on public.profiles for select to authenticated using ((select auth.uid()) = id and (select public.is_current_user_email_verified()));
drop policy if exists "Users update their editable profile fields" on public.profiles;
create policy "Users update their editable profile fields" on public.profiles for update to authenticated using ((select auth.uid()) = id and (select public.is_current_user_email_verified())) with check ((select auth.uid()) = id and (select public.is_current_user_email_verified()));
drop policy if exists "Users read their preferences" on public.user_preferences;
create policy "Users read their preferences" on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id and (select public.is_current_user_email_verified()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
revoke all on public.user_preferences from anon, authenticated;
grant select on public.user_preferences to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
drop trigger if exists preferences_touch_updated_at on public.user_preferences;
create trigger preferences_touch_updated_at before update on public.user_preferences
for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, legal_accepted_at, legal_version)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80),
    case when new.raw_user_meta_data ->> 'legal_accepted' = 'true' then now() else null end,
    case when new.raw_user_meta_data ->> 'legal_accepted' = 'true' then left(new.raw_user_meta_data ->> 'legal_version', 32) else null end
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create table if not exists public.auth_rate_limits (
  bucket text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null,
  primary key (bucket, key_hash)
);
alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from anon, authenticated;

create or replace function public.consume_auth_rate_limit(
  p_bucket text, p_key text, p_max_requests integer, p_window_seconds integer
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare allowed boolean;
begin
  if p_bucket not in ('recovery-email', 'onboarding') or length(p_key) <> 64
     or p_max_requests < 1 or p_max_requests > 20 or p_window_seconds < 60 or p_window_seconds > 7200 then
    return false;
  end if;
  insert into public.auth_rate_limits (bucket, key_hash, window_started_at, request_count)
  values (p_bucket, p_key, now(), 1)
  on conflict (bucket, key_hash) do update set
    window_started_at = case
      when public.auth_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
      else public.auth_rate_limits.window_started_at end,
    request_count = case
      when public.auth_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
      else public.auth_rate_limits.request_count + 1 end
  returning request_count <= p_max_requests into allowed;
  delete from public.auth_rate_limits where window_started_at < now() - interval '1 day';
  return allowed;
end;
$$;
revoke all on function public.consume_auth_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text, text, integer, integer) to service_role;

create or replace function public.complete_onboarding(p_preferences jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); verified boolean;
begin
  if uid is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  select email_confirmed_at is not null into verified from auth.users where id = uid;
  if verified is distinct from true then raise exception 'Verified email required.' using errcode = '42501'; end if;
  if jsonb_typeof(p_preferences -> 'expectations') <> 'array'
     or jsonb_typeof(p_preferences -> 'interestedActivities') <> 'array' then
    raise exception 'Invalid onboarding preferences.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_preferences -> 'expectations') > 6
     or jsonb_array_length(p_preferences -> 'interestedActivities') > 6 then
    raise exception 'Too many onboarding choices.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements_text(p_preferences -> 'expectations') v
    where v not in ('Build a stronger connection','Have fun together','Make long-distance relationships exciting','Share romantic moments','Create beautiful memories','Explore everything'))
     or exists (select 1 from jsonb_array_elements_text(p_preferences -> 'interestedActivities') v
    where v not in ('Romantic games','Truth or Dare','Love questions','Virtual dates','Love notes','Shared memories'))
     or coalesce(p_preferences ->> 'relationshipType','') not in ('','Long-distance','Together but living separately','Newly in love','Married','Just exploring together','Prefer not to say')
     or coalesce(p_preferences ->> 'discoverySource','') not in ('','Instagram','Friends','Google','Other') then
    raise exception 'Invalid onboarding choices.' using errcode = '22023';
  end if;

  insert into public.user_preferences (user_id, expectations, relationship_type, interested_activities, discovery_source)
  values (
    uid,
    array(select jsonb_array_elements_text(p_preferences -> 'expectations')),
    nullif(p_preferences ->> 'relationshipType',''),
    array(select jsonb_array_elements_text(p_preferences -> 'interestedActivities')),
    nullif(p_preferences ->> 'discoverySource','')
  ) on conflict (user_id) do update set
    expectations = excluded.expectations,
    relationship_type = excluded.relationship_type,
    interested_activities = excluded.interested_activities,
    discovery_source = excluded.discovery_source,
    updated_at = now();
  update public.profiles set onboarding_completed = true, updated_at = now() where id = uid;
end;
$$;
revoke all on function public.complete_onboarding(jsonb) from public, anon;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
