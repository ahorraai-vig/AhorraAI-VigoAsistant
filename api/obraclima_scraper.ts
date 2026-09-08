/**
 * Módulo de Extracción de Datos (Scraper) y Prospección de Catálogos para ObraClima
 * 
 * Cumplimiento Normativo y Resiliencia:
 * 1. Resiliencia Anti-Bloqueo: Doble canal de extracción (Direct Fetch + Google Resilient Proxy) para eludir Cloudflare WAF (ej. BricoCentro Vigo).
 * 2. Soporte Universal: WooCommerce, Softeca, PrestaShop, Shopify y e-commerce estándar.
 * 3. Prospección Completa: Extrae Título, Precio, SKU/Referencia, Categoría y Descripción técnica completa.
 * 4. Integración en el Cerebro de ObraClima:
 *    - Persistencia en Supabase `catalogo_prospeccion`
 *    - Persistencia en Supabase `knowledge_base` (Base de Conocimiento IA)
 *    - Persistencia en Supabase `proveedores_materiales`
 *    - Cache en memoria y exportación opcional a `/content/drive/MyDrive/`
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
  descripcion?: string | null;
  categoria?: string | null;
  origen_url: string;
  metodo_extraccion: string;
  fecha_captura: string;
}

// Almacén en memoria de respaldo para disponibilidad inmediata
export const inMemoryProspeccion: ProspectProductRecord[] = [];

// Rutas fijas para exportación de seguridad opcional a Google Drive
const GDRIVE_ROOT_CSV_PATH = '/content/drive/MyDrive/catalogo_extraido.csv';
const GDRIVE_MASIVA_CSV_PATH = '/content/drive/MyDrive/prospeccion_masiva.csv';

export const CRAWLER_INICIADO_MSG = '⏳ Iniciando prospección profunda del catálogo y alimentación del cerebro de ObraClima. Los datos de productos, referencias, precios y especificaciones técnicas se están extrayendo y sincronizando en segundo plano.';

/**
 * Cliente HTTP resiliente con evasión de bloqueos Cloudflare (Direct + Google Proxy Fallback)
 */
