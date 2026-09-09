import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type {
  ObraClimaConfig,
  ObraClimaClient,
  ObraClimaCatalogOfficialItem,
  ObraClimaCatalogProspectedItem,
  ObraClimaBudget,
  ObraClimaInvoice,
  EnrichStatus
} from '../../../src/types/obraclima';

let warnedFallback = false;

// Fallback in-memory database if Supabase is not configured
export const inMemoryDb = {
  config: {
    id: 'cfg-default',
    company_name: 'OBRA-CLIMA S.L.',
    companyName: 'OBRA-CLIMA S.L.',
    nif: 'B75571059',
    address: 'RÚA ESCULTOR NOGUEIRA, Nº 4-BAJO',
    postal_code: '36205',
    postalCode: '36205',
    city: 'VIGO',
    province: 'PONTEVEDRA',
    phone: '+34 986 000 000',
    email: 'info@obraclima.es',
    iban: 'ES39 2080 5025 3130 4004 4857',
    payment_method: 'Transferencia Bancaria.',
    paymentMethod: 'Transferencia Bancaria.',
    default_iva: 21,
    defaultIva: 21,
    invoice_series: '2026',
    invoiceSeries: '2026',
    budget_series: '2026',
    budgetSeries: '2026',
    next_invoice_number: 29,
    nextInvoiceNumber: 29,
    next_budget_number: 49,
    nextBudgetNumber: 49
  } as ObraClimaConfig,

  clients: [
    {
      id: 'c1000000-0000-0000-0000-000000000001',
      name: 'Mari Carmen Alonso Vicente',
      address: 'C/ Julio Xesto nº 2, Segundo C',
      postal_code: '36770',
      postalCode: '36770',
      city: 'O Rosal',
      province: 'Pontevedra',
      nif: '76891822Q',
      phone: '',
      email: ''
    },
    {
      id: 'c2000000-0000-0000-0000-000000000002',
      name: 'Iria Dominguez Valladares',
      address: 'Rua Pastoriza 12',
      postal_code: '36900',
      postalCode: '36900',
      city: 'Marin',
      province: 'Pontevedra',
      nif: '77417846F',
      phone: '',
      email: ''
    }
  ] as ObraClimaClient[],

  catalogOfficial: [
    { id: 'AC001', code: 'AC001', name: 'Instalación split básico con canaleta y soportes', category: 'Instalación', unit: 'ud', price: 180, iva: 21 },
    { id: 'EQ001', code: 'EQ001', name: 'Suministro de 2 maquinas de aire acondicionado marca FREEO de 3,5 kw y 5 kw', category: 'Equipos', unit: 'ud', price: 1500, iva: 21 },
    { id: 'SRV001', code: 'SRV001', name: 'Mantenimiento preventivo anual de equipos de climatización', category: 'Servicios', unit: 'ud', price: 120, iva: 21 },
    { id: 'EQ002', code: 'EQ002', name: 'Split Daikin Sensira 3.5 kW frío/calor A++', category: 'Equipos', unit: 'ud', price: 650, iva: 21 },
    { id: 'MAT001', code: 'MAT001', name: 'Línea frigorífica de cobre aislado y cableado hasta 5m', category: 'Material', unit: 'ml', price: 45, iva: 21 }
  ] as ObraClimaCatalogOfficialItem[],

  catalogProspected: [] as ObraClimaCatalogProspectedItem[],

  budgets: [
    {
      id: 'b-demo-1',
      number: '048/26',
      series: '2026',
      date: new Date(Date.now() - 86400000 * 3).toISOString(),
      status: 'Aprobado',
      client_id: 'c1000000-0000-0000-0000-000000000001',
      client: {
        id: 'c1000000-0000-0000-0000-000000000001',
        name: 'Mari Carmen Alonso Vicente',
        address: 'C/ Julio Xesto nº 2, Segundo C',
        postal_code: '36770',
        city: 'O Rosal',
        province: 'Pontevedra',
        nif: '76891822Q',
        phone: '',
        email: ''
      },
      items: [
        { description: 'Suministro de 2 maquinas de aire acondicionado marca FREEO de 3,5 kw y 5 kw', quantity: 1, unitPrice: 1500, unit: 'ud' },
        { description: 'Instalación split básico con canaleta y soportes', quantity: 2, unitPrice: 180, unit: 'ud' }
      ],
      subtotal: 1860,
      tax: 390.6,
      total: 2250.6,
      notes: 'Instalación en salón y dormitorio. Incluye prueba de estanqueidad y vacío.'
    }
  ] as ObraClimaBudget[],

  invoices: [] as ObraClimaInvoice[]
};

