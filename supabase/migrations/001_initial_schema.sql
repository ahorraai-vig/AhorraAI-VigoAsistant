-- ============================================================
-- PONTEVEDRA CONSTRUCTION PROSPECTOR
-- Initial Supabase Schema
-- Version: 1.0.0
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type business_size as enum (
    'SOLO',
    'MICRO_2_3',
    'SMALL_4_10',
    'SMALL_11_20',
    'MEDIUM',
    'UNKNOWN'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type asset_type as enum (
    'WEBSITE',
    'FACEBOOK',
    'INSTAGRAM',
    'LINKEDIN',
    'YOUTUBE',
    'TIKTOK',
    'WHATSAPP',
    'GOOGLE_BUSINESS',
    'OTHER'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type asset_status as enum (
    'ACTIVE',
    'INACTIVE',
    'NOT_FOUND',
    'BROKEN',
    'UNKNOWN'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type signal_kind as enum (
    'FACT',
    'INFERENCE'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type lead_status as enum (
    'NEW',
    'QUALIFIED',
    'CONTACTED',
    'RESPONDED',
    'INTERESTED',
    'DEMO',
    'PROPOSAL',
    'CUSTOMER',
    'NOT_INTERESTED',
    'NO_RESPONSE',
    'BAD_LEAD',
    'DO_NOT_CONTACT'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type outreach_channel as enum (
    'PHONE',
    'WHATSAPP',
    'EMAIL',
    'FACEBOOK',
    'INSTAGRAM',
    'IN_PERSON',
    'OTHER'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type outreach_outcome as enum (
    'NO_ANSWER',
    'ANSWERED',
    'INTERESTED',
    'NOT_INTERESTED',
    'CALL_BACK',
    'DEMO_BOOKED',
    'PROPOSAL_REQUESTED',
    'CUSTOMER',
    'WRONG_NUMBER',
    'DO_NOT_CONTACT',
    'OTHER'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type source_type as enum (
    'GOOGLE_PLACES',
    'GOOGLE_SEARCH',
    'PUBLIC_DIRECTORY',
    'BUSINESS_WEBSITE',
    'SOCIAL_MEDIA',
    'OPEN_DATA',
    'MANUAL',
    'OTHER'
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- SOURCES
-- ============================================================

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  source_type source_type not null,
  source_name text not null,
  base_url text,
  terms_url text,
  active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sources_type
on sources(source_type);

-- ============================================================
-- SEARCH RUNS
-- ============================================================

create table if not exists search_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id),
  query text not null,
  category text,
  municipality text,
  province text default 'Pontevedra',
  status text default 'RUNNING',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  results_found integer default 0,
  new_businesses integer default 0,
  duplicates integer default 0,
  errors integer default 0,
  metadata jsonb default '{}'::jsonb
);

create index if not exists idx_search_runs_municipality
on search_runs(municipality);

create index if not exists idx_search_runs_category
on search_runs(category);

create index if not exists idx_search_runs_started
on search_runs(started_at desc);

-- ============================================================
-- PROSPECTOR BUSINESSES
-- ============================================================

create table if not exists prospector_businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  legal_name text,
  description text,
  phone text,
  phone_normalized text,
  email text,
  website_url text,
  google_place_id text,
  google_maps_url text,
  address text,
  postal_code text,
  municipality text,
  province text default 'Pontevedra',
  country text default 'Spain',
  latitude numeric(10,7),
  longitude numeric(10,7),
  rating numeric(2,1),
  review_count integer,
  estimated_size business_size default 'UNKNOWN',
  estimated_size_confidence numeric(5,2),
  service_area text[] default '{}',
  primary_category text,
  is_active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prospector_businesses_rating_check
    check (rating is null or (rating >= 0 and rating <= 5)),

  constraint prospector_businesses_review_count_check
    check (review_count is null or review_count >= 0),

  constraint prospector_businesses_size_confidence_check
    check (
      estimated_size_confidence is null
      or (
        estimated_size_confidence >= 0
        and estimated_size_confidence <= 100
      )
    )
);

create unique index if not exists uq_prospector_business_google_place
on prospector_businesses(google_place_id)
where google_place_id is not null;

create index if not exists idx_prospector_businesses_normalized_name
on prospector_businesses(normalized_name);

create index if not exists idx_prospector_businesses_municipality
on prospector_businesses(municipality);

create index if not exists idx_prospector_businesses_category
on prospector_businesses(primary_category);

create index if not exists idx_prospector_businesses_size
on prospector_businesses(estimated_size);

create index if not exists idx_prospector_businesses_rating
on prospector_businesses(rating desc);

create index if not exists idx_prospector_businesses_reviews
on prospector_businesses(review_count desc);

-- ============================================================
-- BUSINESS CATEGORIES
-- ============================================================

create table if not exists business_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references prospector_businesses(id) on delete cascade,
  category text not null,
  subcategory text,
  confidence numeric(5,2),
  source_id uuid references sources(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_business_categories_business
on business_categories(business_id);

create index if not exists idx_business_categories_category
on business_categories(category);

-- ============================================================
-- BUSINESS LOCATIONS / COVERAGE
-- ============================================================

create table if not exists business_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references prospector_businesses(id) on delete cascade,
  municipality text not null,
  coverage_type text default 'SERVICE_AREA',
  confidence numeric(5,2),
  source_id uuid references sources(id),
  created_at timestamptz not null default now(),
  unique(business_id, municipality)
);

create index if not exists idx_business_locations_municipality
on business_locations(municipality);

-- ============================================================
-- DIGITAL ASSETS
-- ============================================================

create table if not exists digital_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references prospector_businesses(id) on delete cascade,
  asset_type asset_type not null,
  url text,
  status asset_status default 'UNKNOWN',
  last_checked_at timestamptz,
  last_activity_at timestamptz,
  quality_score numeric(5,2),
  notes text,
  source_id uuid references sources(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_digital_assets_business
on digital_assets(business_id);

create index if not exists idx_digital_assets_type
on digital_assets(asset_type);

create index if not exists idx_digital_assets_status
on digital_assets(status);

-- ============================================================
-- DIGITAL AUDITS
-- ============================================================

create table if not exists digital_audits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references prospector_businesses(id) on delete cascade,
  audit_date timestamptz not null default now(),
  website_exists boolean,
  website_quality numeric(5,2),
  mobile_friendly boolean,
  https_enabled boolean,
  contact_visible boolean,
  phone_visible boolean,
  email_visible boolean,
  whatsapp_visible boolean,
  quote_form boolean,
  portfolio_present boolean,
  services_present boolean,
  location_present boolean,
  cta_present boolean,
  last_content_date date,
  social_presence_score numeric(5,2),
  overall_digital_maturity numeric(5,2),
  audit_version text not null default '1.0',
  raw_findings jsonb default '{}'::jsonb
);

create index if not exists idx_digital_audits_business
on digital_audits(business_id);

create index if not exists idx_digital_audits_date
on digital_audits(audit_date desc);

-- ============================================================
-- BUSINESS SIGNALS
-- ============================================================

create table if not exists business_signals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references prospector_businesses(id) on delete cascade,
  signal_code text not null,
  signal_kind signal_kind not null default 'FACT',
  signal_value jsonb default '{}'::jsonb,
  score numeric(7,2) default 0,
  confidence numeric(5,2),
  source_id uuid references sources(id),
  evidence text,
  observed_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_business_signals_business
on business_signals(business_id);

create index if not exists idx_business_signals_code
on business_signals(signal_code);

create index if not exists idx_business_signals_kind
on business_signals(signal_kind);

-- ============================================================
-- PAIN POINTS
-- ============================================================

create table if not exists pain_points (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references prospector_businesses(id) on delete cascade,
  pain_type text not null,
  confidence numeric(5,2),
  evidence jsonb default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  active boolean default true
);

create index if not exists idx_pain_points_business
on pain_points(business_id);

create index if not exists idx_pain_points_type
on pain_points(pain_type);

-- ============================================================
-- SCORES
-- ============================================================

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references prospector_businesses(id) on delete cascade,
  digital_weakness_score numeric(5,2) not null default 0,
  commercial_potential_score numeric(5,2) not null default 0,
  priority_score numeric(5,2) not null default 0,
  confidence_score numeric(5,2) not null default 0,
  tier text,
  algorithm_version text not null default '1.0',
  score_explanation jsonb default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  unique(business_id, algorithm_version)
);

create index if not exists idx_scores_priority
on scores(priority_score desc);

create index if not exists idx_scores_digital
on scores(digital_weakness_score desc);

create index if not exists idx_scores_commercial
on scores(commercial_potential_score desc);

create index if not exists idx_scores_tier
on scores(tier);

-- ============================================================
-- SCORE HISTORY
-- ============================================================

create table if not exists score_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references prospector_businesses(id) on delete cascade,
  digital_weakness_score numeric(5,2),
  commercial_potential_score numeric(5,2),
  priority_score numeric(5,2),
  confidence_score numeric(5,2),
  tier text,
  algorithm_version text,
  score_explanation jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_score_history_business
on score_history(business_id, created_at desc);

-- ============================================================
-- LEAD STATUS
-- ============================================================

create table if not exists lead_status (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references prospector_businesses(id) on delete cascade,
  status lead_status not null default 'NEW',
  priority text default 'NORMAL',
  next_action text,
  next_action_date date,
  assigned_to uuid,
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_lead_status_status
on lead_status(status);

create index if not exists idx_lead_status_next_action
on lead_status(next_action_date);

-- ============================================================
-- CONTACTS
-- ============================================================

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references prospector_businesses(id) on delete cascade,
  name text,
  role text,
  phone text,
  email text,
  whatsapp text,
  is_primary boolean default false,
  source_id uuid references sources(id),
  confidence numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contacts_business
on contacts(business_id);

-- ============================================================
-- OUTREACH
-- ============================================================

create table if not exists outreach (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references prospector_businesses(id) on delete cascade,
  channel outreach_channel not null,
  action text not null,
  contacted_at timestamptz not null default now(),
  message_template text,
  response text,
  outcome outreach_outcome,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_outreach_business
on outreach(business_id);

create index if not exists idx_outreach_date
on outreach(contacted_at desc);

create index if not exists idx_outreach_outcome
on outreach(outcome);

-- ============================================================
-- VIEW: CURRENT LEAD RANKING
-- ============================================================

create or replace view lead_ranking as
select
  b.id,
  b.name,
  b.primary_category,
  b.municipality,
  b.phone,
  b.email,
  b.website_url,
  b.google_maps_url,
  b.rating,
  b.review_count,
  b.estimated_size,
  s.digital_weakness_score,
  s.commercial_potential_score,
  s.priority_score,
  s.confidence_score,
  s.tier,
  ls.status as lead_status,
  ls.next_action,
  ls.next_action_date
from prospector_businesses b
left join lateral (
  select *
  from scores s2
  where s2.business_id = b.id
  order by s2.calculated_at desc
  limit 1
) s on true
left join lead_status ls
  on ls.business_id = b.id
where b.is_active = true;

-- ============================================================
-- VIEW: TOP 100
-- ============================================================

create or replace view top_100_leads as
select *
from lead_ranking
where confidence_score >= 60
  and coalesce(lead_status, 'NEW') not in (
    'BAD_LEAD',
    'DO_NOT_CONTACT'
  )
order by priority_score desc
limit 100;