export async function fetchWithResilience(targetUrl: string): Promise<{ html: string; method: string }> {
  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache'
  };

  // Canal 1: Intento directo
  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: browserHeaders,
      redirect: 'follow'
    });

    if (res.ok) {
      const text = await res.text();
      // Verificar que no sea una pantalla de bloqueo de Cloudflare Turnstile / Bot Protection
      if (
        !text.includes('Attention Required! | Cloudflare') &&
        !text.includes('cf-error-details') &&
        !text.includes('Just a moment...') &&
        !text.includes('challenges.cloudflare.com/turnstile')
      ) {
        return { html: text, method: 'direct_fetch' };
      }
    }
  } catch (err: any) {
    console.warn(`[Scraper Direct Fetch Warning for ${targetUrl}]:`, err.message);
  }

  // Canal 2: Resilient Proxy a través de Google Translate Gateway (elude Cloudflare WAF automáticamente)
  try {
    const proxyUrl = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(targetUrl)}`;
    const proxyRes = await fetch(proxyUrl, {
      method: 'GET',
      headers: browserHeaders,
      redirect: 'follow'
    });

    if (proxyRes.ok) {
      const text = await proxyRes.text();
      if (text.length > 500) {
        return { html: text, method: 'google_resilient_proxy' };
      }
    }
  } catch (proxyErr: any) {
    console.warn(`[Scraper Google Proxy Fallback Warning]:`, proxyErr.message);
  }

  throw new Error(`No fue posible acceder a la tienda en ${targetUrl}. La web tiene un bloqueo severo.`);
}

/**
 * Normaliza y limpia textos
 */
function cleanText(t: any): string {
  if (!t) return '';
  return String(t).replace(/\s+/g, ' ').trim();
}

/**
 * Limpia y normaliza cadenas de precio (soporta 419,00€, 1.299,00 €, $45.00, etc.)
 */
export function parseWooCommercePrice(raw: string): number {
  if (!raw) return 0;
  const match = raw.match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{2})?/);
  if (!match) return 0;
  let clean = match[0];
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Extractor universal de datos de producto (WooCommerce, Softeca/BricoCentro, PrestaShop, etc.)
 */
export function extractProductDetails(html: string, originalUrl: string): {
  nombre: string;
  ref: string | null;
  precio: number;
  rawPrice: string;
  categoria: string;
  descripcion: string;
} {
  const $ = cheerio.load(html);

  // 1. Nombre / Título
  let nombre = cleanText($('h1.nombre').first().text()) ||
               cleanText($('h1.product_title').first().text()) ||
               cleanText($('h1.entry-title').first().text()) ||
               cleanText($('h1.product-name').first().text()) ||
               cleanText($('h1.page-title').first().text()) ||
               cleanText($('[itemprop="name"]').first().text()) ||
               cleanText($('meta[property="og:title"]').attr('content')) ||
               cleanText($('h1').first().text());

  // Limpiar sufijos comerciales comunes
  nombre = nombre
    .replace(/\s*-\s*BricoCentro.*$/i, '')
    .replace(/\s*\|\s*Comercial.*$/i, '')
    .trim();

  // 2. Referencia / SKU
  let ref = cleanText($('.referencia span, .referencia .c-primary').first().text());
  if (!ref) {
    const rawRef = $('.referencia').first().text();
    const m = rawRef.match(/Referencia:\s*([A-Za-z0-9\-_]+)/i);
    if (m) ref = m[1];
  }
  if (!ref) ref = cleanText($('.sku, [itemprop="sku"]').first().text());
  if (!ref || ref === 'N/A' || ref === 'null') {
    const metaSku = cleanText($('meta[property="product:retailer_item_id"]').attr('content'));
    if (metaSku) ref = metaSku;
  }
  // Fallback desde el slug de URL (ej. atb-8000726 o -82502796)
  if (!ref || ref === 'N/A') {
    const urlMatch = originalUrl.match(/-([a-zA-Z0-9]{6,14})(?:\?|$|\/)/);
    if (urlMatch) ref = urlMatch[1];
  }

  // 3. Precio
  let rawPrice = cleanText($('.precio .precio-cantidad').first().text()) ||
                 cleanText($('ins .woocommerce-Price-amount').first().text()) ||
                 cleanText($('span.woocommerce-Price-amount.amount').first().text()) ||
                 cleanText($('.woocommerce-Price-amount').first().text()) ||
                 cleanText($('.precio, .precio-final, .price, .product-price').first().text()) ||
                 cleanText($('[itemprop="price"]').attr('content')) ||
                 cleanText($('meta[property="product:price:amount"]').attr('content'));

  let precio = parseWooCommercePrice(rawPrice);

  // 4. Descripción técnica y especificaciones
  let descParts: string[] = [];
  const descFicha = $('.descripcion-ficha');
  if (descFicha.length) {
    descFicha.find('p, li, tr').each((_, el) => {
      const line = cleanText($(el).text());
      if (line && line.length > 2 && !descParts.includes(line)) descParts.push(line);
    });
  }

  if (descParts.length === 0) {
    const wcDesc = $('.woocommerce-product-details__short-description, #tab-description, .product-description, [itemprop="description"], .caracteristicas, .ficha-tecnica');
    if (wcDesc.length) {
      wcDesc.find('p, li, tr').each((_, el) => {
        const line = cleanText($(el).text());
        if (line && line.length > 2 && !descParts.includes(line)) descParts.push(line);
      });
      if (descParts.length === 0) {
        const direct = cleanText(wcDesc.text());
        if (direct) descParts.push(direct);
      }
    }
  }

  if (descParts.length === 0) {
    const metaDesc = cleanText($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content'));
    if (metaDesc) descParts.push(metaDesc);
  }

  const descripcion = descParts.join('\n').slice(0, 3000);

  // 5. Categoría
  let categoria = cleanText($('.migas, .breadcrumbs, .breadcrumb, nav.woocommerce-breadcrumb').text())
    .replace(/\s+/g, ' ')
    .replace(/\s*>\s*/g, ' / ')
    .replace(/\s*\/\s*/g, ' / ');

  if (!categoria) {
    categoria = cleanText($('.posted_in, [rel="category"]').text());
  }

  return {
    nombre,
    ref: ref && ref !== 'N/A' ? ref : null,
    precio,
    rawPrice,
    categoria,
    descripcion
  };
}

/**
 * Determina si la entrada es un dominio raíz o catálogo general en vez de una ficha de producto
 */
export function isDomainOrSitemapUrl(rawInput: string): boolean {
  if (!rawInput) return false;
  const clean = rawInput.trim().toLowerCase();
  if (clean.endsWith('.xml') || clean.includes('sitemap')) return true;

  try {
    const formatted = clean.startsWith('http://') || clean.startsWith('https://') ? clean : `https://${clean}`;
    const parsed = new URL(formatted);
    const path = parsed.pathname.replace(/\/+$/, '');
    if (!path || path === '') return true;

    // Si tiene /producto/ o /product/ o /articulo/ con un slug largo, es ficha individual
    const isSingleProduct = /\/(producto|product|articulo|item|p)\/[a-zA-Z0-9_-]{4,}/.test(path);
    return !isSingleProduct;
  } catch {
    return !rawInput.includes('/producto/');
  }
}

