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
}

export interface UserProfile {
  id: string;
  role: 'admin' | 'business';
  full_name: string | null;
  created_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  opening_hours: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  session_id: string | null;
  language: string | null;
  time_available: string | null;
  interests: string[];
  created_at: string;
}
