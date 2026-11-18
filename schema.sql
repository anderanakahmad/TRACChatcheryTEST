-- TRACC Hatchery Portal v6: fresh Supabase/PostgreSQL installation.
-- IMPORTANT: Test in a disposable Supabase project before production.
-- This is a fresh-install schema. DO NOT run over an existing live schema without a planned migration.
-- ALL publicly accessible records must pass administrator approval.

create table public.staff_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('warden','admin')),
 display_name text
);

-- Public records. No draft or GPS fields belong here.
create table public.nests (
 id text primary key check (id ~ '^[A-Z0-9_-]{1,40}$'),
 season integer not null check (season between 2000 and 2100),
 species text not null check (species in ('Green turtle','Hawksbill turtle','Olive ridley turtle','Other / unconfirmed')),
 date_laid date,
 date_relocated date not null,
 egg_count integer not null check (egg_count > 0),
 warden_public_name text,
 expected_start date,
 expected_end date,
 status text not null check (status in ('incubating','emerged','excavated')),
 hatch_date date,
 emergence_date date,
 excavation_date date,
 hatched_eggs integer check (hatched_eggs between 0 and egg_count),
 emerged_hatchlings integer check (emerged_hatchlings between 0 and egg_count),
 released_hatchlings integer check (released_hatchlings between 0 and egg_count),
 island_sector_found text check (char_length(island_sector_found) <= 100),
 mother_tag_left text check (char_length(mother_tag_left) <= 60),
 mother_tag_right text check (char_length(mother_tag_right) <= 60),
 mother_ccl_cm numeric(5,1) check (mother_ccl_cm between 0 and 250),
 mother_ccw_cm numeric(5,1) check (mother_ccw_cm between 0 and 250),
 mother_note_public text check (char_length(mother_note_public) <= 400),
 public_metadata jsonb not null default '[]'::jsonb check (
   jsonb_typeof(public_metadata) = 'array' and jsonb_array_length(public_metadata) <= 20),
 notes_public text,
 published boolean not null default true check (published = true),
 updated_at timestamptz not null default now(),
 constraint calendar_year_season check (season = extract(year from date_relocated)::integer),
 constraint mother_tag_required check (
   mother_tag_left is not null or mother_tag_right is not null or
   (mother_ccl_cm is null and mother_ccw_cm is null and mother_note_public is null)),
 constraint dates_logical check (
   (date_laid is null or date_laid <= date_relocated)
   and (expected_start is null or expected_end is null or expected_start <= expected_end)),
 constraint counts_logical check (
   (hatched_eggs is null or excavation_date is not null)
   and (hatched_eggs is null or emerged_hatchlings is null or emerged_hatchlings <= hatched_eggs)),
 constraint assessed_date check (status <> 'excavated' or excavation_date is not null)
);

-- Sensitive research metadata MUST NOT be placed in public.nests.
create table public.nest_research (
 nest_id text primary key references public.nests(id) on delete cascade,
 scientific_data jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);

create table public.nest_submissions (
 submission_id uuid primary key default gen_random_uuid(),
 nest_id text not null check (nest_id ~ '^[A-Z0-9_-]{1,40}$'),
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 research_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(research_payload) = 'object'),
 base_updated_at timestamptz,
 submission_type text not null check (submission_type in ('new_nest','milestone','correction')),
 supersedes_submission_id uuid references public.nest_submissions(submission_id),
 review_state text not null default 'pending' check (review_state in ('pending','approved','rejected','returned')),
 submitted_by uuid not null default auth.uid() references auth.users(id),
 submitted_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text,
 check (length(coalesce(review_note,'')) <= 1200)
);

create table public.nest_audit (
 audit_id bigint generated always as identity primary key,
 nest_id text not null,
 submission_id uuid not null references public.nest_submissions(submission_id),
 action text not null check (action in ('new_nest','milestone','correction')),
 before_public jsonb,
 after_public jsonb not null,
 before_protected jsonb,
 after_protected jsonb,
 approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now()
);
create index on public.nest_audit(nest_id,approved_at desc);
create index on public.nests(season,species);
create index on public.nest_submissions(review_state, submitted_at desc);
create index on public.nest_submissions(submitted_by,submitted_at desc);

alter table public.staff_profiles enable row level security;
alter table public.nests enable row level security;
alter table public.nest_research enable row level security;
alter table public.nest_submissions enable row level security;
alter table public.nest_audit enable row level security;