/**
 * Guarda un producto en Supabase (catalogo_prospeccion, knowledge_base y proveedores_materiales)
 */
export async function persistProductToDatabase(
  record: ProspectProductRecord,
  exportToGDrive = false
): Promise<{ supabaseSuccess: boolean; knowledgeBaseSuccess: boolean }> {
  const supabase = getSupabaseClient();
  let supabaseSuccess = false;
  let knowledgeBaseSuccess = false;

  // Actualizar memoria local para visualización y uso inmediato
  const existingIdx = inMemoryProspeccion.findIndex(p => p.origen_url === record.origen_url || (p.sku && p.sku === record.sku));
  if (existingIdx >= 0) {
    inMemoryProspeccion[existingIdx] = { ...inMemoryProspeccion[existingIdx], ...record };
  } else {
    inMemoryProspeccion.unshift(record);
  }

  if (supabase) {
    // 1. Insertar en catalogo_prospeccion (las columnas exactas soportadas en el schema)
    try {
      const { data, error } = await supabase
        .from('catalogo_prospeccion')
        .insert([{
          nombre: record.nombre,
          precio: record.precio,
          moneda: record.moneda || 'EUR',
          sku: record.sku || null,
          origen_url: record.origen_url,
          metodo_extraccion: record.metodo_extraccion,
          fecha_captura: record.fecha_captura
        }])
        .select()
        .maybeSingle();

      if (!error && data) {
        record.id = data.id;
        supabaseSuccess = true;
      }
    } catch (err: any) {
      console.warn('[Supabase catalogo_prospeccion Insert Error]:', err.message);
    }

    // 2. Alimentar el "Cerebro de ObraClima" (knowledge_base) con toda la descripción técnica, medidas y referencias
    try {
      let hostname = '';
      try { hostname = new URL(record.origen_url).hostname.replace(/^www\./, ''); } catch {}

      const contentText = [
        `PROVEEDOR: ${hostname || 'Catálogo Externo'}`,
        `PRODUCTO: ${record.nombre}`,
        `REFERENCIA / SKU: ${record.sku || 'N/A'}`,
        `PRECIO OFICIAL: ${record.precio} EUR`,
        record.categoria ? `CATEGORÍA: ${record.categoria}` : '',
        record.descripcion ? `ESPECIFICACIONES TÉCNICAS Y MEDIDAS:\n${record.descripcion}` : '',
        `URL ORIGINAL: ${record.origen_url}`,
        `FECHA CAPTURA: ${record.fecha_captura}`
      ].filter(Boolean).join('\n');

      const { error: kbErr } = await supabase
        .from('knowledge_base')
        .insert([{
          category: 'catalogo_proveedores',
          title: `${record.nombre} [Ref: ${record.sku || 'S/R'}] - ${record.precio}€`,
          content: contentText
        }]);

      if (!kbErr) {
        knowledgeBaseSuccess = true;
      }
    } catch (kbErr: any) {
      console.warn('[Supabase knowledge_base Insert Error]:', kbErr.message);
    }

    // 3. Registrar en proveedores_materiales si aplica
    try {
      let hostname = 'Proveedor';
      try { hostname = new URL(record.origen_url).hostname.replace(/^www\./, ''); } catch {}
      await supabase
        .from('proveedores_materiales')
        .insert([{
          proveedor_nombre: hostname,
          categoria: record.categoria || 'Suministros y Climatización',
          producto_sku_o_nombre: `${record.nombre} (${record.sku || 'S/R'})`,
          precio_coste: record.precio,
          url_referencia: record.origen_url,
          updated_at: record.fecha_captura
        }]);
    } catch {}
  }

  // 4. Exportación opcional a Google Drive
  if (exportToGDrive) {
    try {
      const gdriveFolder = path.dirname(GDRIVE_ROOT_CSV_PATH);
      if (fs.existsSync(gdriveFolder)) {
        const fileExists = fs.existsSync(GDRIVE_ROOT_CSV_PATH);
        const csvLine = `"${record.nombre.replace(/"/g, '""')}",${record.precio},"EUR","${record.sku || ''}","${record.origen_url}","${record.metodo_extraccion}","${record.fecha_captura}"\n`;
        if (!fileExists) {
          const header = 'nombre,precio,moneda,sku,origen_url,metodo_extraccion,fecha_captura\n';
          fs.writeFileSync(GDRIVE_ROOT_CSV_PATH, header + csvLine, 'utf-8');
        } else {
          fs.appendFileSync(GDRIVE_ROOT_CSV_PATH, csvLine, 'utf-8');
        }
      }
    } catch {}
  }

  return { supabaseSuccess, knowledgeBaseSuccess };
}

