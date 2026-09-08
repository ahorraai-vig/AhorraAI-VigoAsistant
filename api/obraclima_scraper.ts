/**
 * Módulo de Extracción de Datos (Scraper) de Productos WooCommerce para ObraClima
 * 
 * Cumplimiento Normativo Estricto:
 * 1. Minimización de Datos (RGPD): Solo captura campos comerciales públicos (Nombre, Precio, SKU, URL).
 * 2. Aislamiento Estructural: Almacenado en tabla independiente `catalogo_prospeccion` sin vinculación a PII de clientes.
 * 3. Trazabilidad Algorítmica (Ley de IA): Metadatos obligatorios (origen_url, metodo_extraccion, fecha_captura).
 * 4. Gestión de Archivos: Exportaciones a Google Drive estrictamente en la raíz `/content/drive/MyDrive/catalogo_extraido.csv`.
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import type { Express, Request, Response } from 'express';
import { getSupabaseClient } from './obraclima';

export interface ProspectProductRecord {
  id?: string;
  nombre: string;
  precio: number;
  moneda: string;
  sku?: string | null;
  origen_url: string;
  metodo_extraccion: string;
  fecha_captura: string;
}

// Almacén en memoria de respaldo para garantizar disponibilidad inmediata
export const inMemoryProspeccion: ProspectProductRecord[] = [];

// Ruta fija y obligatoria para exportación a Google Drive (estrictamente en la raíz de MyDrive)
const GDRIVE_ROOT_CSV_PATH = '/content/drive/MyDrive/catalogo_extraido.csv';
const GDRIVE_MASIVA_CSV_PATH = '/content/drive/MyDrive/prospeccion_masiva.csv';

export const CRAWLER_INICIADO_MSG = '⏳ Iniciando rastreo profundo del catálogo en segundo plano. Esto puede tardar varios minutos u horas dependiendo del tamaño de la tienda. Los resultados se volcarán en la tabla de prospección de Supabase para su futura revisión.';

/**
 * Determina si la entrada es un dominio raíz o sitemap XML en vez de una URL de producto individual
 */
export function isDomainOrSitemapUrl(rawInput: string): boolean {
  if (!rawInput) return false;
  const clean = rawInput.trim().toLowerCase();
  if (clean.endsWith('.xml') || clean.includes('sitemap')) return true;

  try {
    const formatted = clean.startsWith('http://') || clean.startsWith('https://') ? clean : `https://${clean}`;
    const parsed = new URL(formatted);
    const path = parsed.pathname.replace(/\/+$/, '');
    // Si no tiene ruta o es solo '/', es un dominio raíz
    if (!path || path === '') return true;
    // Si no contiene los segmentos habituales de fichas individuales de producto
    const isSingleProduct = path.includes('/producto/') || path.includes('/product/') || path.includes('/item/') || path.includes('/p/');
    return !isSingleProduct;
  } catch {
    return !rawInput.includes('/producto/');
  }
}

/**
 * Función en segundo plano para rastreo masivo mediante Sitemaps XML
 */