revoke all on public.staff_profiles, public.nests, public.nest_research, public.nest_submissions, public.nest_audit from anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.nests to anon,authenticated;
grant select on public.staff_profiles to authenticated;
grant select,insert on public.nest_submissions to authenticated;
grant select on public.nest_research, public.nest_audit to authenticated;

create policy "Only own staff profile readable" on public.staff_profiles
 for select to authenticated using (user_id = (select auth.uid()));
create policy "Approved nests are public" on public.nests
 for select to anon,authenticated using (published = true);
-- No INSERT / UPDATE / DELETE policies for nests or nest_research.
-- Even authenticated wardens cannot alter published records directly.

-- Wardens cannot read protected research or audit snapshots, even for their own submissions.
create policy "Administrators see protected scientific records" on public.nest_research
 for select to authenticated using (exists (
   select 1 from public.staff_profiles p where p.user_id=(select auth.uid()) and p.role='admin'));
create policy "Administrators see full audit history" on public.nest_audit
 for select to authenticated using (exists (
   select 1 from public.staff_profiles p where p.user_id=(select auth.uid()) and p.role='admin'));

create policy "Wardens view only own submissions; admins view all" on public.nest_submissions
 for select to authenticated using (
 submitted_by=(select auth.uid()) or exists (
  select 1 from public.staff_profiles p where p.user_id=(select auth.uid()) and p.role='admin'));
create policy "Authorized staff submit only permitted changes" on public.nest_submissions
 for insert to authenticated with check (
  submitted_by=(select auth.uid()) and review_state='pending' and
  reviewed_by is null and reviewed_at is null and review_note is null and
  (supersedes_submission_id is null or exists (
    select 1 from public.nest_submissions old
    where old.submission_id=supersedes_submission_id and old.nest_id=nest_id
    and old.submitted_by=(select auth.uid()) and old.review_state='returned')) and
  (exists (select 1 from public.staff_profiles sp
      where sp.user_id=(select auth.uid()) and sp.role='admin')
   or exists (select 1 from public.staff_profiles sp
      where sp.user_id=(select auth.uid()) and sp.role='warden')
     and ((submission_type='new_nest' and not exists (select 1 from public.nests n where n.id=nest_id))
       or (submission_type='milestone' and exists (select 1 from public.nests n where n.id=nest_id))))
 );
-- No UPDATE or DELETE policy on submissions. Review state is changed only via verified RPC.