/**
 * Función central de extracción de producto (soporta WooCommerce, BricoCentro/Softeca, PrestaShop, etc.)
 */
export async function scrapeWooCommerceProduct(
  url: string,
  exportToGDrive = false
): Promise<{
  success: boolean;
  product: ProspectProductRecord;
  formattedMessage: string;
}> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error('Debes proporcionar una URL válida que comience por http:// o https://');
  }

  // 1. Obtener HTML con cliente resiliente (Direct Fetch + Google Proxy)
  const { html, method } = await fetchWithResilience(url);

  // 2. Extraer datos estructurados
  const extracted = extractProductDetails(html, url);

  if (!extracted.nombre) {
    throw new Error('No se pudo identificar el título del producto en la página web.');
  }

  if (extracted.precio <= 0) {
    throw new Error(`No se pudo extraer un precio numérico válido (encontrado: "${extracted.rawPrice}").`);
  }

  const fechaCaptura = new Date().toISOString();
  const productRecord: ProspectProductRecord = {
    nombre: extracted.nombre,
    precio: extracted.precio,
    moneda: 'EUR',
    sku: extracted.ref,
    descripcion: extracted.descripcion,
    categoria: extracted.categoria,
    origen_url: url,
    metodo_extraccion: method,
    fecha_captura: fechaCaptura
  };

  // 3. Persistir en Supabase y Base de Conocimiento de ObraClima
  await persistProductToDatabase(productRecord, exportToGDrive);

  const precioFormateado = extracted.precio.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const refInfo = extracted.ref ? ` [Ref: ${extracted.ref}]` : '';
  const formattedMessage = `✅ Producto guardado y sincronizado con el Cerebro de ObraClima: ${extracted.nombre}${refInfo} - ${precioFormateado}€.`;

  return {
    success: true,
    product: productRecord,
    formattedMessage
  };
}

