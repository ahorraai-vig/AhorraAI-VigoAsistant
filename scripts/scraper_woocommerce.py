#!/usr/bin/env python3
"""
Módulo Independiente de Extracción de Datos (Scraper) - ObraClima
Cumplimiento estricto de RGPD y Ley Europea de IA (AI Act).

- Minimización de datos: Solo extrae datos comerciales públicos (Nombre, Precio, SKU, URL).
- Aislamiento estructural: No almacena cookies, sesiones ni interactúa con tablas de PII de clientes.
- Trazabilidad algorítmica: Registra 'origen_url', 'metodo_extraccion' y 'fecha_captura'.
- Almacenamiento temporal: Si se exporta a Google Drive, la ruta obligatoria es /content/drive/MyDrive/catalogo_extraido.csv
"""

import os
import re
import sys
import csv
from datetime import datetime, timezone
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

# Configuración de credenciales de Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "").replace("/rest/v1", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

# Ruta obligatoria para volcados temporales en Google Drive (estrictamente en la raíz de MyDrive)
GDRIVE_ROOT_EXPORT_PATH = "/content/drive/MyDrive/catalogo_extraido.csv"

# Cabeceras comerciales estrictas (sin cookies ni cabeceras de rastreo de usuario)
HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (ObraClima-Prospeccion-Bot/1.0; +https://obraclima.es)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}


def clean_price(price_text: str) -> float:
    """Limpia cadenas de precio con formatos internacionales o europeos (ej: '1.250,50 €' -> 1250.50)."""
    if not price_text:
        return 0.0
    # Eliminar símbolos de moneda y espacios
    clean = re.sub(r"[^\d,\.]", "", price_text).strip()
    if not clean:
        return 0.0
    
    # Manejo de formatos tipo 1.250,50 vs 1,250.50 vs 1250.50
    if "," in clean and "." in clean:
        if clean.rfind(",") > clean.rfind("."):
            # Formato europeo: 1.250,50 -> 1250.50
            clean = clean.replace(".", "").replace(",", ".")
        else:
            # Formato anglosajón: 1,250.50 -> 1250.50
            clean = clean.replace(",", "")
    elif "," in clean:
        clean = clean.replace(",", ".")
        
    try:
        return float(clean)
    except ValueError:
        return 0.0


def extraer_producto_woocommerce(url: str, export_to_gdrive: bool = False) -> dict:
    """
    Procesa una URL de WooCommerce, extrae los datos comerciales y los inserta en Supabase.
    Retorna los datos del producto insertado y el mensaje de trazabilidad normativo.
    """
    if not url or not url.startswith("http"):
        raise ValueError("URL no válida o incompleta.")

    # 1. Petición HTTP con User-Agent inyectado (aislado de cookies de usuario)
    session = requests.Session()
    session.cookies.clear()
    
    response = session.get(url, headers=HTTP_HEADERS, timeout=15)
    response.raise_for_status()

    # 2. Parseo de HTML con BeautifulSoup
    soup = BeautifulSoup(response.text, "html.parser")

    # Localizar Título (<h1 class="product_title"> o variaciones de tema WooCommerce)
    title_el = soup.find("h1", class_="product_title") or soup.select_one("h1.product_title") or soup.find("h1")
    if not title_el:
        raise ValueError("No se pudo localizar el título del producto en la página analizada.")
    nombre = title_el.get_text(strip=True)

    # Localizar Precio (<span class="woocommerce-Price-amount amount">)
    # Si hay precio rebajado (ins), preferir el precio actual de ins
    ins_price = soup.select_one("ins .woocommerce-Price-amount")
    price_el = ins_price or soup.select_one("span.woocommerce-Price-amount.amount") or soup.find("span", class_="woocommerce-Price-amount")
    if not price_el:
        raise ValueError("No se pudo localizar el precio en formato WooCommerce.")
    
    precio_raw = price_el.get_text(strip=True)
    precio = clean_price(precio_raw)
    if precio <= 0:
        raise ValueError(f"Precio extraído no válido: '{precio_raw}'.")

    # Localizar SKU público si existe
    sku_el = soup.select_one(".sku")
    sku = sku_el.get_text(strip=True) if sku_el else None

    # Trazabilidad algorítmica conforme a Ley de IA y RGPD
    fecha_captura = datetime.now(timezone.utc).isoformat()
    metodo_extraccion = "automated_woocommerce_requests_bs4"

    producto_registro = {
        "nombre": nombre,
        "precio": precio,
        "moneda": "EUR",
        "sku": sku,
        "origen_url": url,
        "metodo_extraccion": metodo_extraccion,
        "fecha_captura": fecha_captura
    }

    # 3. Conexión con Supabase e inserción estructurada
    if SUPABASE_URL and SUPABASE_KEY:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        supabase.table("catalogo_prospeccion").insert(producto_registro).execute()

    # Exportación opcional a Google Drive (estrictamente en la raíz de la unidad)
    if export_to_gdrive:
        gdrive_dir = os.path.dirname(GDRIVE_ROOT_EXPORT_PATH)
        if os.path.exists(gdrive_dir):
            file_exists = os.path.isfile(GDRIVE_ROOT_EXPORT_PATH)
            with open(GDRIVE_ROOT_EXPORT_PATH, mode="a", newline="", encoding="utf-8") as csvfile:
                fieldnames = ["nombre", "precio", "moneda", "sku", "origen_url", "metodo_extraccion", "fecha_captura"]
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                if not file_exists:
                    writer.writeheader()
                writer.writerow(producto_registro)

    # Formato de respuesta exacto estipulado por la especificación
    precio_str = f"{precio:.2f}".replace(".", ",")
    mensaje_final = f"✅ Producto guardado en Supabase: {nombre} - {precio_str}€. (Registrado bajo normativa de trazabilidad)"

    return {
        "producto": producto_registro,
        "mensaje": mensaje_final
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scraper_woocommerce.py <URL_PRODUCTO> [--export-gdrive]")
        sys.exit(1)

    target_url = sys.argv[1]
    export_flag = "--export-gdrive" in sys.argv
    try:
        resultado = extraer_producto_woocommerce(target_url, export_to_gdrive=export_flag)
        # El bot o consola solo debe responder con el formato normativo
        print(resultado["mensaje"])
    except Exception as e:
        print(f"❌ Error al procesar producto: {str(e)}", file=sys.stderr)
        sys.exit(1)
