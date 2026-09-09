import express from "express";
import { findLeadByIdOrParam, getLeadMiniAppConfig } from "../../api/pontevedra_prospector";
import { parseBudgetWithAi } from "../../api/obraclima";

interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: {
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  audio?: { id: string; mime_type: string };
  voice?: { id: string; mime_type: string };
}

/**
 * Verifica el handshake inicial del Webhook de Meta / WhatsApp Business API
 */
export function verifyWhatsAppWebhook(req: express.Request, res: express.Response) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "ahorraai_meta_vigo_2026";

  if (mode === "subscribe" && token === expectedToken) {
    console.log("[WhatsApp Webhook] Handshake verificado con éxito por Meta!");
    return res.status(200).send(challenge);
  }

  console.warn("[WhatsApp Webhook] Fallo en la verificación de token. Recibido:", token, "Esperado:", expectedToken);
  return res.status(403).send("Forbidden");
}

/**
 * Envía un mensaje de texto por WhatsApp a través de la API oficial de Meta
 */
export async function sendWhatsAppTextMessage(to: string, text: string, previewUrl = true) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "949730394900787";

  if (!accessToken) {
    console.warn("[WhatsApp API] No se pudo enviar mensaje: WHATSAPP_ACCESS_TOKEN no configurado.");
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/[^0-9]/g, ""),
      type: "text",
      text: {
        preview_url: previewUrl,
        body: text,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[WhatsApp API Error]:", data);
      return false;
    }

    console.log("[WhatsApp API] Mensaje enviado con éxito a", to);
    return true;
  } catch (err) {
    console.error("[WhatsApp API Exception]:", err);
    return false;
  }
}

/**
 * Procesa las notificaciones y mensajes entrantes de WhatsApp enviados por Meta
 */