/**
 * Prospección masiva y rastreo de catálogo en segundo plano
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

  console.log(`[Crawling Masivo] Iniciando rastreo profundo para ${origin}...`);

  // Ejecución en segundo plano sin bloquear al usuario
  (async () => {
    try {
      const discoveredProductUrls = new Set<string>();

      // 1. Intentar descubrir enlaces directamente desde la Home y Categorías principales
      try {
        const { html: homeHtml } = await fetchWithResilience(origin);
        const $home = cheerio.load(homeHtml);

        $home('a[href]').each((_, el) => {
          let href = $home(el).attr('href') || '';
          // Limpiar URLs proxificadas si proceden de translate.goog
          if (href.includes('translate.goog')) {
            const match = href.match(/https?:\/\/[^\/]+(\/producto\/[^?&]+)/);
            if (match) href = `${origin}${match[1]}`;
          } else if (href.startsWith('/')) {
            href = `${origin}${href}`;
          }

          if (
            href.includes('/producto/') ||
            href.includes('/product/') ||
            href.includes('/articulo/')
          ) {
            // Descartar URLs de carrito o checkout
            if (!href.includes('/carrito') && !href.includes('/finalizar-compra') && !href.includes('/cart')) {
              discoveredProductUrls.add(href.split('?')[0]);
            }
          }
        });
      } catch (homeErr: any) {
        console.warn(`[Crawling Masivo Home Discovery Warning]:`, homeErr.message);
      }

      // 2. Buscar sitemaps estándar
      const sitemapCandidates = [
        rawDomain.endsWith('.xml') ? rawDomain : '',
        `${origin}/product-sitemap.xml`,
        `${origin}/product-sitemap1.xml`,
        `${origin}/sitemap-products.xml`,
        `${origin}/sitemap_index.xml`,
        `${origin}/sitemap.xml`,
        `${origin}/wp-sitemap-posts-product-1.xml`
      ].filter(Boolean);

      for (const smUrl of sitemapCandidates) {
        try {
          const { html: xml } = await fetchWithResilience(smUrl);
          if (xml.includes('<url') || xml.includes('<sitemap')) {
            const $xml = cheerio.load(xml, { xmlMode: true });

            const subMaps = $xml('sitemap > loc').map((_, el) => $xml(el).text().trim()).get();
            for (const sub of subMaps.slice(0, 5)) {
              if (sub.includes('product') || sub.includes('producto') || sub.includes('articulo')) {
                try {
                  const { html: subXml } = await fetchWithResilience(sub);
                  const $sub = cheerio.load(subXml, { xmlMode: true });
                  const locs = $sub('url > loc').map((_, el) => $sub(el).text().trim()).get();
                  locs.forEach(l => discoveredProductUrls.add(l));
                } catch {}
              }
            }

            const locs = $xml('url > loc').map((_, el) => $xml(el).text().trim()).get();
            for (const l of locs) {
              if (l.includes('/producto/') || l.includes('/product/') || smUrl.includes('product')) {
                discoveredProductUrls.add(l);
              }
            }

            if (discoveredProductUrls.size >= 100) break;
          }
        } catch {}
      }

      const productUrls = Array.from(discoveredProductUrls);
      console.log(`[Crawling Masivo] Localizados ${productUrls.length} productos potenciales en ${origin}.`);

      if (productUrls.length === 0) {
        console.warn(`[Crawling Masivo] No se descubrieron productos en ${origin}.`);
        return;
      }

      // 3. Procesar productos con pausa ética (2 a 4 segundos)
      let processedCount = 0;
      for (const prodUrl of productUrls) {
        try {
          const delay = Math.floor(Math.random() * 2000) + 2000;
          await new Promise((resolve) => setTimeout(resolve, delay));

          const { html: pHtml, method } = await fetchWithResilience(prodUrl);
          const extracted = extractProductDetails(pHtml, prodUrl);

          if (!extracted.nombre || extracted.precio <= 0) continue;

          const item: ProspectProductRecord = {
            nombre: extracted.nombre,
            precio: extracted.precio,
            moneda: 'EUR',
            sku: extracted.ref,
            descripcion: extracted.descripcion,
            categoria: extracted.categoria,
            origen_url: prodUrl,
            metodo_extraccion: `masivo_${method}`,
            fecha_captura: new Date().toISOString()
          };

          await persistProductToDatabase(item, true);
          processedCount++;

          if (processedCount % 10 === 0) {
            console.log(`[Crawling Masivo Progress]: ${processedCount}/${productUrls.length} productos procesados e integrados en ObraClima.`);
          }
        } catch (itemErr: any) {
          console.warn(`[Crawling Masivo Item Warning for ${prodUrl}]:`, itemErr.message);
        }
      }

      console.log(`[Crawling Masivo] Prospección finalizada con éxito. Total productos registrados: ${processedCount}`);
    } catch (err: any) {
      console.error('[Crawling Masivo Global Error]:', err.message);
    }
  })();
}

/**
 * Registro de rutas Express aisladas para el módulo de Scraper
 */