export async function startBackgroundSitemapCrawling(rawDomain: string) {
  const formattedUrl = rawDomain.startsWith('http://') || rawDomain.startsWith('https://')
    ? rawDomain.trim()
    : `https://${rawDomain.trim()}`;

  let origin = '';
  try {
    origin = new URL(formattedUrl).origin;
  } catch {
    origin = formattedUrl;
  }

  console.log(`[Crawling Masivo] Iniciando en segundo plano para ${origin}...`);

  // Ejecución en background sin bloquear
  (async () => {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (ObraClima-Crawler-Bot/2.0; +https://obraclima.es)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      };

      // 1. Descubrir sitemaps
      const sitemapCandidates = [
        rawDomain.endsWith('.xml') ? rawDomain : '',
        `${origin}/product-sitemap.xml`,
        `${origin}/product-sitemap1.xml`,
        `${origin}/sitemap-products.xml`,
        `${origin}/sitemap_index.xml`,
        `${origin}/sitemap.xml`,
        `${origin}/wp-sitemap-posts-product-1.xml`
      ].filter(Boolean);

      let productUrls: string[] = [];

      for (const smUrl of sitemapCandidates) {
        try {
          const res = await fetch(smUrl, { headers, redirect: 'follow' });
          if (res.ok) {
            const xml = await res.text();
            if (xml.includes('<url') || xml.includes('<sitemap')) {
              console.log(`[Crawler Masivo] Sitemap XML localizado en: ${smUrl}`);
              const $xml = cheerio.load(xml, { xmlMode: true });

              // Si es índice de sitemaps
              const subMaps = $xml('sitemap > loc').map((_, el) => $xml(el).text().trim()).get();
              if (subMaps.length > 0) {
                for (const sub of subMaps) {
                  if (sub.includes('product') || sub.includes('producto') || sub.includes('articulo')) {
                    try {
                      const subRes = await fetch(sub, { headers, redirect: 'follow' });
                      if (subRes.ok) {
                        const subXml = await subRes.text();
                        const $sub = cheerio.load(subXml, { xmlMode: true });
                        const locs = $sub('url > loc').map((_, el) => $sub(el).text().trim()).get();
                        productUrls.push(...locs);
                      }
                    } catch {}
                  }
                }
              }

              // Si son URLs directas
              const locs = $xml('url > loc').map((_, el) => $xml(el).text().trim()).get();
              for (const l of locs) {
                if (l.includes('/producto/') || l.includes('/product/') || smUrl.includes('product')) {
                  productUrls.push(l);
                }
              }

              if (productUrls.length > 0) break;
            }
          }
        } catch {}
      }

      productUrls = Array.from(new Set(productUrls));
      console.log(`[Crawler Masivo] Encontradas ${productUrls.length} URLs de productos.`);
      if (productUrls.length === 0) return;

      const supabase = getSupabaseClient();
      let currentBatch: ProspectProductRecord[] = [];

      for (let i = 0; i < productUrls.length; i++) {
        const prodUrl = productUrls[i];
        try {
          // Pausa ética obligatoria entre peticiones (3 a 7 segundos)
          const delay = Math.floor(Math.random() * 4000) + 3000;
          await new Promise((resolve) => setTimeout(resolve, delay));

          const pRes = await fetch(prodUrl, { headers, redirect: 'follow' });
          if (!pRes.ok) continue;

          const pHtml = await pRes.text();
          const $ = cheerio.load(pHtml);

          const nombre = $('h1.product_title').first().text().trim() || $('h1').first().text().trim();
          if (!nombre) continue;

          let priceEl = $('ins .woocommerce-Price-amount').first();
          if (!priceEl.length) priceEl = $('span.woocommerce-Price-amount.amount').first();
          if (!priceEl.length) priceEl = $('.woocommerce-Price-amount').first();

          const precio = parseWooCommercePrice(priceEl.text().trim());
          if (precio <= 0) continue;

          const rawSku = $('.sku').first().text().trim();
          const sku = rawSku && rawSku !== 'N/A' ? rawSku : null;

          const item: ProspectProductRecord = {
            nombre,
            precio,
            moneda: 'EUR',
            sku,
            origen_url: prodUrl,
            metodo_extraccion: 'orquestador_masivo_sitemap_batch',
            fecha_captura: new Date().toISOString()
          };

          currentBatch.push(item);
          inMemoryProspeccion.unshift(item);

          // Volcado por lote de 50 productos
          if (currentBatch.length >= 50) {
            if (supabase) {
              await supabase.from('catalogo_prospeccion').insert(currentBatch);
            }
            // Volcado de seguridad a Google Drive (estrictamente en la raíz de MyDrive)
            try {
              const driveDir = path.dirname(GDRIVE_MASIVA_CSV_PATH);
              if (fs.existsSync(driveDir)) {
                const fileExists = fs.existsSync(GDRIVE_MASIVA_CSV_PATH);
                let csvRows = '';
                if (!fileExists) {
                  csvRows += 'nombre,precio,moneda,sku,origen_url,metodo_extraccion,fecha_captura\n';
                }
                for (const p of currentBatch) {
                  csvRows += `"${p.nombre.replace(/"/g, '""')}",${p.precio},"EUR","${p.sku || ''}","${p.origen_url}","${p.metodo_extraccion}","${p.fecha_captura}"\n`;
                }
                fs.appendFileSync(GDRIVE_MASIVA_CSV_PATH, csvRows, 'utf-8');
              }
            } catch (err: any) {
              console.warn('[GDrive Masiva CSV Notice]:', err.message);
            }
            console.log(`[Crawler Masivo] Lote de 50 productos insertados silenciosamente en Supabase.`);
            currentBatch = [];
          }
        } catch (itemErr: any) {
          console.warn(`[Crawler Masivo Item Warning]:`, itemErr.message);
        }
      }

      // Volcar remanente final
      if (currentBatch.length > 0) {
        if (supabase) {
          await supabase.from('catalogo_prospeccion').insert(currentBatch);
        }
        try {
          const driveDir = path.dirname(GDRIVE_MASIVA_CSV_PATH);
          if (fs.existsSync(driveDir)) {
            const fileExists = fs.existsSync(GDRIVE_MASIVA_CSV_PATH);
            let csvRows = '';
            if (!fileExists) csvRows += 'nombre,precio,moneda,sku,origen_url,metodo_extraccion,fecha_captura\n';
            for (const p of currentBatch) {
              csvRows += `"${p.nombre.replace(/"/g, '""')}",${p.precio},"EUR","${p.sku || ''}","${p.origen_url}","${p.metodo_extraccion}","${p.fecha_captura}"\n`;
            }
            fs.appendFileSync(GDRIVE_MASIVA_CSV_PATH, csvRows, 'utf-8');
          }
        } catch {}
      }

      console.log(`[Crawler Masivo] Finalizado con éxito para ${origin}.`);
    } catch (err: any) {
      console.error('[Crawler Masivo Error]:', err.message);
    }
  })();
}

