import React, { useState } from 'react';
import { Mail, Send, Copy, Check, ExternalLink, Download, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

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

  // Base URL for the permanent document/PDF link
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pdfUrl = `${origin}/print/${type}/${doc.id}?autoprint=false`;

  // Default linked accounts requested by user
  const primaryAccounts = ['administracion@obraclima.com', 'ahorraai@gmail.com'];
  
  // State for destination
  const [includeClientEmail, setIncludeClientEmail] = useState(Boolean(clientEmail));
  const [customClientEmail, setCustomClientEmail] = useState(clientEmail);
  const [copied, setCopied] = useState(false);
  const [sendingDirect, setSendingDirect] = useState(false);
  const [sendResult, setSendResult] = useState<{ success?: boolean; message?: string } | null>(null);

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

Le remitimos la factura oficial Nº ${docNumber} emitida por ObraClima S.L. correspondiente a los trabajos y servicios realizados.

🧾 Resumen del documento:
• Documento: Factura Nº ${docNumber}
• Fecha de emisión: ${dateFormatted}
• Titular / Cliente: ${clientName}
• Importe Total a pagar: ${totalStr} € (IVA incluido)
${doc.budgetReference ? `• Ref. Presupuesto anterior: ${doc.budgetReference}\n` : ''}
📄 Enlace oficial para consultar, descargar o imprimir el documento en PDF:
${pdfUrl}

💳 Datos bancarios de ObraClima S.L.:
• Entidad: CaixaBank
• IBAN: ${config?.bankAccount || 'ES91 2100 0418 4502 0005 1332'}
• Beneficiario: ObraClima S.L.
• Concepto de transferencia: Factura ${docNumber} - ${clientName}

Rogamos nos envíen el comprobante bancario una vez efectuada la transferencia para proceder al cierre del expediente.

Quedamos a su entera disposición para cualquier aclaración técnica o administrativa.

Atentamente,
Departamento de Administración y Facturación
ObraClima S.L.
Rúa Escultor Nogueira, Nº 4-Bajo, 36205 Vigo (Pontevedra)
N.I.F.: ${config?.nif || 'B75571059'}
Email: administracion@obraclima.com | ahorraai@gmail.com`
    : `Estimado/a ${clientName},

Adjuntamos el presupuesto oficial Nº ${docNumber} elaborado por ObraClima S.L. para su revisión y conformidad, de acuerdo con los trabajos de climatización y reformas solicitados.

📋 Resumen del documento:
• Documento: Presupuesto Nº ${docNumber}
• Fecha de emisión: ${dateFormatted}
• Cliente: ${clientName}
• Importe Total: ${totalStr} € (21% IVA incluido)

📄 Enlace oficial para consultar, descargar o imprimir el documento en PDF:
${pdfUrl}

Rogamos examine las partidas detalladas en el documento oficial adjunto y nos confirme su aceptación para proceder con la reserva técnica de equipos y fecha de ejecución de los trabajos.

Para cualquier duda técnica o adaptación del presupuesto, puede responder directamente a este correo o llamarnos.

Atentamente,
Departamento de Administración y Climatización
ObraClima S.L.
Rúa Escultor Nogueira, Nº 4-Bajo, 36205 Vigo (Pontevedra)
N.I.F.: ${config?.nif || 'B75571059'}
Email: administracion@obraclima.com | ahorraai@gmail.com`;

  const [body, setBody] = useState(defaultBody);

  // Handler to copy message + link to clipboard
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

  // Helper to open link in Telegram or standard browser
  const openExternal = (url: string) => {
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Direct Gmail Web Composer URL
  const openGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientsString)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    openExternal(gmailUrl);
  };

  // Native Mailto URL
  const openMailto = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(recipientsString)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  // Direct backend dispatch
  const handleDirectSend = async () => {
    setSendingDirect(true);
    setSendResult(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/obraclima/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          to: recipientsList,
          subject,
          body,
          docId: doc.id,
          type
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSendResult({ success: true, message: data.message || 'Correo procesado y registrado correctamente.' });
      } else {
        setSendResult({
          success: false,
          message: data.error || 'No se pudo enviar directamente desde el servidor. Utiliza los botones directos de Gmail o tu gestor de correo.'
        });
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: 'No se pudo conectar con el servidor de correo. Puedes usar Gmail o tu gestor habitual abajo.'
      });
    } finally {
      setSendingDirect(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-950/80 border-b border-slate-800 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Mail size={22} />
            </div>
            <div>
              <h3 className="text-white font-bold text-base sm:text-lg flex items-center gap-2">
                <span>Enviar {docTitle} por Correo</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                  {docNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Vinculado con <strong className="text-emerald-400 font-mono">administracion@obraclima.com</strong> y <strong className="text-emerald-400 font-mono">ahorraai@gmail.com</strong>
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
          {/* Target emails badge container */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 text-xs uppercase tracking-wider">
                Cuentas de destino vinculadas:
              </span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 size={13} />
                Vinculadas por defecto
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

            {/* Optional client email checkbox & field */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includeClientEmail}
                  onChange={(e) => setIncludeClientEmail(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                />
                <span>Incluir también al cliente ({clientName}):</span>
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
              Asunto del correo:
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Attached Document Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {docTitle}_{docNumber.replace('/', '-')}_ObraClima.pdf
                </p>
                <p className="text-[11px] text-slate-400">
                  Documento oficial con membrete y desglose con 21% IVA
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                title="Ver documento en pestaña nueva"
              >
                <span>Ver</span>
                <ExternalLink size={12} />
              </a>

              <a
                href={`${pdfUrl}&autoprint=true`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                title="Descargar o Guardar como PDF"
              >
                <Download size={12} />
                <span>PDF</span>
              </a>
            </div>
          </div>

          {/* Predefined message body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-300 text-xs">
                Mensaje predefinido oficial:
              </label>
              <button
                onClick={handleCopy}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copiar texto</span>
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

          {/* Feedback banner if direct send was attempted */}
          {sendResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                sendResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-500/50 text-amber-300'
              }`}
            >
              {sendResult.success ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-400" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{sendResult.message}</p>
                {!sendResult.success && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Puedes pulsar a continuación en <strong>Abrir en Gmail</strong> o <strong>Abrir en Outlook / App de Correo</strong> para enviarlo con 1 clic con todo el texto y enlace rellenos.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950/90 border-t border-slate-800 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-2.5">
          <button
            onClick={handleCopy}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Texto copiado' : 'Copiar texto completo'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Direct Gmail Compose Button */}
            <button
              onClick={openGmail}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              title="Abrir redacción en Gmail Web"
            >
              <Mail size={14} />
              <span>Abrir en Gmail</span>
            </button>

            {/* Native Mailto Button */}
            <button
              onClick={openMailto}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              title="Abrir en el cliente de correo predeterminado del sistema (Outlook, etc.)"
            >
              <Send size={14} />
              <span>Abrir en App de Correo</span>
            </button>

            {/* Optional Direct Send button */}
            <button
              onClick={handleDirectSend}
              disabled={sendingDirect}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              title="Enviar directamente a administracion@obraclima.com y ahorraai@gmail.com"
            >
              <CheckCircle2 size={14} />
              <span>{sendingDirect ? 'Enviando...' : 'Enviar Directo'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
