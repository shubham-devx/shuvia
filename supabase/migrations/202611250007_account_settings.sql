-- Phase 8: private account settings and self-scoped avatar storage.
alter table public.user_preferences
  add column if not exists theme text not null default 'warm' check(theme in ('warm','rose','lavender')),
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists music_enabled boolean not null default false,
  add column if not exists show_online_status boolean not null default true,
  add column if not exists share_activity boolean not null default true;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('shuvia-avatars','shuvia-avatars',false,5242880,array['image/webp','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/webp','image/jpeg','image/png'];

drop policy if exists "Users can read their Shuvia avatar" on storage.objects;
create policy "Users can read their Shuvia avatar" on storage.objects for select to authenticated using(
 bucket_id='shuvia-avatars' and split_part(name,'/',1)=(select auth.uid())::text
);
drop policy if exists "Users can upload their Shuvia avatar" on storage.objects;
create policy "Users can upload their Shuvia avatar" on storage.objects for insert to authenticated with check(
 bucket_id='shuvia-avatars' and split_part(name,'/',1)=(select auth.uid())::text
);
drop policy if exists "Users can update their Shuvia avatar" on storage.objects;
create policy "Users can update their Shuvia avatar" on storage.objects for update to authenticated using(
 bucket_id='shuvia-avatars' and split_part(name,'/',1)=(select auth.uid())::text
) with check(bucket_id='shuvia-avatars' and split_part(name,'/',1)=(select auth.uid())::text);
drop policy if exists "Users can delete their Shuvia avatar" on storage.objects;
create policy "Users can delete their Shuvia avatar" on storage.objects for delete to authenticated using(
 bucket_id='shuvia-avatars' and split_part(name,'/',1)=(select auth.uid())::text
);

create or replace function public.consume_auth_rate_limit(
 p_bucket text,p_key text,p_max_requests integer,p_window_seconds integer
)
returns boolean language plpgsql security definer set search_path='' as $$
declare allowed boolean;
begin
 if p_bucket not in ('recovery-email','onboarding','couple-create','couple-regenerate','couple-code','game-start','love-note-send','surprise-send','memory-write','account-delete')
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
