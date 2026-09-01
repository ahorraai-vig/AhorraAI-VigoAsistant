export interface ChatConfig {
  userType?: string;
  timeAvailable: string;
  interests: string[];
  language: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  isBot: boolean;
  sourcesUsed?: string[];
  debugTrace?: any;
  presentation?: any;
}

export interface UserProfile {
  id: string;
  role: 'admin' | 'business';
  full_name: string | null;
  created_at: string;
}

export type DataHonestyState = 'DICHO' | 'OBSERVADO' | 'SIN_CONFIRMAR';

export interface BusinessCooperationProfile {
  idleCapacity: string[]; // mesas libres horas valle, espacio expositivo, excedentes, etc.
  offers: string[]; // bonos cruzados, compra agrupada, degustación, derivación
  needs: string[]; // llenar franjas valle, turistas, fidelización, ahorro costes
  targetAudience: string[]; // vecinos, turistas, trabajadores, familias, etc.
  preferredPartners: string[]; // hostelería, comercio, salud, hoteles, etc.
  valleyHours: string; // ej. "16:00 - 19:30"
  specialProposal?: string;
  image_url?: string;
  cover_image?: string;
}

export interface Business {
  id: string;
  owner_id?: string;
  access_code?: string;
  name: string;
  category?: string;
  description: string | null;
  address: string | null;
  zone?: string; // Casco Vello, Príncipe, Gran Vía, Bouzas, etc.
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  opening_hours: any;
  time_slots?: {
    morning?: string;
    afternoon?: string;
    night?: string;
  };
  honesty_status?: DataHonestyState;
  cooperation?: BusinessCooperationProfile;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SynergyOpportunity {
  id: string;
  businessA_id: string;
  businessA_name: string;
  businessB_id: string;
  businessB_name: string;
  synergyType: 'bono_cruzado' | 'franja_valle' | 'compra_agrupada' | 'derivacion_clientes' | 'pack_experiencia';
  title: string;
  description: string;
  benefitA: string;
  benefitB: string;
  compatibilityScore: number; // 0 - 100
  status: 'sugerida' | 'en_contacto' | 'activa';
  created_at: string;
}

export interface BusinessRewardProfile {
  business_id: string;
  points: number;
  tier: 'Bronce' | 'Plata' | 'Oro' | 'Embajador Vigo';
  referred_count: number;
  referral_code: string;
  history: Array<{
    id: string;
    action: string;
    points: number;
    date: string;
  }>;
}

export interface Conversation {
  id: string;
  session_id: string | null;
  language: string | null;
  time_available: string | null;
  interests: string[];
  created_at: string;
}