/**
 * Server-only Supabase Service Role client.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '')?.replace(/\/$/, '') ||
    process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    return createSupabaseClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
  }

  if (!warnedFallback) {
    console.warn(
      '⚠️ [ObraClima Repo Warning] Supabase no está configurado (falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY). Usando almacenamiento seguro en memoria como fallback.'
    );
    warnedFallback = true;
  }
  return null;
}

// ============================================================
// 1. CONFIG REPOSITORY
// ============================================================

export async function getConfig(): Promise<ObraClimaConfig> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          companyName: data.company_name,
          postalCode: data.postal_code,
          paymentMethod: data.payment_method,
          defaultIva: Number(data.default_iva),
          invoiceSeries: data.invoice_series,
          budgetSeries: data.budget_series,
          nextInvoiceNumber: data.next_invoice_number,
          nextBudgetNumber: data.next_budget_number
        };
      }
    } catch (err: any) {
      console.warn('[getConfig fallback error]:', err.message);
    }
  }
  return inMemoryDb.config;
}

export async function updateConfig(updates: Partial<ObraClimaConfig>): Promise<ObraClimaConfig> {
  const supabase = getSupabaseServerClient();
  const current = await getConfig();

  const mappedUpdates: any = {
    company_name: updates.company_name || updates.companyName || current.company_name,
    nif: updates.nif || current.nif,
    address: updates.address || current.address,
    postal_code: updates.postal_code || updates.postalCode || current.postal_code,
    city: updates.city || current.city,
    province: updates.province || current.province,
    phone: updates.phone || current.phone,
    email: updates.email || current.email,
    iban: updates.iban || current.iban,
    payment_method: updates.payment_method || updates.paymentMethod || current.payment_method,
    default_iva: updates.default_iva ?? updates.defaultIva ?? current.default_iva,
    invoice_series: updates.invoice_series || updates.invoiceSeries || current.invoice_series,
    budget_series: updates.budget_series || updates.budgetSeries || current.budget_series,
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      let query;
      if (current.id) {
        query = supabase.from('obraclima_config').update(mappedUpdates).eq('id', current.id);
      } else {
        query = supabase.from('obraclima_config').upsert([mappedUpdates]);
      }
      const { data, error } = await query.select().single();
      if (!error && data) {
        return {
          ...data,
          companyName: data.company_name,
          postalCode: data.postal_code,
          paymentMethod: data.payment_method,
          defaultIva: Number(data.default_iva),
          invoiceSeries: data.invoice_series,
          budgetSeries: data.budget_series,
          nextInvoiceNumber: data.next_invoice_number,
          nextBudgetNumber: data.next_budget_number
        };
      }
    } catch (err: any) {
      console.warn('[updateConfig fallback error]:', err.message);
    }
  }

  inMemoryDb.config = { ...inMemoryDb.config, ...updates, ...mappedUpdates };
  return inMemoryDb.config;
}

/**
 * Atomically increments and returns the next budget number and formatted code (e.g. "049/26")
 */
export async function getAndIncrementNextBudgetNumber(): Promise<{ number: string; nextNumber: number; series: string }> {
  const supabase = getSupabaseServerClient();
  const config = await getConfig();
  const series = config.budget_series || config.budgetSeries || '2026';
  const currentNum = config.next_budget_number || config.nextBudgetNumber || 49;
  const nextNum = currentNum + 1;

  if (supabase && config.id) {
    try {
      const { error } = await supabase
        .from('obraclima_config')
        .update({ next_budget_number: nextNum, updated_at: new Date().toISOString() })
        .eq('id', config.id);

      if (!error) {
        const formatted = `${currentNum.toString().padStart(3, '0')}/${series.slice(-2)}`;
        return { number: formatted, nextNumber: nextNum, series };
      }
    } catch (err: any) {
      console.warn('[getAndIncrementNextBudgetNumber fallback]:', err.message);
    }
  }

  // In-memory fallback
  const formatted = `${currentNum.toString().padStart(3, '0')}/${series.slice(-2)}`;
  inMemoryDb.config.next_budget_number = nextNum;
  inMemoryDb.config.nextBudgetNumber = nextNum;
  return { number: formatted, nextNumber: nextNum, series };
}