export async function handleWhatsAppIncoming(req: express.Request, res: express.Response) {
  // Siempre responder 200 OK inmediatamente a Meta para confirmar recepción
  res.status(200).send("EVENT_RECEIVED");

  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") {
      return;
    }

    const appUrl = (process.env.APP_URL || "https://ais-dev-tvkcd5ffewortczttmdp2n-511583726387.europe-west2.run.app").replace(/\/$/, "");

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const messages: WhatsAppIncomingMessage[] = value?.messages || [];
        const contactName = value?.contacts?.[0]?.profile?.name || "Cliente";

        for (const msg of messages) {
          const from = msg.from; // Número de teléfono del usuario (ej: 34614053674)
          let userText = "";

          if (msg.type === "text" && msg.text?.body) {
            userText = msg.text.body.trim();
          } else if (msg.type === "interactive") {
            userText = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "";
          } else if (msg.type === "audio" || msg.type === "voice") {
            // Nota sobre audios de WhatsApp
            await sendWhatsAppTextMessage(
              from,
              `🎙️ ¡Hola, *${contactName}*! He recibido tu mensaje de voz. Para cotizaciones de alta precisión en obra, también puedes escribirme brevemente los detalles aquí (ej: *"Instalar termo de 80L en Teis con latiguillos nuevos"*), o abrir directamente tu MiniApp en el enlace de abajo.`
            );
            continue;
          }

          if (!userText) continue;

          console.log(`[WhatsApp Incoming] De: ${from} (${contactName}) - Texto: "${userText}"`);

          const lower = userText.toLowerCase();

          // 1. Caso: Lead de prospección comercial (ej: lead_123, /start lead_123 o contiene lead_)
          const leadMatchParam = userText.match(/lead_([a-zA-Z0-9_-]+)/i);
          if (leadMatchParam) {
            const leadParam = leadMatchParam[0];
            const leadMatch = findLeadByIdOrParam(leadParam);
            if (leadMatch) {
              const biz = leadMatch.business;
              const mini = leadMatch.miniApp || getLeadMiniAppConfig(biz.id);
              const tokenQuery = mini?.token ? `?token=${mini.token}` : "";
              const miniappUrl = `${appUrl}/miniapp/${biz.id}${tokenQuery}`;
              const isDeployed = Boolean(mini?.isDeployedToTelegram);

              const responseText = isDeployed
                ? `🎉 *¡MiniApp Oficial y Cotizador Activo!* 🚀\n\n` +
                  `Hola, equipo de *${biz.name}* (${biz.municipality}). Vuestro Asistente de Presupuestos con IA ya está disponible.\n\n` +
                  `📋 *Sector:* ${biz.primary_category}\n` +
                  `🔑 *PIN de Acceso Privado:* \`${mini?.accessCode || "VIGO-ACCESO"}\`\n\n` +
                  `📱 *Abre tu panel táctil de cotizaciones aquí:*\n${miniappUrl}\n\n` +
                  `O escríbeme directamente aquí en WhatsApp cualquier trabajo que quieras valorar (materiales, mano de obra y 21% IVA automático).`
                : `¡Hola, equipo de *${biz.name}*! 🏢✨\n\n` +
                  `Hemos preparado una demostración inteligente adaptada al sector de *${biz.primary_category}* en *${biz.municipality}*.\n\n` +
                  `• 📋 Presupuestos en 1 minuto con tarifas de mercado de Pontevedra/Vigo\n` +
                  `• ⚡ Desglose automático de materiales y mano de obra con IA\n` +
                  `• 🔑 Vuestra clave de acceso privado: \`${mini?.accessCode || "VIGO-ACCESO"}\`\n\n` +
                  `👉 *Prueba vuestra MiniApp en el móvil pulsando aquí:*\n${miniappUrl}`;

              await sendWhatsAppTextMessage(from, responseText);
              continue;
            }
          }

          // 2. Saludo inicial o menú
          if (["hola", "buenas", "menu", "inicio", "ayuda", "info"].includes(lower)) {
            const menuText =
              `¡Hola, *${contactName}*! 👋 Bienvenido al Asistente Inteligente de *AhorraAI / ObraClima Vigo*.\n\n` +
              `Puedo ayudarte a:\n` +
              `• ⚡ *Calcular presupuestos al instante*: Escríbeme qué trabajo necesitas hacer (ej: *"Cambiar caldera estanca por condensación en Bouzas con salida de humos"*).\n` +
              `• 📱 *Abrir tu MiniApp*: Accede a tu catálogo y panel de control web desde el móvil.\n\n` +
              `🌐 *Enlace al Portal Web:* ${appUrl}/obraclima-miniapp\n\n` +
              `¿Qué trabajo o reforma deseas valorar hoy?`;

            await sendWhatsAppTextMessage(from, menuText);
            continue;
          }

          // 3. Petición de cotización o descripción de obra/instalación
          if (
            lower.includes("presupuesto") ||
            lower.includes("cotizar") ||
            lower.includes("precio") ||
            lower.includes("cambiar") ||
            lower.includes("instalar") ||
            lower.includes("reforma") ||
            lower.includes("termo") ||
            lower.includes("caldera") ||
            lower.includes("pintar") ||
            lower.includes("fontaneria") ||
            lower.includes("electricidad") ||
            userText.length > 20
          ) {
            try {
              // Notificar al usuario que estamos calculando
              await sendWhatsAppTextMessage(from, `⚙️ Calculando desglose técnico de materiales, mano de obra y 21% IVA para tu solicitud... Un segundo.`);

              const parsed: any = await parseBudgetWithAi(userText);
              const items = parsed?.items || [];
              const subtotal = Number(parsed?.subtotal) || items.reduce((acc: number, it: any) => acc + (Number(it.total) || Number(it.quantity || 1) * Number(it.unitPrice || 0) || 0), 0);
              const vat = subtotal * 0.21;
              const total = subtotal + vat;

              let summary = `📋 *PRESUPUESTO ESTIMADO POR IA*\n\n`;
              summary += `🏢 *Obra/Concepto:* ${parsed?.title || "Trabajo solicitado"}\n\n`;
              summary += `*Desglose de partidas:*\n`;

              for (const it of items.slice(0, 5)) {
                summary += `• ${it.concept || it.name}: ${Number(it.quantity || 1)} ud x ${Number(it.unitPrice || 0).toFixed(2)} € = *${Number(it.total || it.quantity * it.unitPrice || 0).toFixed(2)} €*\n`;
              }

              if (items.length > 5) {
                summary += `• _...y ${items.length - 5} partidas más._\n`;
              }

              summary += `\n💵 *Base Imponible:* ${subtotal.toFixed(2)} €\n`;
              summary += `📊 *IVA (21%):* ${vat.toFixed(2)} €\n`;
              summary += `💰 *TOTAL OFICIAL:* *${total.toFixed(2)} €*\n\n`;
              summary += `📱 Puedes revisar el documento completo y descargarlo en PDF en tu panel web:\n${appUrl}/obraclima-miniapp`;

              await sendWhatsAppTextMessage(from, summary);
            } catch (err: any) {
              console.error("[WhatsApp AI Calculation Error]:", err);
              await sendWhatsAppTextMessage(
                from,
                `He recibido tu solicitud para: _"${userText.slice(0, 80)}..."_.\n\nPuedes generar el PDF oficial y consultar los precios oficiales directamente en tu MiniApp aquí:\n${appUrl}/obraclima-miniapp`
              );
            }
            continue;
          }

          // 4. Mensaje por defecto
          await sendWhatsAppTextMessage(
            from,
            `He recibido tu mensaje: _"${userText}"_.\n\nEscríbeme los detalles de cualquier trabajo que quieras presupuestar o accede a tu MiniApp en:\n${appUrl}/obraclima-miniapp`
          );
        }
      }
    }
  } catch (error) {
    console.error("[WhatsApp Webhook Processing Exception]:", error);
  }
}
