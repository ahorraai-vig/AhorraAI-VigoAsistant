import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  X, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Cloud, 
  Paperclip,
  RefreshCw,
  Loader2
} from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: any;
  type: 'presupuesto' | 'factura';
  config: any;
}

export default function EmailModal({ isOpen, onClose, doc, type, config }: EmailModalProps) {
  if (!isOpen || !doc) return null;

  const clientName = doc.customer?.name || doc.client?.name || 'Cliente';
  const clientEmail = doc.customer?.email || doc.client?.email || '';
  const isInvoice = type === 'factura';
  const docTitle = isInvoice ? 'Factura' : 'Presupuesto';
  const docNumber = doc.number || '';
  const totalStr = (doc.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 });
  const dateFormatted = new Date(doc.date || Date.now()).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Base URL for web consultation fallback
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pdfViewUrl = `${origin}/print/${type}/${doc.id}?autoprint=false`;

  // Default linked accounts
  const primaryAccounts = ['administracion@obraclima.com', 'ahorraai@gmail.com'];
  
  // State for destination
  const [includeClientEmail, setIncludeClientEmail] = useState(Boolean(clientEmail));
  const [customClientEmail, setCustomClientEmail] = useState(clientEmail);
  const [copied, setCopied] = useState(false);
  const [sendingDirect, setSendingDirect] = useState(false);
  const [generatingCourtesy, setGeneratingCourtesy] = useState(false);
  const [sendResult, setSendResult] = useState<{ 
    success?: boolean; 
    message?: string; 
    storageUrl?: string; 
    provider?: string 
  } | null>(null);

  // Build list of all recipient emails
  const recipientsList = [...primaryAccounts];
  if (includeClientEmail && customClientEmail.trim()) {
    recipientsList.unshift(customClientEmail.trim());
  }
  const recipientsString = recipientsList.join(',');

  // Official Subject
  const defaultSubject = isInvoice
    ? `Factura Oficial Nº ${docNumber} - ObraClima S.L. (${clientName})`
    : `Presupuesto Oficial Nº ${docNumber} - ObraClima S.L. (${clientName})`;

  const [subject, setSubject] = useState(defaultSubject);

  // Predefined message text
  const defaultBody = isInvoice
    ? `Estimado/a ${clientName},

Le remitimos adjunta la factura oficial Nº ${docNumber} emitida por ObraClima S.L. correspondiente a los trabajos y servicios realizados.

🧾 Resumen del documento:
• Documento: Factura Nº ${docNumber}
• Fecha de emisión: ${dateFormatted}
• Titular / Cliente: ${clientName}
• Importe Total a pagar: ${totalStr} € (IVA incluido)
${doc.budgetReference ? `• Ref. Presupuesto anterior: ${doc.budgetReference}\n` : ''}
📎 En este correo se encuentra adjunto de forma nativa el archivo PDF oficial con el desglose de partidas e impuestos.

💳 Datos bancarios de ObraClima S.L.:
• Entidad: CaixaBank
• IBAN: ${config?.bankAccount || 'ES91 2100 0418 4502 0005 1332'}
• Beneficiario: ObraClima S.L.
• Concepto: Factura ${docNumber} - ${clientName}

Quedamos a su entera disposición para cualquier consulta.

Atentamente,
Departamento de Administración y Facturación
ObraClima S.L.
Rúa Escultor Nogueira, Nº 4-Bajo, 36205 Vigo (Pontevedra)
Email: administracion@obraclima.com | ahorraai@gmail.com`
    : `Estimado/a ${clientName},

Esperamos que se encuentre bien.

Le remitimos adjunto en formato PDF a este correo electrónico el presupuesto oficial Nº ${docNumber} elaborado por ObraClima S.L. para su revisión y conformidad, de acuerdo con los trabajos de climatización y reformas solicitados.

📋 Resumen del documento:
• Documento: Presupuesto Nº ${docNumber}
• Fecha de emisión: ${dateFormatted}
• Cliente: ${clientName}
• Importe Total: ${totalStr} € (21% IVA incluido)

📎 El archivo PDF oficial se encuentra adjunto directamente a este correo con el desglose detallado de equipos y mano de obra.

Rogamos examine las partidas detalladas en el documento oficial adjunto y nos confirme su aceptación para proceder con la reserva técnica de equipos y programación de las fechas de ejecución.

Quedamos a su entera disposición para cualquier aclaración técnica o ajuste del proyecto.

Atentamente,
Departamento de Administración y Climatización
ObraClima S.L.
Rúa Escultor Nogueira, Nº 4-Bajo, 36205 Vigo (Pontevedra)
N.I.F.: ${config?.nif || 'B75571059'}
Email: administracion@obraclima.com | ahorraai@gmail.com`;

  const [body, setBody] = useState(defaultBody);

  // Auto-generate or enrich with Gemini on opening if desired
  const handleGenerateGeminiCourtesy = async () => {
    setGeneratingCourtesy(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/obraclima/generate-courtesy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          doc,
          docId: doc.id,
          type
        })
      });
      const data = await res.json();
      if (res.ok && data.courtesyText) {
        setBody(data.courtesyText);
      }
    } catch (err) {
      console.warn('No se pudo generar cortesía con Gemini:', err);
    } finally {
      setGeneratingCourtesy(false);
    }
  };

  // Handler to copy message to clipboard
  const handleCopy = async () => {
    try {
      const fullText = `Asunto: ${subject}\nDestinatarios: ${recipientsString}\n\n${body}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // Direct send via Resend / Nodemailer with native PDF attachment and Supabase Storage upload
  const handleSendBudget = async () => {
    setSendingDirect(true);
    setSendResult(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/obraclima/send-budget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          to: recipientsList,
          subject,
          body,
          doc,
          docId: doc.id,
          type
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSendResult({ 
          success: true, 
          message: data.message || `Correo enviado exitosamente con el PDF adjunto de forma nativa.`,
          storageUrl: data.storageUrl,
          provider: data.provider
        });
      } else {
        setSendResult({
          success: false,
          message: data.error || 'No se pudo completar el envío directo con el PDF adjunto.'
        });
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: 'Error de conexión con el servidor al generar el PDF y enviar el correo.'
      });
    } finally {
      setSendingDirect(false);
    }
  };

  // Direct Gmail Web Composer URL (Fallback)
  const openGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientsString)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(gmailUrl);
    } else {
      window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Native Mailto URL (Fallback)
  const openMailto = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(recipientsString)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[94vh]">
        {/* Header */}
        <div className="bg-slate-950/80 border-b border-slate-800 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Mail size={22} />
            </div>
            <div>
              <h3 className="text-white font-bold text-base sm:text-lg flex items-center gap-2">
                <span>Enviar {docTitle}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                  {docNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Envío oficial con PDF adjunto de forma nativa y copia a <strong className="text-emerald-400 font-mono">administracion@obraclima.com</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs sm:text-sm text-slate-200">
          
          {/* Target emails container */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 text-xs uppercase tracking-wider">
                Destinatarios del correo:
              </span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 size={13} />
                Copia corporativa garantizada
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono text-xs rounded-lg flex items-center gap-1.5">
                <Mail size={12} />
                administracion@obraclima.com
              </span>
              <span className="px-2.5 py-1 bg-blue-950/80 border border-blue-500/40 text-blue-300 font-mono text-xs rounded-lg flex items-center gap-1.5">
                <Mail size={12} />
                ahorraai@gmail.com
              </span>
            </div>

            {/* Client email selector */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includeClientEmail}
                  onChange={(e) => setIncludeClientEmail(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                />
                <span>Enviar también al cliente ({clientName}):</span>
              </label>
              {includeClientEmail && (
                <input
                  type="email"
                  value={customClientEmail}
                  onChange={(e) => setCustomClientEmail(e.target.value)}
                  placeholder="correo@cliente.com"
                  className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 flex-1 sm:max-w-[260px]"
                />
              )}
            </div>
          </div>

          {/* Subject Field */}
          <div>
            <label className="block font-semibold text-slate-300 text-xs mb-1.5">
              Asunto del correo oficial:
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Native PDF Attachment and Supabase Storage Badge Card */}
          <div className="bg-slate-950/80 border border-blue-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white truncate">
                    {docTitle}_{docNumber.replace(/[\/\\]/g, '-')}_ObraClima.pdf
                  </p>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                    <Paperclip size={10} />
                    Adjunto nativo
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Cloud size={12} className="text-sky-400" />
                  <span>Guardado temporal automático en Bucket Supabase Storage</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={pdfViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                title="Vista previa del documento en nueva pestaña"
              >
                <span>Ver online</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Gemini Courtesy Text Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-300 text-xs">
                  Cuerpo del correo (Texto de cortesía profesional):
                </label>
                <button
                  type="button"
                  onClick={handleGenerateGeminiCourtesy}
                  disabled={generatingCourtesy}
                  className="px-2 py-0.5 rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                  title="Redactar un nuevo texto de cortesía personalizado con Gemini"
                >
                  {generatingCourtesy ? (
                    <>
                      <Loader2 size={11} className="animate-spin" />
                      <span>Generando cortesía...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={11} className="text-amber-400" />
                      <span>Regenerar cortesía con Gemini</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs leading-relaxed font-sans focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Feedback banner after sending */}
          {sendResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                sendResult.success
                  ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                  : 'bg-amber-950/70 border-amber-500/60 text-amber-200'
              }`}
            >
              {sendResult.success ? (
                <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-400" />
              )}
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-sm">{sendResult.message}</p>
                {sendResult.storageUrl && (
                  <p className="text-[11px] text-emerald-300/90 flex items-center gap-1">
                    <Cloud size={13} />
                    <span>PDF almacenado en Supabase Storage: </span>
                    <a
                      href={sendResult.storageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-mono text-[10px] break-all hover:text-white"
                    >
                      {sendResult.storageUrl}
                    </a>
                  </p>
                )}
                {sendResult.provider && (
                  <p className="text-[10px] text-slate-400 font-mono">
                    Proveedor de entrega: {sendResult.provider.toUpperCase()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950/90 border-t border-slate-800 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={openGmail}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              title="Abrir borrador en Gmail"
            >
              <Mail size={13} />
              <span>Abrir en Gmail</span>
            </button>

            <button
              onClick={openMailto}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              title="Abrir en cliente de correo local"
            >
              <Send size={13} />
              <span>Cliente local</span>
            </button>
          </div>

          {/* Primary Action: ENVIAR PRESUPUESTO REAL */}
          <button
            onClick={handleSendBudget}
            disabled={sendingDirect}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
            title="Genera el PDF oficial, lo almacena en Supabase Storage y envía el email con el PDF adjunto de forma nativa"
          >
            {sendingDirect ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Generando PDF y enviando...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Enviar {docTitle}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
