-- Phase 5: persistent, server-validated game sessions for connected couples.
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  game_type text not null check (game_type in ('truth-or-dare','would-you-rather','how-well-do-you-know-me','guess-my-answer','complete-the-sentence','this-or-that','emoji-love-challenge','deep-love-questions')),
  category text not null check (category in ('sweet','playful','thoughtful','silly','long-distance','mixed')),
  answer_mode text not null check (answer_mode in ('turn','both','guess')),
  status text not null default 'active' check (status in ('active','paused','completed')),
  player_one_id uuid not null references auth.users(id) on delete cascade,
  player_two_id uuid not null references auth.users(id) on delete cascade,
  current_round integer not null default 1 check (current_round > 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (player_one_id <> player_two_id),
  check ((status = 'completed') = (completed_at is not null)),
  unique (id,space_id)
);
create unique index if not exists game_sessions_one_open_per_space on public.game_sessions(space_id) where status in ('active','paused');
create index if not exists game_sessions_space_history_idx on public.game_sessions(space_id,created_at desc);

create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  space_id uuid not null references public.couple_spaces(id) on delete cascade,
  round_no integer not null check (round_no > 0),
  prompt_id text not null check (length(prompt_id) between 4 and 80),
  prompt_text text not null check (length(btrim(prompt_text)) between 1 and 500),
  prompt_kind text not null check (prompt_kind in ('truth','dare','question','choice','sentence','emoji')),
  option_a text check (option_a is null or length(option_a) <= 180),
  option_b text check (option_b is null or length(option_b) <= 180),
  turn_user_id uuid references auth.users(id) on delete set null,
  answerer_user_id uuid references auth.users(id) on delete set null,
  result_status text not null default 'active' check (result_status in ('active','revealed','skipped')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (session_id,round_no),
  unique (session_id,prompt_id),
  foreign key (session_id,space_id) references public.game_sessions(id,space_id) on delete cascade
);
create table if not exists public.game_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  space_id uuid not null,
  round_no integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer_role text not null check (answer_role in ('response','answer','guess')),
  answer_text text not null check (length(btrim(answer_text)) between 1 and 1000),
  submitted_at timestamptz not null default now(),
  unique (session_id,round_no,user_id),
  foreign key (session_id,space_id) references public.game_sessions(id,space_id) on delete cascade,
  foreign key (session_id,round_no) references public.game_rounds(session_id,round_no) on delete cascade
);
create index if not exists game_answers_user_idx on public.game_answers(session_id,round_no,user_id);

alter table public.game_sessions enable row level security;
alter table public.game_rounds enable row level security;
alter table public.game_answers enable row level security;
create policy "Connected members can read game sessions" on public.game_sessions for select to authenticated using (public.is_active_couple_member(space_id));
create policy "Connected members can read game rounds" on public.game_rounds for select to authenticated using (public.is_active_couple_member(space_id));
create policy "Players can read own answers or revealed answers" on public.game_answers for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.game_rounds r where r.session_id = game_answers.session_id and r.round_no = game_answers.round_no
      and r.result_status = 'revealed' and public.is_active_couple_member(r.space_id)
  )
);
revoke all on public.game_sessions,public.game_rounds,public.game_answers from public,anon,authenticated;
grant all on public.game_sessions,public.game_rounds,public.game_answers to service_role;