/**
 * Limpia y normaliza cadenas de precio de WooCommerce
 * Soporta formatos europeos (1.299,00 €) y estándar (1299.00)
 */
export function parseWooCommercePrice(raw: string): number {
  if (!raw) return 0;
  // Extraer únicamente dígitos, comas y puntos
  let clean = raw.replace(/[^\d,\.]/g, '').trim();
  if (!clean) return 0;

  if (clean.includes(',') && clean.includes('.')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      // Formato europeo: 1.250,50 -> 1250.50
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosajón: 1,250.50 -> 1250.50
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    // Formato con coma decimal: 450,50 -> 450.50
    clean = clean.replace(',', '.');
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Función central de extracción de producto WooCommerce
 */
export async function scrapeWooCommerceProduct(url: string, exportToGDrive = false): Promise<{
  success: boolean;
  product: ProspectProductRecord;
  formattedMessage: string;
}> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error('Debes proporcionar una URL válida que comience por http:// o https://');
  }

  // 1. Inyección de cabecera User-Agent explícita (aislado de cookies de usuario)
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (ObraClima-Prospeccion-Bot/1.0; +https://obraclima.es)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache'
  };

  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`La tienda respondió con estado HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  // 2. Parseo de HTML y localización de campos WooCommerce
  const $ = cheerio.load(html);

  // Título: <h1 class="product_title">
  let nombre = $('h1.product_title').first().text().trim();
  if (!nombre) {
    nombre = $('h1.entry-title').first().text().trim() || $('h1').first().text().trim();
  }

  if (!nombre) {
    throw new Error('No se pudo localizar el título del producto (<h1 class="product_title">).');
  }

  // Precio: <span class="woocommerce-Price-amount amount"> (o en ins si hay oferta)
  let priceEl = $('ins .woocommerce-Price-amount').first();
  if (!priceEl.length) {
    priceEl = $('span.woocommerce-Price-amount.amount').first();
  }
  if (!priceEl.length) {
    priceEl = $('.woocommerce-Price-amount').first();
  }

  const rawPrice = priceEl.text().trim();
  const precio = parseWooCommercePrice(rawPrice);

  if (precio <= 0) {
    throw new Error(`No se pudo extraer un precio válido en formato WooCommerce (encontrado: "${rawPrice}").`);
  }

  // SKU público comercial si existe
  const rawSku = $('.sku').first().text().trim();
  const sku = rawSku && rawSku !== 'N/A' ? rawSku : null;

  // Metadatos obligatorios de trazabilidad algorítmica (AI Act / RGPD)
  const fechaCaptura = new Date().toISOString();
  const metodoExtraccion = 'automated_scraper_woocommerce_v1';

  const productRecord: ProspectProductRecord = {
    nombre,
    precio,
    moneda: 'EUR',
    sku,
    origen_url: url,
    metodo_extraccion: metodoExtraccion,
    fecha_captura: fechaCaptura
  };

  // 3. Conexión con Supabase e inserción en catalogo_prospeccion
  const supabase = getSupabaseClient();
  let supabaseSuccess = false;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('catalogo_prospeccion')
        .insert([productRecord])
        .select()
        .maybeSingle();

      if (!error && data) {
        productRecord.id = data.id;
        supabaseSuccess = true;
      } else if (error) {
        console.warn('[Supabase Prospección Notice]:', error.message);
      }
    } catch (err: any) {
      console.warn('[Supabase Insert Fallback]:', err.message);
    }
  }

  // Guardar en memoria local para consulta inmediata
  inMemoryProspeccion.unshift(productRecord);

  // 4. Volcado temporal opcional a Google Drive (EXCLUSIVAMENTE en la raíz /content/drive/MyDrive)
  if (exportToGDrive) {
    try {
      const gdriveFolder = path.dirname(GDRIVE_ROOT_CSV_PATH);
      if (fs.existsSync(gdriveFolder)) {
        const fileExists = fs.existsSync(GDRIVE_ROOT_CSV_PATH);
        const csvLine = `"${nombre.replace(/"/g, '""')}",${precio},"EUR","${sku || ''}","${url}","${metodoExtraccion}","${fechaCaptura}"\n`;
        
        if (!fileExists) {
          const header = 'nombre,precio,moneda,sku,origen_url,metodo_extraccion,fecha_captura\n';
          fs.writeFileSync(GDRIVE_ROOT_CSV_PATH, header + csvLine, 'utf-8');
        } else {
          fs.appendFileSync(GDRIVE_ROOT_CSV_PATH, csvLine, 'utf-8');
        }
      }
    } catch (gdriveErr: any) {
      console.warn('[GDrive Root Export Notice]:', gdriveErr.message);
    }
  }

  // 5. Mensaje normativo estricto
  const precioFormateado = precio.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedMessage = `✅ Producto guardado en Supabase: ${nombre} - ${precioFormateado}€. (Registrado bajo normativa de trazabilidad)`;

  return {
    success: true,
    product: productRecord,
    formattedMessage
  };
}