/**
 * Atomically increments and returns the next invoice number and formatted code (e.g. "029/26")
 */
export async function getAndIncrementNextInvoiceNumber(): Promise<{ number: string; nextNumber: number; series: string }> {
  const supabase = getSupabaseServerClient();
  const config = await getConfig();
  const series = config.invoice_series || config.invoiceSeries || '2026';
  const currentNum = config.next_invoice_number || config.nextInvoiceNumber || 29;
  const nextNum = currentNum + 1;

  if (supabase && config.id) {
    try {
      const { error } = await supabase
        .from('obraclima_config')
        .update({ next_invoice_number: nextNum, updated_at: new Date().toISOString() })
        .eq('id', config.id);

      if (!error) {
        const formatted = `${currentNum.toString().padStart(3, '0')}/${series.slice(-2)}`;
        return { number: formatted, nextNumber: nextNum, series };
      }
    } catch (err: any) {
      console.warn('[getAndIncrementNextInvoiceNumber fallback]:', err.message);
    }
  }

  // In-memory fallback
  const formatted = `${currentNum.toString().padStart(3, '0')}/${series.slice(-2)}`;
  inMemoryDb.config.next_invoice_number = nextNum;
  inMemoryDb.config.nextInvoiceNumber = nextNum;
  return { number: formatted, nextNumber: nextNum, series };
}

// ============================================================
// 2. CLIENTS REPOSITORY
// ============================================================

export async function getClients(): Promise<ObraClimaClient[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_clients')
        .select('*')
        .order('name');

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((c) => ({
          ...c,
          postalCode: c.postal_code || ''
        }));
      }
    } catch (err: any) {
      console.warn('[getClients fallback error]:', err.message);
    }
  }
  return inMemoryDb.clients;
}

export async function getClientById(id: string): Promise<ObraClimaClient> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_clients')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          postalCode: data.postal_code || ''
        };
      }
    } catch (err: any) {
      console.warn('[getClientById fallback error]:', err.message);
    }
  }

  const found = inMemoryDb.clients.find((c) => c.id === id);
  if (found) return found;

  return inMemoryDb.clients[0] || {
    id: 'c-default',
    name: 'Cliente Particular',
    address: 'Vigo',
    postal_code: '36200',
    postalCode: '36200',
    city: 'Vigo',
    province: 'Pontevedra',
    nif: '',
    phone: '',
    email: ''
  };
}

export async function createClient(client: Partial<ObraClimaClient>): Promise<ObraClimaClient> {
  const newClient: ObraClimaClient = {
    id: client.id || crypto.randomUUID(),
    name: client.name || 'Cliente Particular',
    address: client.address || '',
    postal_code: client.postal_code || client.postalCode || '',
    postalCode: client.postal_code || client.postalCode || '',
    city: client.city || 'Vigo',
    province: client.province || 'Pontevedra',
    nif: client.nif || '',
    phone: client.phone || '',
    email: client.email || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_clients')
        .insert([{
          id: newClient.id,
          name: newClient.name,
          address: newClient.address,
          postal_code: newClient.postal_code,
          city: newClient.city,
          province: newClient.province,
          nif: newClient.nif,
          phone: newClient.phone,
          email: newClient.email
        }])
        .select()
        .single();

      if (!error && data) {
        return { ...data, postalCode: data.postal_code };
      }
    } catch (err: any) {
      console.warn('[createClient fallback error]:', err.message);
    }
  }

  inMemoryDb.clients.unshift(newClient);
  return newClient;
}