-- Review RPC. No direct edits to approved tables are available to authenticated clients.
-- All payload fields are checked again server-side; browser controls are not a security boundary.
create or replace function public.tracc_decide_submission(
 p_submission_id uuid, p_action text, p_review_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
 s public.nest_submissions%rowtype;
 p jsonb; r jsonb; previous_public jsonb; previous_private jsonb;
 current_version timestamptz; old_status text;
 key text;
 allowed_public text[] := array[
  'id','season','species','date_laid','date_relocated','egg_count','warden_public_name',
  'expected_start','expected_end','status','hatch_date','emergence_date','excavation_date',
  'hatched_eggs','emerged_hatchlings','released_hatchlings','notes_public',
  'island_sector_found','mother_tag_left','mother_tag_right','mother_ccl_cm',
  'mother_ccw_cm','mother_note_public','public_metadata'];
 allowed_milestone text[] := array[
  'status','hatch_date','emergence_date','excavation_date','hatched_eggs',
  'emerged_hatchlings','released_hatchlings','notes_public'];
 allowed_milestone_private text[] := array[
  'healthy_hatchlings','deformed_hatchlings','dead_hatchlings','total_excavated',
  'undeveloped_eggs','dead_egg_stage1',
  'dead_egg_stage2','dead_egg_stage3','attacked_eggs','hatching_method',
  'hatching_time','private_notes'];
begin
 if not exists (select 1 from public.staff_profiles where user_id=auth.uid() and role='admin')
   then raise exception 'Only administrators can review submissions' using errcode='42501'; end if;
 if p_action not in ('approve','reject','return') then raise exception 'Invalid review action'; end if;
 if p_action in ('reject','return') and length(trim(coalesce(p_review_note,''))) < 4
   then raise exception 'Explain why the submission was rejected or returned'; end if;
 if length(coalesce(p_review_note,''))>1200 then raise exception 'Review note too long'; end if;
 select * into s from public.nest_submissions where submission_id=p_submission_id for update;
 if not found then raise exception 'Submission not found'; end if;
 if s.review_state<>'pending' then raise exception 'Only pending submissions can be reviewed'; end if;
 if p_action='approve' then
   if jsonb_typeof(s.payload)<>'object' or jsonb_typeof(s.research_payload)<>'object'
     then raise exception 'Invalid submission document'; end if;
   select to_jsonb(n),n.updated_at,n.status into previous_public,current_version,old_status
     from public.nests n where n.id=s.nest_id for update;
   select scientific_data into previous_private from public.nest_research where nest_id=s.nest_id;

   if s.submission_type='new_nest' and previous_public is not null
     then raise exception 'Nest already exists: submit a milestone instead'; end if;
   if s.submission_type in ('milestone','correction') and previous_public is null
     then raise exception 'Cannot update a nest that does not exist'; end if;
   if (previous_public is null and s.base_updated_at is not null)
      or (previous_public is not null and (s.base_updated_at is null or current_version<>s.base_updated_at))
     then raise exception 'Published record changed: return this request for resubmission'; end if;
   if s.submission_type='milestone' then
     for key in select jsonb_object_keys(s.payload) loop
       if not key=any(allowed_milestone) then raise exception 'Forbidden milestone public field: %',key; end if;
     end loop;
     for key in select jsonb_object_keys(s.research_payload) loop
       if not key=any(allowed_milestone_private) then raise exception 'Forbidden milestone research field: %',key; end if;
     end loop;
     p := previous_public || s.payload;
     r := coalesce(previous_private,'{}'::jsonb) || s.research_payload;
     if old_status='excavated' and p->>'status'<>'excavated'
        then raise exception 'Excavated nest cannot revert status'; end if;
     if old_status='emerged' and p->>'status'='incubating'
        then raise exception 'Emerged nest cannot revert to incubating'; end if;
   else
     for key in select jsonb_object_keys(s.payload) loop
       if not key=any(allowed_public) then raise exception 'Forbidden public field: %',key; end if;
     end loop;
     p := s.payload;
     r := s.research_payload;
   end if;
   if coalesce(p->>'id',s.nest_id) is distinct from s.nest_id
     then raise exception 'Nest ID mismatch'; end if;
   if (p->>'season')::integer <> extract(year from (p->>'date_relocated')::date)::integer
     then raise exception 'Nesting season must match relocation calendar year'; end if;
   if p->>'status' not in ('incubating','emerged','excavated')
     then raise exception 'Unknown nest status'; end if;
   if p->>'status'='incubating' and coalesce((p->>'released_hatchlings')::integer,0)>0
     then raise exception 'Released hatchlings require emerged or excavated status'; end if;
   if p->>'status'='excavated' and nullif(p->>'excavation_date','') is null
     then raise exception 'Excavated status requires an excavation date'; end if;
   if (s.research_payload ? 'healthy_hatchlings') <> (s.research_payload ? 'deformed_hatchlings')
     then raise exception 'Both release categories must be entered'; end if;
   if (r->>'healthy_hatchlings') is not null or (r->>'deformed_hatchlings') is not null then
     if jsonb_typeof(r->'healthy_hatchlings')<>'number' or jsonb_typeof(r->'deformed_hatchlings')<>'number'
        then raise exception 'Both release categories must be whole-number counts'; end if;
     if (r->>'healthy_hatchlings')::integer<0 or (r->>'deformed_hatchlings')::integer<0
        then raise exception 'Negative release counts are invalid'; end if;
     if (p->>'released_hatchlings')::integer is distinct from
       (r->>'healthy_hatchlings')::integer+(r->>'deformed_hatchlings')::integer
        then raise exception 'Release total must equal healthy plus deformed'; end if;
   end if;
   if jsonb_typeof(coalesce(p->'public_metadata','[]'::jsonb))<>'array'
      or jsonb_array_length(coalesce(p->'public_metadata','[]'::jsonb))>20
     then raise exception 'Invalid public metadata list'; end if;
   if exists (select 1 from jsonb_array_elements(coalesce(p->'public_metadata','[]'::jsonb)) item
       where jsonb_typeof(item)<>'object' or jsonb_typeof(item->'label')<>'string'
          or jsonb_typeof(item->'value')<>'string'
          or length(item->>'label') not between 1 and 60
          or length(item->>'value') not between 1 and 280
          or (item->>'label') ~* '(broken|deformed)[[:space:]]+eggs?')
     then raise exception 'Invalid custom metadata field'; end if;
   -- A shared mother description must have an approved mother tag.
   if nullif(p->>'mother_tag_left','') is null and nullif(p->>'mother_tag_right','') is null
       and (nullif(p->>'mother_note_public','') is not null
        or nullif(p->>'mother_ccl_cm','') is not null or nullif(p->>'mother_ccw_cm','') is not null)
     then raise exception 'Mother details require an actual tag number'; end if;

   insert into public.nests
   (id,season,species,date_laid,date_relocated,egg_count,warden_public_name,expected_start,expected_end,
    status,hatch_date,emergence_date,excavation_date,hatched_eggs,emerged_hatchlings,released_hatchlings,
    notes_public,island_sector_found,mother_tag_left,mother_tag_right,mother_ccl_cm,mother_ccw_cm,
    mother_note_public,public_metadata,published,updated_at)
   values
   (s.nest_id,(p->>'season')::integer,p->>'species',nullif(p->>'date_laid','')::date,
    (p->>'date_relocated')::date,(p->>'egg_count')::integer,nullif(p->>'warden_public_name',''),
    nullif(p->>'expected_start','')::date,nullif(p->>'expected_end','')::date,p->>'status',
    nullif(p->>'hatch_date','')::date,nullif(p->>'emergence_date','')::date,
    nullif(p->>'excavation_date','')::date,nullif(p->>'hatched_eggs','')::integer,
    nullif(p->>'emerged_hatchlings','')::integer,nullif(p->>'released_hatchlings','')::integer,
    nullif(p->>'notes_public',''),nullif(p->>'island_sector_found',''),
    nullif(p->>'mother_tag_left',''),nullif(p->>'mother_tag_right',''),
    nullif(p->>'mother_ccl_cm','')::numeric,nullif(p->>'mother_ccw_cm','')::numeric,
    nullif(p->>'mother_note_public',''),coalesce(p->'public_metadata','[]'::jsonb),true,now())
   on conflict(id) do update set
     season=excluded.season,species=excluded.species,date_laid=excluded.date_laid,
     date_relocated=excluded.date_relocated,egg_count=excluded.egg_count,
     warden_public_name=excluded.warden_public_name,expected_start=excluded.expected_start,
     expected_end=excluded.expected_end,status=excluded.status,hatch_date=excluded.hatch_date,
     emergence_date=excluded.emergence_date,excavation_date=excluded.excavation_date,
     hatched_eggs=excluded.hatched_eggs,emerged_hatchlings=excluded.emerged_hatchlings,
     released_hatchlings=excluded.released_hatchlings,notes_public=excluded.notes_public,
     island_sector_found=excluded.island_sector_found,mother_tag_left=excluded.mother_tag_left,
     mother_tag_right=excluded.mother_tag_right,mother_ccl_cm=excluded.mother_ccl_cm,
     mother_ccw_cm=excluded.mother_ccw_cm,mother_note_public=excluded.mother_note_public,
     public_metadata=excluded.public_metadata,published=true,updated_at=now();
   insert into public.nest_research(nest_id,scientific_data,updated_at)
     values(s.nest_id,r,now()) on conflict(nest_id) do update set
       scientific_data=excluded.scientific_data,updated_at=now();
   insert into public.nest_audit(nest_id,submission_id,action,before_public,after_public,
      before_protected,after_protected,approved_by)
     select s.nest_id,s.submission_id,s.submission_type,previous_public,to_jsonb(n),
       previous_private,r,auth.uid() from public.nests n where n.id=s.nest_id;
 end if;
 update public.nest_submissions set
   review_state=case p_action when 'approve' then 'approved' when 'return' then 'returned' else 'rejected' end,
   reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(coalesce(p_review_note,'')),'')
 where submission_id=p_submission_id;
end;
$$;
revoke all on function public.tracc_decide_submission(uuid,text,text) from public;
grant execute on function public.tracc_decide_submission(uuid,text,text) to authenticated;

-- Add approved staff through the Supabase SQL editor after inviting auth users:
-- insert into public.staff_profiles(user_id,role,display_name)
-- values ('STAFF-AUTH-UUID','warden','Warden Name');
-- Admin uses role='admin'. Wardens cannot SELECT nest_research or nest_audit.
-- Deploy to a new TEST project, run actual cross-role RLS tests, and complete review before production.
