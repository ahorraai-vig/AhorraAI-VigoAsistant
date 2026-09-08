#!/usr/bin/env python3
"""
Orquestador de Prospección Masiva (WooCommerce Sitemap Crawler) - ObraClima
===========================================================================
Módulo asíncrono en segundo plano para el rastreo ético de catálogos completos
a partir de sitemaps XML de tiendas de proveedores basadas en WooCommerce.

Cumplimiento Normativo Estricto:
--------------------------------
1. Scraping Ético: Pausas aleatorias obligatorias (time.sleep(random.uniform(3, 7))) entre peticiones
   para respetar la tasa de peticiones y no sobrecargar los servidores del proveedor.
2. Minimización de Datos (RGPD): Únicamente extrae Título, Precio, SKU y URL.
   Prohibido capturar cookies, datos de sesión o datos de usuarios (PII).
3. Aislamiento Estructural: Registros volcados en la tabla 'catalogo_prospeccion' de Supabase,
   estrictamente aislada del catálogo oficial, clientes y facturación de ObraClima.
4. Trazabilidad Algorítmica (AI Act): Inclusión de metadatos obligatorios ('origen_url',
   'metodo_extraccion', 'fecha_captura').
5. Almacenamiento de Seguridad: Volcado en bloques de 50 productos EXCLUSIVAMENTE
   en la raíz de Google Drive: /content/drive/MyDrive/prospeccion_masiva.csv (sin subcarpetas).
"""

import os
import re
import sys
import time
import random
import csv
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, urljoin
from datetime import datetime, timezone
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

# Configuración de credenciales de Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "").replace("/rest/v1", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

# Ruta estricta de volcado de seguridad en Google Drive (únicamente en la raíz de MyDrive)
GDRIVE_BACKUP_CSV_PATH = "/content/drive/MyDrive/prospeccion_masiva.csv"

# Tamaño de lote para inserción en Supabase y volcado de seguridad
BATCH_SIZE = 50