// ============================================================
// 3. OFFICIAL CATALOG REPOSITORY
// ============================================================

export async function getOfficialCatalog(): Promise<ObraClimaCatalogOfficialItem[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_catalog_official')
        .select('*')
        .order('name');

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((item) => ({
          ...item,
          price: Number(item.price),
          iva: 21
        }));
      }
    } catch (err: any) {
      console.warn('[getOfficialCatalog fallback error]:', err.message);
    }
  }
  return inMemoryDb.catalogOfficial;
}

export async function createOfficialCatalogItem(
  item: Partial<ObraClimaCatalogOfficialItem>
): Promise<ObraClimaCatalogOfficialItem> {
  const newItem: ObraClimaCatalogOfficialItem = {
    id: item.id || crypto.randomUUID(),
    code: item.code || `PR-${Math.floor(1000 + Math.random() * 9000)}`,
    name: item.name || '',
    category: item.category || 'General',
    price: Number(item.price) || 0,
    unit: item.unit || 'ud',
    iva: 21,
    description_short: item.description_short || null,
    image_url: item.image_url || null,
    source_url: item.source_url || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_catalog_official')
        .insert([{
          id: newItem.id,
          code: newItem.code,
          name: newItem.name,
          category: newItem.category,
          price: newItem.price,
          unit: newItem.unit,
          description_short: newItem.description_short,
          image_url: newItem.image_url,
          source_url: newItem.source_url
        }])
        .select()
        .single();

      if (!error && data) {
        return { ...data, price: Number(data.price), iva: 21 };
      }
    } catch (err: any) {
      console.warn('[createOfficialCatalogItem fallback error]:', err.message);
    }
  }

  inMemoryDb.catalogOfficial.unshift(newItem);
  return newItem;
}

// ============================================================
// 4. PROSPECTED CATALOG REPOSITORY (Cerebro IA)
// ============================================================

export async function getProspectedCatalog(): Promise<ObraClimaCatalogProspectedItem[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_catalog_prospected')
        .select('*')
        .order('fecha_captura', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((p) => ({
          ...p,
          nombre: p.name,
          precio: p.price ? Number(p.price) : null,
          price: p.price ? Number(p.price) : null,
          moneda: p.currency,
          categoria: p.category,
          descripcion: p.description_short || p.description_raw,
          specs: Array.isArray(p.specs) ? p.specs : []
        }));
      }
    } catch (err: any) {
      console.warn('[getProspectedCatalog fallback error]:', err.message);
    }
  }
  return inMemoryDb.catalogProspected;
}

export async function getProspectedItemById(id: string): Promise<ObraClimaCatalogProspectedItem | null> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_catalog_prospected')
        .select('*')
        .or(`id.eq.${id},sku.eq.${id},origen_url.eq.${id}`)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          nombre: data.name,
          precio: data.price ? Number(data.price) : null,
          price: data.price ? Number(data.price) : null,
          moneda: data.currency,
          categoria: data.category,
          descripcion: data.description_short || data.description_raw,
          specs: Array.isArray(data.specs) ? data.specs : []
        };
      }
    } catch (err: any) {
      console.warn('[getProspectedItemById fallback error]:', err.message);
    }
  }

  const found = inMemoryDb.catalogProspected.find(
    (p) => p.id === id || p.sku === id || p.origen_url === id
  );
  return found || null;
}

