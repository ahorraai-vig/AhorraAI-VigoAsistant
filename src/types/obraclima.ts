/**
 * Domain types for ObraClima Core
 */

export interface ObraClimaConfig {
  id?: string;
  company_name: string;
  companyName?: string; // alias for backwards compatibility
  nif: string;
  address: string;
  postal_code: string;
  postalCode?: string;
  city: string;
  province: string;
  phone: string;
  email: string;
  iban: string;
  payment_method: string;
  paymentMethod?: string;
  default_iva: number;
  defaultIva?: number;
  invoice_series: string;
  invoiceSeries?: string;
  budget_series: string;
  budgetSeries?: string;
  next_invoice_number: number;
  nextInvoiceNumber?: number;
  next_budget_number: number;
  nextBudgetNumber?: number;
}

export interface ObraClimaClient {
  id: string;
  name: string;
  address: string;
  postal_code: string;
  postalCode?: string;
  city: string;
  province: string;
  nif: string;
  phone: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

export interface ObraClimaCatalogOfficialItem {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  iva?: number;
  description_short?: string | null;
  image_url?: string | null;
  source_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type EnrichStatus = 'pending' | 'ok' | 'failed' | 'stale';

export interface ObraClimaCatalogProspectedItem {
  id: string;
  sku: string | null;
  name: string;
  nombre?: string; // alias
  price: number | null;
  precio?: number; // alias
  currency: string;
  moneda?: string;
  category: string | null;
  categoria?: string | null;
  description_raw: string | null;
  description_short: string | null;
  descripcion?: string | null; // alias
  specs: Array<{ key?: string; label?: string; value: string }>;
  origen_url: string;
  image_url: string | null;
  image_cached_path: string | null;
  metodo_extraccion: string | null;
  enrich_status: EnrichStatus;
  enriched_at: string | null;
  fecha_captura: string;
  created_at?: string;
  updated_at?: string;
}

export interface ObraClimaBudgetItem {
  sku?: string | null;
  name?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  source?: 'official' | 'prospected';
}

export interface ObraClimaBudget {
  id: string;
  number: string;
  series: string;
  date?: string;
  client_id?: string | null;
  clientId?: string | null;
  status: 'Borrador' | 'Enviado' | 'Aprobado' | 'Rechazado' | 'Facturado';
  notes?: string;
  items: ObraClimaBudgetItem[];
  subtotal: number;
  tax: number;
  total: number;
  client?: ObraClimaClient | null;
  customer?: ObraClimaClient | null;
  client_snapshot?: Partial<ObraClimaClient> | null;
  pdf_path?: string | null;
  pdfUrl?: string | null;
  converted_to_invoice?: boolean;
  convertedToInvoice?: boolean;
  invoice_reference?: string | null;
  invoiceReference?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ObraClimaInvoice {
  id: string;
  number: string;
  series: string;
  date?: string;
  budget_id?: string | null;
  budget_reference?: string | null;
  budgetReference?: string | null;
  client_id?: string | null;
  clientId?: string | null;
  status: 'Borrador' | 'Emitida' | 'Cobrada' | 'Anulada';
  notes?: string;
  items: ObraClimaBudgetItem[];
  subtotal: number;
  tax: number;
  total: number;
  client?: ObraClimaClient | null;
  customer?: ObraClimaClient | null;
  client_snapshot?: Partial<ObraClimaClient> | null;
  pdf_path?: string | null;
  pdfUrl?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductCardResponse {
  id?: string;
  sku: string | null;
  name: string;
  price: number | null;
  description_short: string | null;
  image: string | null; // cached path or remote URL or null
  image_cached_path?: string | null;
  image_url?: string | null;
  source_url: string;
  source_name: string;
  attach_image: boolean;
  specs?: Array<{ key?: string; label?: string; value: string }>;
}