# Cabeceras comerciales estrictas (sin cookies de sesión)
HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (ObraClima-Crawler-Bot/2.0; +https://obraclima.es)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}


def clean_price(price_text: str) -> float:
    """Limpia y normaliza cadenas de precio de WooCommerce (formatos 1.250,50 € o 1250.50)."""
    if not price_text:
        return 0.0
    clean = re.sub(r"[^\d,\.]", "", price_text).strip()
    if not clean:
        return 0.0

    if "," in clean and "." in clean:
        if clean.rfind(",") > clean.rfind("."):
            clean = clean.replace(".", "").replace(",", ".")
        else:
            clean = clean.replace(",", "")
    elif "," in clean:
        clean = clean.replace(",", ".")

    try:
        return round(float(clean), 2)
    except ValueError:
        return 0.0


def normalizar_dominio(input_domain: str) -> str:
    """Normaliza un dominio o URL raíz asegurando el esquema https."""
    domain = input_domain.strip().rstrip("/")
    if not domain.startswith("http://") and not domain.startswith("https://"):
        domain = f"https://{domain}"
    return domain


def descubrir_sitemaps(base_url: str, session: requests.Session) -> list:
    """
    Localiza los sitemaps de productos en la tienda WooCommerce.
    Prueba las rutas comunes de WooCommerce, Yoast SEO, RankMath, etc.
    """
    candidatos = [
        urljoin(base_url, "/product-sitemap.xml"),
        urljoin(base_url, "/product-sitemap1.xml"),
        urljoin(base_url, "/sitemap-products.xml"),
        urljoin(base_url, "/sitemap_index.xml"),
        urljoin(base_url, "/sitemap.xml"),
        urljoin(base_url, "/wp-sitemap-posts-product-1.xml")
    ]

    urls_sitemaps_encontrados = []

    for sitemap_url in candidatos:
        try:
            res = session.get(sitemap_url, headers=HTTP_HEADERS, timeout=10)
            if res.status_code == 200 and ("<xml" in res.text[:100] or "<urlset" in res.text or "<sitemapindex" in res.text):
                print(f"  [+] Sitemap localizado: {sitemap_url}")
                urls_sitemaps_encontrados.append(sitemap_url)
                # Si encontramos product-sitemap.xml directamente, priorizarlo
                if "product-sitemap" in sitemap_url or "posts-product" in sitemap_url:
                    break
        except Exception:
            continue

    return urls_sitemaps_encontrados


def parsear_sitemap_para_urls(sitemap_url: str, session: requests.Session) -> list:
    """
    Parsea un XML sitemap o índice de sitemaps recursivamente
    para extraer las URLs directas de productos WooCommerce.
    """
    urls_productos = []
    try:
        res = session.get(sitemap_url, headers=HTTP_HEADERS, timeout=15)
        res.raise_for_status()

        # Eliminar namespaces para simplificar el parseo de ElementTree
        xml_content = re.sub(r'\sxmlns="[^"]+"', '', res.text, count=1)
        root = ET.fromstring(xml_content.encode("utf-8"))

        # Caso 1: Índice de sitemaps (<sitemapindex>)
        sub_sitemaps = root.findall(".//sitemap/loc")
        if sub_sitemaps:
            for loc in sub_sitemaps:
                sub_url = loc.text.strip()
                # Filtrar solo sitemaps que apunten a productos
                if any(kw in sub_url.lower() for kw in ["product", "producto", "item", "articulo"]):
                    print(f"  [+] Explorando sub-sitemap de productos: {sub_url}")
                    urls_productos.extend(parsear_sitemap_para_urls(sub_url, session))
            # Si no había sub-sitemaps específicos con palabra clave 'product', revisar todos
            if not urls_productos:
                for loc in sub_sitemaps[:3]:
                    urls_productos.extend(parsear_sitemap_para_urls(loc.text.strip(), session))

        # Caso 2: URLs finales de productos (<urlset>)
        url_tags = root.findall(".//url/loc")
        for tag in url_tags:
            if tag.text:
                u = tag.text.strip()
                # Filtrar páginas que no sean de productos si el sitemap es mixto
                if "/producto/" in u or "/product/" in u or "/tienda/" in u or "product-sitemap" in sitemap_url:
                    urls_productos.append(u)

    except Exception as e:
        print(f"  [-] Error parseando sitemap {sitemap_url}: {e}")

    # Deduplicar preservando orden
    return list(dict.fromkeys(urls_productos))


def extraer_datos_producto(url: str, session: requests.Session) -> dict:
    """Extrae Título, Precio y SKU de la ficha pública de producto WooCommerce."""
    res = session.get(url, headers=HTTP_HEADERS, timeout=15)
    res.raise_for_status()

    soup = BeautifulSoup(res.text, "html.parser")

    # 1. Título (<h1 class="product_title">)
    title_el = soup.find("h1", class_="product_title") or soup.select_one("h1.product_title") or soup.find("h1")
    if not title_el:
        return None
    nombre = title_el.get_text(strip=True)
    if not nombre:
        return None

    # 2. Precio (<span class="woocommerce-Price-amount amount">)
    ins_el = soup.select_one("ins .woocommerce-Price-amount")
    price_el = ins_el or soup.select_one("span.woocommerce-Price-amount.amount") or soup.find("span", class_="woocommerce-Price-amount")
    if not price_el:
        return None
    precio = clean_price(price_el.get_text(strip=True))
    if precio <= 0:
        return None

    # 3. SKU comercial si está expuesto
    sku_el = soup.select_one(".sku")
    sku = sku_el.get_text(strip=True) if sku_el else None
    if sku == "N/A":
        sku = None

    # Metadatos obligatorios de trazabilidad algorítmica
    return {
        "nombre": nombre,
        "precio": precio,
        "moneda": "EUR",
        "sku": sku,
        "origen_url": url,
        "metodo_extraccion": "orquestador_masivo_sitemap_bs4",
        "fecha_captura": datetime.now(timezone.utc).isoformat()
    }


def guardar_volcado_seguridad_csv(lote_productos: list):
    """
    Guarda el volcado de seguridad en formato CSV por cada lote de 50 productos.
    Regla estricta: Únicamente en la raíz de Google Drive (/content/drive/MyDrive/prospeccion_masiva.csv).
    """
    try:
        drive_folder = os.path.dirname(GDRIVE_BACKUP_CSV_PATH)
        if os.path.exists(drive_folder):
            file_exists = os.path.isfile(GDRIVE_BACKUP_CSV_PATH)
            with open(GDRIVE_BACKUP_CSV_PATH, mode="a", newline="", encoding="utf-8") as f:
                fields = ["nombre", "precio", "moneda", "sku", "origen_url", "metodo_extraccion", "fecha_captura"]
                writer = csv.DictWriter(f, fieldnames=fields)
                if not file_exists:
                    writer.writeheader()
                for prod in lote_productos:
                    writer.writerow(prod)
            print(f"  [💾 Backup] Lote de {len(lote_productos)} productos volcado a {GDRIVE_BACKUP_CSV_PATH}")
    except Exception as e:
        print(f"  [!] Aviso de respaldo CSV: {e}")


def insertar_lote_supabase(supabase: Client, lote_productos: list):
    """Inserta en Supabase un bloque (Batch Insert) en la tabla 'catalogo_prospeccion'."""
    if not supabase or not lote_productos:
        return
    try:
        res = supabase.table("catalogo_prospeccion").insert(lote_productos).execute()
        print(f"  [⚡ Supabase] Bloque de {len(lote_productos)} registros insertados con éxito.")
    except Exception as e:
        print(f"  [-] Error insertando lote en Supabase: {e}")


def iniciar_orquestador_prospeccion_masiva(dominio_proveedor: str):
    """
    Función principal de rastreo profundo del catálogo en segundo plano.
    """
    base_url = normalizar_dominio(dominio_proveedor)
    print(f"\n========================================================")
    print(f"🚀 Orquestador de Prospección Masiva iniciado")
    print(f"🎯 Dominio objetivo: {base_url}")
    print(f"========================================================\n")

    # Sesión HTTP aislada sin cookies
    session = requests.Session()
    session.cookies.clear()

    # Inicializar cliente de Supabase
    supabase: Client = None
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as err:
            print(f"[-] Supabase no inicializado: {err}")

    # 1. Localizar Sitemaps
    print("[1/4] Descubriendo mapas de sitio (Sitemaps)...")
    sitemaps = descubrir_sitemaps(base_url, session)
    if not sitemaps:
        print("[-] No se localizó un sitemap XML accesible. Finalizando.")
        return

    # 2. Extraer lista de URLs de productos
    print("[2/4] Extrayendo URLs de productos desde los sitemaps...")
    todas_urls = []
    for sm in sitemaps:
        todas_urls.extend(parsear_sitemap_para_urls(sm, session))
    todas_urls = list(dict.fromkeys(todas_urls))

    total_urls = len(todas_urls)
    print(f"[+] Total de URLs de productos identificadas: {total_urls}")
    if total_urls == 0:
        print("[-] No se encontraron URLs de productos válidas. Finalizando.")
        return

    # 3. Iteración controlada con scraping ético y batching
    print(f"[3/4] Iniciando procesamiento batch con pausas éticas (3 a 7 segundos)...")
    lote_actual = []
    procesados_exito = 0

    for i, url in enumerate(todas_urls, start=1):
        try:
            # Pausa ética obligatoria para no saturar los servidores del proveedor
            pausa = random.uniform(3.0, 7.0)
            time.sleep(pausa)

            producto = extraer_datos_producto(url, session)
            if producto:
                lote_actual.append(producto)
                procesados_exito += 1
                print(f"  ({i}/{total_urls}) Extraído: {producto['nombre'][:40]}... - {producto['precio']} €")

            # 4. Volcado de seguridad e inserción en Supabase cada 50 productos
            if len(lote_actual) >= BATCH_SIZE:
                insertar_lote_supabase(supabase, lote_actual)
                guardar_volcado_seguridad_csv(lote_actual)
                lote_actual = []

        except requests.exceptions.RequestException as req_err:
            print(f"  ({i}/{total_urls}) Error de red en {url}: {req_err}")
            time.sleep(5)
        except Exception as err:
            print(f"  ({i}/{total_urls}) Error procesando {url}: {err}")

    # Volcar productos restantes del último lote
    if lote_actual:
        insertar_lote_supabase(supabase, lote_actual)
        guardar_volcado_seguridad_csv(lote_actual)

    print(f"\n========================================================")
    print(f"✅ Prospección finalizada: {procesados_exito} productos extraídos.")
    print(f"========================================================\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python crawler_masivo_sitemap.py <DOMINIO_O_SITEMAP>")
        print("Ejemplo: python crawler_masivo_sitemap.py tiendaejemplo.com")
        sys.exit(1)

    dominio_input = sys.argv[1]
    iniciar_orquestador_prospeccion_masiva(dominio_input)