export async function upsertProspectedItem(
  item: Partial<ObraClimaCatalogProspectedItem> & { origen_url: string; name: string }
): Promise<ObraClimaCatalogProspectedItem> {
  const record: ObraClimaCatalogProspectedItem = {
    id: item.id || crypto.randomUUID(),
    sku: item.sku || null,
    name: item.name || (item as any).nombre || 'Producto',
    nombre: item.name || (item as any).nombre || 'Producto',
    price: item.price !== undefined ? item.price : ((item as any).precio ?? null),
    precio: item.price !== undefined ? item.price : ((item as any).precio ?? null),
    currency: item.currency || 'EUR',
    moneda: item.currency || 'EUR',
    category: item.category || (item as any).categoria || null,
    categoria: item.category || (item as any).categoria || null,
    description_raw: item.description_raw || (item as any).descripcion || null,
    description_short: item.description_short || (item as any).descripcion?.slice(0, 400) || null,
    descripcion: item.description_short || item.description_raw || (item as any).descripcion || null,
    specs: item.specs || [],
    origen_url: item.origen_url,
    image_url: item.image_url || null,
    image_cached_path: item.image_cached_path || null,
    metodo_extraccion: item.metodo_extraccion || 'direct',
    enrich_status: item.enrich_status || 'ok',
    enriched_at: item.enriched_at || new Date().toISOString(),
    fecha_captura: item.fecha_captura || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_catalog_prospected')
        .upsert([{
          sku: record.sku,
          name: record.name,
          price: record.price,
          currency: record.currency,
          category: record.category,
          description_raw: record.description_raw,
          description_short: record.description_short,
          specs: record.specs,
          origen_url: record.origen_url,
          image_url: record.image_url,
          image_cached_path: record.image_cached_path,
          metodo_extraccion: record.metodo_extraccion,
          enrich_status: record.enrich_status,
          enriched_at: record.enriched_at,
          fecha_captura: record.fecha_captura,
          updated_at: record.updated_at
        }], {
          onConflict: 'origen_url,sku'
        })
        .select()
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          nombre: data.name,
          precio: data.price ? Number(data.price) : null,
          price: data.price ? Number(data.price) : null,
          moneda: data.currency,
          categoria: data.category,
          descripcion: data.description_short || data.description_raw
        };
      }
    } catch (err: any) {
      console.warn('[upsertProspectedItem fallback error]:', err.message);
    }
  }

  // In-memory update or insert
  const idx = inMemoryDb.catalogProspected.findIndex(
    (p) => p.origen_url === record.origen_url && (p.sku === record.sku || (!p.sku && !record.sku))
  );
  if (idx >= 0) {
    inMemoryDb.catalogProspected[idx] = { ...inMemoryDb.catalogProspected[idx], ...record };
    return inMemoryDb.catalogProspected[idx];
  } else {
    inMemoryDb.catalogProspected.unshift(record);
    return record;
  }
}

export async function updateProspectedItem(
  id: string,
  updates: Partial<ObraClimaCatalogProspectedItem>
): Promise<ObraClimaCatalogProspectedItem | null> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const mapped: any = { ...updates, updated_at: new Date().toISOString() };
      delete mapped.nombre;
      delete mapped.precio;
      delete mapped.descripcion;

      const { data, error } = await supabase
        .from('obraclima_catalog_prospected')
        .update(mapped)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          nombre: data.name,
          precio: data.price ? Number(data.price) : null,
          price: data.price ? Number(data.price) : null,
          descripcion: data.description_short || data.description_raw
        };
      }
    } catch (err: any) {
      console.warn('[updateProspectedItem fallback error]:', err.message);
    }
  }

  const idx = inMemoryDb.catalogProspected.findIndex((p) => p.id === id);
  if (idx >= 0) {
    inMemoryDb.catalogProspected[idx] = { ...inMemoryDb.catalogProspected[idx], ...updates };
    return inMemoryDb.catalogProspected[idx];
  }
  return null;
}

// ============================================================
// 5. BUDGETS REPOSITORY
// ============================================================

export async function getBudgets(): Promise<ObraClimaBudget[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_budgets')
        .select('*, client:obraclima_clients(*)')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((b) => ({
          ...b,
          clientId: b.client_id,
          customer: b.client || b.client_snapshot,
          convertedToInvoice: b.converted_to_invoice,
          invoiceReference: b.invoice_reference
        }));
      }
    } catch (err: any) {
      console.warn('[getBudgets fallback error]:', err.message);
    }
  }
  return inMemoryDb.budgets;
}

export async function getBudgetById(id: string): Promise<ObraClimaBudget | null> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_budgets')
        .select('*, client:obraclima_clients(*)')
        .or(`id.eq.${id},number.eq.${id}`)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          clientId: data.client_id,
          customer: data.client || data.client_snapshot,
          convertedToInvoice: data.converted_to_invoice,
          invoiceReference: data.invoice_reference
        };
      }
    } catch (err: any) {
      console.warn('[getBudgetById fallback error]:', err.message);
    }
  }

  return inMemoryDb.budgets.find((b) => b.id === id || b.number === id) || null;
}

