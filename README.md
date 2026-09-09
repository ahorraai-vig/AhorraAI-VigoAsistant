# ObraClima AI & Asistente Vigo (Telegram MiniApp + Web Admin)

Plataforma de gestión de presupuestos, facturación y prospección comercial inteligente con integración directa en Telegram MiniApp y panel web administrativo.

---

## 🏗️ Arquitectura del Sistema

El núcleo de ObraClima sigue un patrón **Repository** centralizado con persistencia segura y desacoplamiento RGPD:

1. **Fuente Única de Verdad (`server/services/obraclima/repo.ts`)**:
   - Centraliza todas las lecturas y escrituras hacia Supabase (`obraclima_budgets`, `obraclima_invoices`, `obraclima_clients`, `obraclima_catalog`, `obraclima_catalog_prospected`, `obraclima_config`).
   - Cuenta con persistencia dual con fallback local en memoria en caso de interrupciones temporales de red o configuración.

2. **Seguridad y Autenticación Criptográfica (`server/services/obraclima/telegramAuth.ts`)**:
   - Autenticación criptográfica real mediante validación HMAC-SHA256 del `initData` de Telegram frente al `TELEGRAM_BOT_TOKEN`.
   - Soporte simultáneo para tokens de sesión Supabase JWT para el panel web y `X-Telegram-Init-Data` para la MiniApp.
   - Eliminación total de tokens fijos o comparaciones en texto claro.

3. **Cerebro IA / Prospectados & Catálogo Oficial (`src/pages/admin/obraclima/components/ProspectedList.tsx`)**:
   - Visualización y filtrado de productos técnicos capturados de distribuidores locales (Bricocentro, ferreterías, tiendas de climatización de Vigo y Galicia).
   - Control de densidad de imágenes (`shouldAttachImage` con caché en primer uso) para no sobrecargar datos.
   - Enlace directo a la ficha del proveedor e incorporación inmediata con 1 clic al catálogo de tarifas oficiales de ObraClima.

4. **Generador de Propuestas & Maquetas MiniApp en PDF (`api/prospector_telegram_proposal.ts`)**:
   - Generación de correos B2B hiperpersonalizados mediante IA (Gemini) adaptados al sector y datos de prospección del negocio.
   - Generación de dossier PDF nativo vectorial A4 de 2 páginas con:
     - *Página 1*: Membrete oficial, diagnóstico de debilidad digital y módulos operativos.
     - *Página 2*: Simulación visual de alta fidelidad de la MiniApp de Telegram con la cabecera del negocio, asistente IA adaptado, catálogo y barra de navegación de 6 pestañas.
   - Envío nativo por correo electrónico (Resend o SMTP) y registro automático en el CRM de prospección.

---

## ⚙️ Variables de Entorno Requeridas

Configura las siguientes variables en tu archivo `.env` o en el panel de Secrets de Google AI Studio:

```env
# Gemini API Key (Requerido para el asistente de presupuestos y propuestas)
GEMINI_API_KEY="tu-gemini-api-key"

# Supabase (Base de datos y autenticación)
VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
VITE_SUPABASE_ANON_KEY="tu-anon-key-publica"
SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key-privada"

# Telegram Bot Token (Requerido para validar HMAC de la MiniApp y notificaciones)
TELEGRAM_BOT_TOKEN="tu-telegram-bot-token"

# Envíos de Correo Electrónico (Resend o SMTP)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="ObraClima <presupuestos@obraclima.com>"
# Opcional: SMTP alternativo
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# APIs complementarias de prospección
SERPAPI_API_KEY="tu-serpapi-key"
GOOGLE_MAPS_API_KEY="tu-google-maps-api-key"
```

---

## 🗄️ Migraciones de Base de Datos

Las tablas y políticas de seguridad (RLS) se encuentran en:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_obraclima_core.sql`

Aplica el script `002_obraclima_core.sql` en el SQL Editor de tu panel de Supabase para activar las tablas optimizadas y políticas RLS del núcleo de ObraClima.
