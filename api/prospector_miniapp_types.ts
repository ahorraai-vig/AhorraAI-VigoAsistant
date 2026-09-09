export interface LeadMiniAppConfig {
  token: string;
  accessCode: string;
  appName: string;
  appTagline: string;
  brandColor: string;
  brandSecondaryColor: string;
  appInitials: string;
  sector: string;
  companyName: string;
  cif?: string;
  address: string;
  municipality: string;
  phone?: string;
  email?: string;
  whatsappUrl?: string;
  assistantTitle: string;
  assistantSubtitle: string;
  assistantDescription: string;
  sampleInputPlaceholder: string;
  quickExamples: Array<{ title: string; description: string; query: string }>;
  catalog: Array<{
    id: string;
    sku: string;
    name: string;
    category: string;
    description: string;
    unit: string;
    price: number;
    recommended?: boolean;
  }>;
  defaultIva: number;
  tabs: string[];
  features: string[];
  telegramStartUrl: string;
  directWebUrl: string;
  isDeployedToTelegram?: boolean;
  deployedAt?: string;
  deploymentStatus?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  generatedAt: string;
}

export interface LeadWebsitePrototype {
  leadId: string;
  businessName: string;
  municipality: string;
  primaryCategory: string;
  tagline: string;
  headline: string;
  subheadline: string;
  heroCtaText: string;
  heroBadge: string;
  phone?: string;
  address?: string;
  email?: string;
  rating?: number;
  reviewCount?: number;
  aboutStory: string;
  yearsInBusiness?: string;
  services: Array<{
    id: string;
    title: string;
    description: string;
    badge?: string;
    features?: string[];
  }>;
  whyChooseUs: Array<{
    title: string;
    description: string;
  }>;
  testimonials: Array<{
    name: string;
    location: string;
    rating: number;
    comment: string;
    service: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  colorTheme: {
    primary: string;
    secondary: string;
    accent: string;
  };
  telegramMiniAppUrl?: string;
  previewUrl: string;
  isDeployedToTelegram?: boolean;
  deployedAt?: string;
  generatedAt: string;
}
