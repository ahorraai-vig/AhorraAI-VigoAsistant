import crypto from 'crypto';
import { getSupabaseServerClient, getProspectedItemById, updateProspectedItem } from './repo';
import type { ObraClimaCatalogProspectedItem, ProductCardResponse } from '../../../src/types/obraclima';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB ceiling for single product image

/**
 * Checks if the image is valid and appropriate for rich display in Telegram Mini App.
 * Prevents UI layout collapse, giant data URIs, or broken SVG references.
 */
export function shouldAttachImage(item: {
  image_url?: string | null;
  image_cached_path?: string | null;
}): boolean {
  const url = item.image_cached_path || item.image_url;
  if (!url || typeof url !== 'string') return false;

  const clean = url.trim();
  if (clean.length === 0) return false;

  // Reject overly large data URI
  if (clean.startsWith('data:')) {
    return clean.length < 50000;
  }

  // Valid http or https URL
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    return false;
  }

  return true;
}

/**
 * Resolves a unified, clean product card representation for Mini App & Admin
 */
export function resolveProductCard(item: any): ProductCardResponse {
  const isProspected = !!item.origen_url || !item.code;
  let sourceName = 'ObraClima Tarifas';

  if (item.origen_url) {
    try {
      sourceName = new URL(item.origen_url).hostname.replace(/^www\./, '');
    } catch {
      sourceName = 'Proveedor Externo';
    }
  }

  const attach_image = shouldAttachImage(item);
  const finalImage = item.image_cached_path || (attach_image ? item.image_url : null);

  const descShort =
    item.description_short ||
    (item.descripcion ? item.descripcion.slice(0, 300) : null) ||
    (item.description_raw ? item.description_raw.slice(0, 300) : null);

  return {
    id: item.id,
    sku: item.sku || item.code || null,
    name: item.name || item.nombre || 'Producto',
    price: item.price !== undefined && item.price !== null ? Number(item.price) : (item.precio !== undefined ? Number(item.precio) : null),
    description_short: descShort,
    image: finalImage,
    image_cached_path: item.image_cached_path || null,
    image_url: item.image_url || null,
    source_url: item.origen_url || item.source_url || '',
    source_name: sourceName,
    attach_image,
    specs: Array.isArray(item.specs) ? item.specs : []
  };
}

/**
 * On-demand cache of a single product image to Supabase Storage bucket 'obraclima-media'.
 * Downloads binary ONLY on first explicit request (no bulk crawls).
 */
export async function cacheProductImageOnDemand(
  productId: string,
  remoteImageUrl?: string
): Promise<{ success: boolean; cachedUrl?: string; error?: string }> {
  try {
    const item = await getProspectedItemById(productId);
    const targetUrl = remoteImageUrl || item?.image_url;

    if (!targetUrl || !targetUrl.startsWith('http')) {
      return { success: false, error: 'URL de imagen remota no válida para cachear' };
    }

    if (item?.image_cached_path) {
      return { success: true, cachedUrl: item.image_cached_path };
    }

    // 1. Fetch remote image binary safely with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return { success: false, error: `Error HTTP al descargar imagen: ${resp.status}` };
    }

    const contentType = resp.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || 'image/jpeg';
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return { success: false, error: `Tipo de contenido no soportado: ${contentType}` };
    }

    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      return { success: false, error: 'La imagen excede el límite de 5 MB' };
    }

    // 2. Upload to Supabase Storage if configured
    const supabase = getSupabaseServerClient();
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const fileHash = crypto.createHash('md5').update(targetUrl).digest('hex').slice(0, 12);
    const storagePath = `products/${productId || 'item'}_${fileHash}.${ext}`;

    if (supabase) {
      const { error: uploadError } = await supabase.storage
        .from('obraclima-media')
        .upload(storagePath, buffer, {
          contentType,
          upsert: true
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('obraclima-media')
          .getPublicUrl(storagePath);

        const publicUrl = publicUrlData?.publicUrl;
        if (publicUrl && item?.id) {
          await updateProspectedItem(item.id, {
            image_cached_path: publicUrl
          });
        }
        return { success: true, cachedUrl: publicUrl || storagePath };
      } else {
        console.warn('[Storage upload warning]:', uploadError.message);
      }
    }

    // Fallback: return remote targetUrl if storage bucket is not yet active
    if (item?.id) {
      await updateProspectedItem(item.id, {
        image_cached_path: targetUrl
      });
    }
    return { success: true, cachedUrl: targetUrl };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