export async function createBudget(data: Partial<ObraClimaBudget>): Promise<ObraClimaBudget> {
  const { number, series } = await getAndIncrementNextBudgetNumber();

  let subtotal = 0;
  const items = (data.items || []).map((item: any) => {
    const q = Number(item.quantity) || 1;
    const p = Number(item.unitPrice ?? item.price) || 0;
    subtotal += q * p;
    return {
      sku: item.sku || null,
      name: item.name || item.description || 'Partida de trabajo',
      description: item.description || item.name || 'Partida de trabajo',
      quantity: q,
      unitPrice: p,
      unit: item.unit || 'ud',
      source: item.source || 'official'
    };
  });

  const config = await getConfig();
  const ivaRate = Number(config.default_iva || config.defaultIva || 21);
  const tax = subtotal * (ivaRate / 100);
  const total = subtotal + tax;

  const client = data.client || data.customer || null;
  const clientId = data.client_id || data.clientId || client?.id || null;

  const newBudget: ObraClimaBudget = {
    id: data.id || crypto.randomUUID(),
    number,
    series,
    date: data.date || new Date().toISOString(),
    status: data.status || 'Borrador',
    client_id: clientId,
    clientId,
    client,
    customer: client,
    client_snapshot: client,
    items,
    subtotal,
    tax,
    total,
    notes: data.notes || '',
    pdf_path: data.pdf_path || null,
    converted_to_invoice: false,
    convertedToInvoice: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data: inserted, error } = await supabase
        .from('obraclima_budgets')
        .insert([{
          id: newBudget.id,
          number: newBudget.number,
          series: newBudget.series,
          client_id: newBudget.client_id,
          status: newBudget.status,
          notes: newBudget.notes,
          items: newBudget.items,
          subtotal: newBudget.subtotal,
          tax: newBudget.tax,
          total: newBudget.total,
          client_snapshot: newBudget.client_snapshot,
          pdf_path: newBudget.pdf_path,
          converted_to_invoice: false
        }])
        .select('*, client:obraclima_clients(*)')
        .single();

      if (!error && inserted) {
        return {
          ...inserted,
          clientId: inserted.client_id,
          customer: inserted.client || inserted.client_snapshot
        };
      }
    } catch (err: any) {
      console.warn('[createBudget fallback error]:', err.message);
    }
  }

  inMemoryDb.budgets.unshift(newBudget);
  return newBudget;
}

export async function updateBudget(id: string, updates: Partial<ObraClimaBudget>): Promise<ObraClimaBudget | null> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const mapped: any = { ...updates, updated_at: new Date().toISOString() };
      delete mapped.client;
      delete mapped.customer;
      delete mapped.clientId;
      delete mapped.convertedToInvoice;
      delete mapped.invoiceReference;

      const { data, error } = await supabase
        .from('obraclima_budgets')
        .update(mapped)
        .eq('id', id)
        .select('*, client:obraclima_clients(*)')
        .single();

      if (!error && data) {
        return {
          ...data,
          clientId: data.client_id,
          customer: data.client || data.client_snapshot
        };
      }
    } catch (err: any) {
      console.warn('[updateBudget fallback error]:', err.message);
    }
  }

  const idx = inMemoryDb.budgets.findIndex((b) => b.id === id);
  if (idx >= 0) {
    inMemoryDb.budgets[idx] = { ...inMemoryDb.budgets[idx], ...updates };
    return inMemoryDb.budgets[idx];
  }
  return null;
}

// ============================================================
// 6. INVOICES REPOSITORY
// ============================================================

export async function getInvoices(): Promise<ObraClimaInvoice[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_invoices')
        .select('*, client:obraclima_clients(*)')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((i) => ({
          ...i,
          clientId: i.client_id,
          customer: i.client || i.client_snapshot,
          budgetReference: i.budget_reference
        }));
      }
    } catch (err: any) {
      console.warn('[getInvoices fallback error]:', err.message);
    }
  }
  return inMemoryDb.invoices;
}

