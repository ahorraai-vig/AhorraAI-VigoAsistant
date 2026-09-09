export type BusinessSize =
  | "SOLO"
  | "MICRO_2_3"
  | "SMALL_4_10"
  | "SMALL_11_20"
  | "MEDIUM"
  | "UNKNOWN";

export type AssetType =
  | "WEBSITE"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "LINKEDIN"
  | "YOUTUBE"
  | "TIKTOK"
  | "WHATSAPP"
  | "GOOGLE_BUSINESS"
  | "OTHER";

export type AssetStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "NOT_FOUND"
  | "BROKEN"
  | "UNKNOWN";

export type SignalKind =
  | "FACT"
  | "INFERENCE";

export type LeadStatus =
  | "NEW"
  | "QUALIFIED"
  | "CONTACTED"
  | "RESPONDED"
  | "INTERESTED"
  | "DEMO"
  | "PROPOSAL"
  | "CUSTOMER"
  | "NOT_INTERESTED"
  | "NO_RESPONSE"
  | "BAD_LEAD"
  | "DO_NOT_CONTACT"
  | "OPT_OUT_RGPD";

export type OutreachChannel =
  | "PHONE"
  | "WHATSAPP"
  | "EMAIL"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "IN_PERSON"
  | "OTHER";

export type OutreachOutcome =
  | "NO_ANSWER"
  | "ANSWERED"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "CALL_BACK"
  | "DEMO_BOOKED"
  | "PROPOSAL_REQUESTED"
  | "CUSTOMER"
  | "WRONG_NUMBER"
  | "DO_NOT_CONTACT"
  | "OTHER";

export type SourceType =
  | "GOOGLE_PLACES"
  | "GOOGLE_SEARCH"
  | "PUBLIC_DIRECTORY"
  | "BUSINESS_WEBSITE"
  | "SOCIAL_MEDIA"
  | "OPEN_DATA"
  | "MANUAL"
  | "OTHER";