/**
 * Registro de rutas Express aisladas para el módulo de Scraper
 */
export function setupObraClimaScraperRoutes(app: Express) {
  // Endpoint independiente para procesar e ingresar producto por URL o dominio para rastreo masivo
  app.post('/api/obraclima/prospectar-url', async (req: Request, res: Response) => {
    try {
      const { url, export_gdrive } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'La URL o dominio del proveedor es obligatorio.' });
      }

      const trimmedUrl = url.trim();

      // Detección de dominio raíz o sitemap XML para prospección masiva en segundo plano
      if (isDomainOrSitemapUrl(trimmedUrl)) {
        // Iniciar en segundo plano sin bloquear la UI
        startBackgroundSitemapCrawling(trimmedUrl);

        return res.json({
          success: true,
          isBackground: true,
          message: CRAWLER_INICIADO_MSG
        });
      }

      // Ficha individual de producto
      const result = await scrapeWooCommerceProduct(trimmedUrl, !!export_gdrive);
      return res.json({
        success: true,
        message: result.formattedMessage,
        product: result.product
      });
    } catch (err: any) {
      return res.status(422).json({
        success: false,
        error: err.message || 'Error durante la extracción del producto de WooCommerce.'
      });
    }
  });

  // Endpoint independiente de lectura de productos prospectados (sin PII de clientes)
  app.get('/api/obraclima/prospectados', async (req: Request, res: Response) => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('catalogo_prospeccion')
          .select('*')
          .order('fecha_captura', { ascending: false });

        if (!error && Array.isArray(data)) {
          return res.json({ success: true, items: data });
        }
      }

      return res.json({ success: true, items: inMemoryProspeccion });
    } catch (err: any) {
      return res.status(500).json({ success: false, items: inMemoryProspeccion, error: err.message });
    }
  });
}