export async function getInvoiceById(id: string): Promise<ObraClimaInvoice | null> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('obraclima_invoices')
        .select('*, client:obraclima_clients(*)')
        .or(`id.eq.${id},number.eq.${id}`)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          clientId: data.client_id,
          customer: data.client || data.client_snapshot,
          budgetReference: data.budget_reference
        };
      }
    } catch (err: any) {
      console.warn('[getInvoiceById fallback error]:', err.message);
    }
  }

  return inMemoryDb.invoices.find((i) => i.id === id || i.number === id) || null;
}

export async function createInvoice(data: Partial<ObraClimaInvoice>): Promise<ObraClimaInvoice> {
  const { number, series } = await getAndIncrementNextInvoiceNumber();

  let subtotal = 0;
  const items = (data.items || []).map((item: any) => {
    const q = Number(item.quantity) || 1;
    const p = Number(item.unitPrice ?? item.price) || 0;
    subtotal += q * p;
    return {
      sku: item.sku || null,
      name: item.name || item.description || 'Partida de trabajo',
      description: item.description || item.name || 'Partida de trabajo',
      quantity: q,
      unitPrice: p,
      unit: item.unit || 'ud',
      source: item.source || 'official'
    };
  });

  const config = await getConfig();
  const ivaRate = Number(config.default_iva || config.defaultIva || 21);
  const tax = subtotal * (ivaRate / 100);
  const total = subtotal + tax;

  const client = data.client || data.customer || null;
  const clientId = data.client_id || data.clientId || client?.id || null;

  const newInvoice: ObraClimaInvoice = {
    id: data.id || crypto.randomUUID(),
    number,
    series,
    date: data.date || new Date().toISOString(),
    budget_id: data.budget_id || null,
    budget_reference: data.budget_reference || data.budgetReference || null,
    budgetReference: data.budget_reference || data.budgetReference || null,
    client_id: clientId,
    clientId,
    client,
    customer: client,
    client_snapshot: client,
    status: data.status || 'Emitida',
    notes: data.notes || '',
    items,
    subtotal,
    tax,
    total,
    pdf_path: data.pdf_path || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data: inserted, error } = await supabase
        .from('obraclima_invoices')
        .insert([{
          id: newInvoice.id,
          number: newInvoice.number,
          series: newInvoice.series,
          budget_id: newInvoice.budget_id,
          budget_reference: newInvoice.budget_reference,
          client_id: newInvoice.client_id,
          status: newInvoice.status,
          notes: newInvoice.notes,
          items: newInvoice.items,
          subtotal: newInvoice.subtotal,
          tax: newInvoice.tax,
          total: newInvoice.total,
          client_snapshot: newInvoice.client_snapshot,
          pdf_path: newInvoice.pdf_path
        }])
        .select('*, client:obraclima_clients(*)')
        .single();

      if (!error && inserted) {
        return {
          ...inserted,
          clientId: inserted.client_id,
          customer: inserted.client || inserted.client_snapshot
        };
      }
    } catch (err: any) {
      console.warn('[createInvoice fallback error]:', err.message);
    }
  }

  inMemoryDb.invoices.unshift(newInvoice);
  return newInvoice;
}

export async function convertBudgetToInvoice(budgetId: string): Promise<ObraClimaInvoice | null> {
  const budget = await getBudgetById(budgetId);
  if (!budget) return null;

  if (budget.converted_to_invoice || budget.convertedToInvoice) {
    const existing = inMemoryDb.invoices.find(
      (i) => i.budget_reference === budget.number || i.budgetReference === budget.number
    );
    if (existing) return existing;
  }

  const invoice = await createInvoice({
    budget_id: budget.id,
    budget_reference: budget.number,
    budgetReference: budget.number,
    client: budget.client || budget.customer,
    client_id: budget.client_id || budget.clientId,
    items: budget.items,
    notes: budget.notes
  });

  await updateBudget(budget.id, {
    converted_to_invoice: true,
    convertedToInvoice: true,
    invoice_reference: invoice.number,
    invoiceReference: invoice.number,
    status: 'Facturado'
  });

  return invoice;
}