export interface Business {
  id: string;
  name: string;
  normalized_name: string;
  legal_name?: string | null;
  description?: string | null;
  phone?: string | null;
  phone_normalized?: string | null;
  email?: string | null;
  website_url?: string | null;
  google_place_id?: string | null;
  google_maps_url?: string | null;
  address?: string | null;
  postal_code?: string | null;
  municipality?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  review_count?: number | null;
  estimated_size: BusinessSize;
  estimated_size_confidence?: number | null;
  service_area: string[];
  primary_category?: string | null;
  is_active: boolean;
  is_demo?: boolean;
  source_provider?: "SERPAPI_MAPS" | "GOOGLE_PLACES" | "SUPABASE_DB" | "MANUAL" | string;
  supabase_business_id?: string | null;
  synced_to_supabase?: boolean;
  rgpd_legal_basis?: string | null;
  rgpd_source?: string | null;
  rgpd_opt_out?: boolean;
  rgpd_opt_out_date?: string | null;
  rgpd_notes?: string | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessCategory {
  id: string;
  business_id: string;
  category: string;
  subcategory?: string | null;
  confidence?: number | null;
  source_id?: string | null;
  created_at: string;
}

export interface BusinessLocation {
  id: string;
  business_id: string;
  municipality: string;
  coverage_type: string;
  confidence?: number | null;
  source_id?: string | null;
  created_at: string;
}

export interface DigitalAsset {
  id: string;
  business_id: string;
  asset_type: AssetType;
  url?: string | null;
  status: AssetStatus;
  last_checked_at?: string | null;
  last_activity_at?: string | null;
  quality_score?: number | null;
  notes?: string | null;
  source_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DigitalAudit {
  id: string;
  business_id: string;
  audit_date: string;
  website_exists?: boolean | null;
  website_quality?: number | null;
  mobile_friendly?: boolean | null;
  https_enabled?: boolean | null;
  contact_visible?: boolean | null;
  phone_visible?: boolean | null;
  email_visible?: boolean | null;
  whatsapp_visible?: boolean | null;
  quote_form?: boolean | null;
  portfolio_present?: boolean | null;
  services_present?: boolean | null;
  location_present?: boolean | null;
  cta_present?: boolean | null;
  last_content_date?: string | null;
  social_presence_score?: number | null;
  overall_digital_maturity?: number | null;
  audit_version: string;
  raw_findings: Record<string, unknown>;
}

export interface BusinessSignal {
  id: string;
  business_id: string;
  signal_code: string;
  signal_kind: SignalKind;
  signal_value: Record<string, unknown>;
  score: number;
  confidence?: number | null;
  source_id?: string | null;
  evidence?: string | null;
  observed_at: string;
  expires_at?: string | null;
}

export interface PainPoint {
  id: string;
  business_id: string;
  pain_type: string;
  confidence?: number | null;
  evidence: Record<string, unknown>;
  detected_at: string;
  active: boolean;
}

export interface ScoreContribution {
  code: string;
  points: number;
  reason: string;
}

export interface ScoreExplanation {
  digital: {
    raw: number;
    contributions: ScoreContribution[];
  };
  commercial: {
    raw: number;
    contributions: ScoreContribution[];
  };
  adjustments: ScoreContribution[];
  final: number;
}

export interface Score {
  id: string;
  business_id: string;
  digital_weakness_score: number;
  commercial_potential_score: number;
  priority_score: number;
  confidence_score: number;
  tier?: string | null;
  algorithm_version: string;
  score_explanation: ScoreExplanation;
  calculated_at: string;
}

export interface ScoreHistory {
  id: string;
  business_id: string;
  digital_weakness_score: number;
  commercial_potential_score: number;
  priority_score: number;
  confidence_score: number;
  tier?: string | null;
  algorithm_version?: string | null;
  score_explanation?: ScoreExplanation | null;
  created_at: string;
}

export interface LeadRanking extends Business {
  digital_weakness_score?: number;
  commercial_potential_score?: number;
  priority_score?: number;
  confidence_score?: number;
  tier?: string | null;
  lead_status?: LeadStatus | null;
  next_action?: string | null;
  next_action_date?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
  supabase_business_id?: string | null;
  synced_to_supabase?: boolean;
}

export interface Contact {
  id: string;
  business_id: string;
  name?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  is_primary: boolean;
  source_id?: string | null;
  confidence?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Outreach {
  id: string;
  business_id: string;
  channel: OutreachChannel;
  action: string;
  contacted_at: string;
  message_template?: string | null;
  response?: string | null;
  outcome?: OutreachOutcome | null;
  notes?: string | null;
  created_at: string;
}

export interface SearchRun {
  id: string;
  source_id?: string | null;
  query: string;
  category?: string | null;
  municipality?: string | null;
  province?: string;
  status: string;
  started_at: string;
  finished_at?: string | null;
  results_found: number;
  new_businesses: number;
  duplicates: number;
  errors: number;
  metadata?: Record<string, unknown>;
}

export interface Source {
  id: string;
  source_type: SourceType;
  source_name: string;
  base_url?: string | null;
  terms_url?: string | null;
  active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface AIEnrichmentResult {
  businessClassification: {
    primaryCategory: string;
    subcategories: string[];
    confidence: number;
  };
  estimatedSize: {
    value: BusinessSize;
    confidence: number;
    evidence: string[];
  };
  serviceArea: {
    municipalities: string[];
    confidence: number;
  };
  digitalAudit: {
    websiteExists: boolean | null;
    websiteQuality: number | null;
    mobileFriendly: boolean | null;
    httpsEnabled: boolean | null;
    contactVisible: boolean | null;
    phoneVisible: boolean | null;
    emailVisible: boolean | null;
    whatsappVisible: boolean | null;
    quoteForm: boolean | null;
    portfolioPresent: boolean | null;
    servicesPresent: boolean | null;
    locationPresent: boolean | null;
    ctaPresent: boolean | null;
    socialPresenceScore: number | null;
    findings: string[];
  };
  signals: {
    code: string;
    kind: "FACT" | "INFERENCE";
    confidence: number;
    evidence: string;
    value?: Record<string, unknown>;
  }[];
  painPoints: {
    type: string;
    confidence: number;
    evidence: string;
  }[];
}