create or replace function public.assert_shuvia_game_actor(p_actor_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sid uuid; confirmed boolean; onboarded boolean;
begin
  if p_actor_id is null then raise exception 'Sign in to play together.' using errcode='42501'; end if;
  select u.email_confirmed_at is not null into confirmed from auth.users u where u.id=p_actor_id;
  select p.onboarding_completed into onboarded from public.profiles p where p.id=p_actor_id;
  if confirmed is distinct from true then raise exception 'Verify your email before playing.' using errcode='42501'; end if;
  if onboarded is distinct from true then raise exception 'Finish onboarding before playing.' using errcode='42501'; end if;
  select s.id into sid from public.couple_spaces s join public.couple_members m on m.space_id=s.id
    where m.user_id=p_actor_id and m.membership_state='active' and s.status='connected' limit 1;
  if sid is null then raise exception 'Connect your person before playing.' using errcode='42501'; end if;
  return sid;
end;
$$;
revoke all on function public.assert_shuvia_game_actor(uuid) from public,anon,authenticated;
grant execute on function public.assert_shuvia_game_actor(uuid) to service_role;

create or replace function public.start_couple_game(
  p_actor_id uuid,p_game_type text,p_category text,p_prompt_id text,p_prompt_text text,p_prompt_kind text,p_option_a text,p_option_b text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sid uuid; partner uuid; new_id uuid; mode text;
begin
  sid := public.assert_shuvia_game_actor(p_actor_id);
  perform 1 from public.couple_spaces s where s.id=sid for update;
  if p_game_type not in ('truth-or-dare','would-you-rather','how-well-do-you-know-me','guess-my-answer','complete-the-sentence','this-or-that','emoji-love-challenge','deep-love-questions')
     or p_category not in ('sweet','playful','thoughtful','silly','long-distance','mixed') then
    raise exception 'Choose a game and category from the Shuvia collection.' using errcode='22023';
  end if;
  select m.user_id into partner from public.couple_members m where m.space_id=sid and m.user_id<>p_actor_id and m.membership_state='active' limit 1;
  if partner is null then raise exception 'Your person is not connected to this space.' using errcode='42501'; end if;
  if exists(select 1 from public.game_sessions g where g.space_id=sid and g.status in ('active','paused')) then
    raise exception 'Finish or pause the current shared game before starting another.' using errcode='23505';
  end if;
  mode := case when p_game_type='truth-or-dare' then 'turn'
    when p_game_type in ('how-well-do-you-know-me','guess-my-answer') then 'guess' else 'both' end;
  insert into public.game_sessions(space_id,game_type,category,answer_mode,status,player_one_id,player_two_id,current_round,created_by)
    values(sid,p_game_type,p_category,mode,'active',p_actor_id,partner,1,p_actor_id) returning id into new_id;
  insert into public.game_rounds(session_id,space_id,round_no,prompt_id,prompt_text,prompt_kind,option_a,option_b,turn_user_id,answerer_user_id)
    values(new_id,sid,1,p_prompt_id,p_prompt_text,p_prompt_kind,p_option_a,p_option_b,
      case when mode in ('turn','guess') then p_actor_id else null end,
      case when mode='guess' then p_actor_id else null end);
  insert into public.couple_activity_events(space_id,actor_id,event_type,summary) values(sid,p_actor_id,'game_activity','Started a shared game');
  return new_id;
end;
$$;
revoke all on function public.start_couple_game(uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.start_couple_game(uuid,text,text,text,text,text,text,text) to service_role;

create or replace function public.transition_couple_game(
  p_actor_id uuid,p_session_id uuid,p_action text,p_answer_text text default null,
  p_prompt_id text default null,p_prompt_text text default null,p_prompt_kind text default null,p_option_a text default null,p_option_b text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sid uuid; game public.game_sessions%rowtype; round public.game_rounds%rowtype; role_name text; answer_count integer; next_round integer;
begin
  sid := public.assert_shuvia_game_actor(p_actor_id);
  perform 1 from public.couple_spaces s where s.id=sid for update;
  select * into game from public.game_sessions g where g.id=p_session_id and g.space_id=sid for update;
  if not found then raise exception 'This game is no longer in your shared space.' using errcode='P0002'; end if;
  if p_action='start' then raise exception 'This game has already started.' using errcode='22023'; end if;
  if p_action='pause' then
    if game.status <> 'active' then raise exception 'This game cannot be paused right now.' using errcode='22023'; end if;
    update public.game_sessions set status='paused',updated_at=now() where id=game.id;
    return jsonb_build_object('status','paused');
  elsif p_action='resume' then
    if game.status <> 'paused' then raise exception 'This game is not paused.' using errcode='22023'; end if;
    update public.game_sessions set status='active',updated_at=now() where id=game.id;
    return jsonb_build_object('status','active');
  elsif p_action='submit' then
    if game.status <> 'active' then raise exception 'Resume this game before answering.' using errcode='22023'; end if;
    select * into round from public.game_rounds r where r.session_id=game.id and r.round_no=game.current_round for update;
    if round.result_status <> 'active' then raise exception 'This round has already been revealed or skipped.' using errcode='23505'; end if;
    if p_answer_text is null or length(btrim(p_answer_text)) < 1 or length(p_answer_text) > 1000 then
      raise exception 'Write an answer of up to 1,000 characters.' using errcode='22023';
    end if;
    if p_actor_id not in (game.player_one_id,game.player_two_id) then raise exception 'You are not part of this game.' using errcode='42501'; end if;
    if game.answer_mode='turn' and round.turn_user_id <> p_actor_id then raise exception 'It is your person’s turn this round.' using errcode='42501'; end if;
    role_name := case when game.answer_mode='guess' then case when round.answerer_user_id=p_actor_id then 'answer' else 'guess' end else 'response' end;
    insert into public.game_answers(session_id,space_id,round_no,user_id,answer_role,answer_text)
      values(game.id,sid,game.current_round,p_actor_id,role_name,btrim(p_answer_text));
    select count(*) into answer_count from public.game_answers a where a.session_id=game.id and a.round_no=game.current_round;
    if game.answer_mode='turn' or answer_count=2 then
      update public.game_rounds set result_status='revealed',resolved_at=now() where id=round.id;
    end if;
    update public.game_sessions set updated_at=now() where id=game.id;
    return jsonb_build_object('status',case when game.answer_mode='turn' or answer_count=2 then 'revealed' else 'waiting' end,'answer_count',answer_count);
  elsif p_action='skip' then
    if game.status <> 'active' then raise exception 'Resume this game before skipping.' using errcode='22023'; end if;
    update public.game_rounds set result_status='skipped',resolved_at=now() where session_id=game.id and round_no=game.current_round and result_status='active';
    if not found then raise exception 'This round is already finished.' using errcode='23505'; end if;
    update public.game_sessions set updated_at=now() where id=game.id;
    return jsonb_build_object('status','skipped');
  elsif p_action='next' then
    if game.status <> 'active' then raise exception 'Resume this game before continuing.' using errcode='22023'; end if;
    select * into round from public.game_rounds r where r.session_id=game.id and r.round_no=game.current_round for update;
    if round.result_status not in ('revealed','skipped') then raise exception 'Finish or skip this round before continuing.' using errcode='22023'; end if;
    if p_prompt_id is null or p_prompt_text is null or p_prompt_kind is null then raise exception 'Choose another card before continuing.' using errcode='22023'; end if;
    next_round := game.current_round+1;
    insert into public.game_rounds(session_id,space_id,round_no,prompt_id,prompt_text,prompt_kind,option_a,option_b,turn_user_id,answerer_user_id)
      values(game.id,sid,next_round,p_prompt_id,p_prompt_text,p_prompt_kind,p_option_a,p_option_b,
        case when game.answer_mode in ('turn','guess') then case when round.turn_user_id=game.player_one_id then game.player_two_id else game.player_one_id end else null end,
        case when game.answer_mode='guess' then case when round.answerer_user_id=game.player_one_id then game.player_two_id else game.player_one_id end else null end);
    update public.game_sessions set current_round=next_round,updated_at=now() where id=game.id;
    return jsonb_build_object('status','active','round_no',next_round);
  elsif p_action='complete' then
    if game.status not in ('active','paused') then raise exception 'This game is already complete.' using errcode='22023'; end if;
    select * into round from public.game_rounds r where r.session_id=game.id and r.round_no=game.current_round;
    if round.result_status='active' then raise exception 'Finish or skip the current round before ending the game.' using errcode='22023'; end if;
    update public.game_sessions set status='completed',completed_at=now(),updated_at=now() where id=game.id;
    insert into public.couple_activity_events(space_id,actor_id,event_type,summary) values(sid,p_actor_id,'game_activity','Finished a shared game');
    return jsonb_build_object('status','completed');
  else raise exception 'That game action is not available.' using errcode='22023';
  end if;
end;
$$;
revoke all on function public.transition_couple_game(uuid,uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.transition_couple_game(uuid,uuid,text,text,text,text,text,text,text) to service_role;

create or replace function public.get_couple_game_room(p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sid uuid; partner uuid; my_name text; partner_name text; partner_avatar text; active_id uuid; current jsonb; active jsonb; history jsonb;
begin
  sid := public.assert_shuvia_game_actor(p_actor_id);
  select m.user_id,p.full_name,p.avatar_url into partner,partner_name,partner_avatar from public.couple_members m join public.profiles p on p.id=m.user_id
    where m.space_id=sid and m.user_id<>p_actor_id and m.membership_state='active' limit 1;
  select full_name into my_name from public.profiles where id=p_actor_id;
  select g.id into active_id from public.game_sessions g where g.space_id=sid and g.status in ('active','paused') limit 1;
  if active_id is not null then
    select jsonb_build_object(
      'id',g.id,'game_type',g.game_type,'category',g.category,'answer_mode',g.answer_mode,'status',g.status,'current_round',g.current_round,'created_at',g.created_at,
      'round',jsonb_build_object('round_no',r.round_no,'prompt_id',r.prompt_id,'prompt_text',r.prompt_text,'prompt_kind',r.prompt_kind,'option_a',r.option_a,'option_b',r.option_b,
        'result_status',r.result_status,'is_my_turn',r.turn_user_id=p_actor_id,'is_my_answerer',r.answerer_user_id=p_actor_id,
        'my_answer_role',case when g.answer_mode='guess' then case when r.answerer_user_id=p_actor_id then 'answer' else 'guess' end else 'response' end,
        'my_answer',(select a.answer_text from public.game_answers a where a.session_id=g.id and a.round_no=r.round_no and a.user_id=p_actor_id),
        'partner_answer',case when r.result_status='revealed' then (select a.answer_text from public.game_answers a where a.session_id=g.id and a.round_no=r.round_no and a.user_id<>p_actor_id) else null end,
        'my_submitted',exists(select 1 from public.game_answers a where a.session_id=g.id and a.round_no=r.round_no and a.user_id=p_actor_id),
        'partner_submitted',exists(select 1 from public.game_answers a where a.session_id=g.id and a.round_no=r.round_no and a.user_id<>p_actor_id),
        'answer_count',(select count(*) from public.game_answers a where a.session_id=g.id and a.round_no=r.round_no)),
      'round_count',(select count(*) from public.game_rounds rr where rr.session_id=g.id),
      'used_prompt_ids',(select coalesce(jsonb_agg(rr.prompt_id),'[]'::jsonb) from public.game_rounds rr where rr.session_id=g.id)
    ) into active from public.game_sessions g join public.game_rounds r on r.session_id=g.id and r.round_no=g.current_round where g.id=active_id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'game_type',g.game_type,'category',g.category,'status',g.status,'created_at',g.created_at,'completed_at',g.completed_at,
    'round_count',(select count(*) from public.game_rounds rr where rr.session_id=g.id),
    'prompt_ids',(select coalesce(jsonb_agg(rr.prompt_id),'[]'::jsonb) from public.game_rounds rr where rr.session_id=g.id),
    'rounds',(select coalesce(jsonb_agg(jsonb_build_object('round_no',r.round_no,'prompt_text',r.prompt_text,'prompt_kind',r.prompt_kind,'result_status',r.result_status,
      'answers',(select coalesce(jsonb_agg(jsonb_build_object('role',a.answer_role,'answer',case when r.prompt_kind='choice' then case a.answer_text when 'A' then r.option_a when 'B' then r.option_b else a.answer_text end else a.answer_text end,'author_name',p.full_name) order by a.submitted_at),'[]'::jsonb)
        from public.game_answers a join public.profiles p on p.id=a.user_id where a.session_id=g.id and a.round_no=r.round_no and r.result_status='revealed'))
      order by r.round_no),'[]'::jsonb) from public.game_rounds r where r.session_id=g.id)
  ) order by g.created_at desc),'[]'::jsonb) into history from (
    select * from public.game_sessions s where s.space_id=sid and s.status='completed' order by s.completed_at desc limit 10
  ) g;
  return jsonb_build_object('space_id',sid,'user_id',p_actor_id,'your_name',coalesce(my_name,'You'),'partner_name',coalesce(partner_name,'Your person'),'partner_avatar_url',partner_avatar,'active_session',active,'history',history);
end;
$$;
revoke all on function public.get_couple_game_room(uuid) from public,anon,authenticated;
grant execute on function public.get_couple_game_room(uuid) to service_role;

-- Delete game history and answers in the same transaction as a couple disconnect.
create or replace function public.delete_game_content_on_disconnect()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='disconnected' and old.status is distinct from 'disconnected' then
    delete from public.game_answers where space_id=new.id;
    delete from public.game_rounds where space_id=new.id;
    delete from public.game_sessions where space_id=new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists delete_couple_game_content_on_disconnect on public.couple_spaces;
create trigger delete_couple_game_content_on_disconnect after update of status on public.couple_spaces
  for each row execute function public.delete_game_content_on_disconnect();
revoke all on function public.delete_game_content_on_disconnect() from public,anon,authenticated;

-- Start/replay requests share the existing database-backed per-user limiter.
create or replace function public.consume_auth_rate_limit(
  p_bucket text,p_key text,p_max_requests integer,p_window_seconds integer
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare allowed boolean;
begin
  if p_bucket not in ('recovery-email','onboarding','couple-create','couple-regenerate','couple-code','game-start')
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