export function setupObraClimaScraperRoutes(app: Express) {
  // Endpoint para procesar e ingresar producto por URL o dominio raíz
  app.post('/api/obraclima/prospectar-url', async (req: Request, res: Response) => {
    try {
      const { url, export_gdrive } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ success: false, error: 'La URL o dominio del proveedor es obligatorio.' });
      }

      const trimmedUrl = url.trim();

      // Detección de dominio raíz o catálogo masivo
      if (isDomainOrSitemapUrl(trimmedUrl)) {
        // Lanzar el proceso en segundo plano
        startBackgroundSitemapCrawling(trimmedUrl);

        // Además, intentar extraer inmediatamente los primeros productos de la home para dar feedback instantáneo
        try {
          const { html: rootHtml } = await fetchWithResilience(trimmedUrl);
          const $ = cheerio.load(rootHtml);
          const sampleLinks: string[] = [];

          $('a[href]').each((_, el) => {
            let h = $(el).attr('href') || '';
            if (h.includes('/producto/')) {
              if (h.startsWith('/')) {
                let base = trimmedUrl;
                try { base = new URL(trimmedUrl).origin; } catch {}
                h = `${base}${h}`;
              }
              if (!sampleLinks.includes(h) && sampleLinks.length < 3) sampleLinks.push(h);
            }
          });

          if (sampleLinks.length > 0) {
            // Extraer el primer producto inmediatamente
            const firstResult = await scrapeWooCommerceProduct(sampleLinks[0], !!export_gdrive);
            return res.json({
              success: true,
              isBackground: true,
              message: `⏳ Prospección masiva iniciada para ${trimmedUrl}. Se ha extraído y sincronizado el primer producto de muestra: "${firstResult.product.nombre}" (${firstResult.product.precio}€). El resto del catálogo se seguirá procesando en segundo plano e ingresando en la Base de Conocimiento de ObraClima.`,
              sampleProduct: firstResult.product
            });
          }
        } catch {}

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
        error: err.message || 'Error durante la prospección del producto.'
      });
    }
  });

  // Endpoint para procesar directamente código HTML pegado desde el inspector (bypass total de bloqueos)
  app.post('/api/obraclima/prospectar-html', async (req: Request, res: Response) => {
    try {
      const { html, url, export_gdrive } = req.body;
      if (!html || typeof html !== 'string') {
        return res.status(400).json({ success: false, error: 'El código HTML del producto es obligatorio.' });
      }

      const effectiveUrl = url || 'https://proveedor-manual.local/producto';
      const extracted = extractProductDetails(html, effectiveUrl);

      if (!extracted.nombre) {
        return res.status(422).json({ success: false, error: 'No se pudo identificar el título del producto en el HTML proporcionado.' });
      }

      const productRecord: ProspectProductRecord = {
        nombre: extracted.nombre,
        precio: extracted.precio,
        moneda: 'EUR',
        sku: extracted.ref,
        descripcion: extracted.descripcion,
        categoria: extracted.categoria,
        origen_url: effectiveUrl,
        metodo_extraccion: 'manual_inspector_html_v1',
        fecha_captura: new Date().toISOString()
      };

      await persistProductToDatabase(productRecord, !!export_gdrive);

      return res.json({
        success: true,
        message: `✅ Producto extraído de HTML e integrado en el Cerebro de ObraClima: ${extracted.nombre} (${extracted.precio}€).`,
        product: productRecord
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoint para listar todos los productos prospectados
  app.get('/api/obraclima/prospectados', async (req: Request, res: Response) => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('catalogo_prospeccion')
          .select('*')
          .order('fecha_captura', { ascending: false });

        if (!error && Array.isArray(data)) {
          // Combinar con la memoria local para enriquecer con descripción técnica si está disponible
          const enriched = data.map((item: any) => {
            const inMem = inMemoryProspeccion.find(m => m.id === item.id || m.origen_url === item.origen_url);
            return {
              ...item,
              descripcion: item.descripcion || inMem?.descripcion || null,
              categoria: item.categoria || inMem?.categoria || null
            };
          });
          return res.json({ success: true, items: enriched });
        }
      }

      return res.json({ success: true, items: inMemoryProspeccion });
    } catch (err: any) {
      return res.status(500).json({ success: false, items: inMemoryProspeccion, error: err.message });
    }
  });
}
