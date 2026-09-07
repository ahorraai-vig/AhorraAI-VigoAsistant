import React, { useState, useEffect } from 'react';
import { adminFetch } from '../../../../lib/apiAuth';
import { Plus, Trash, Wand2, FileText, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';
import PrintTemplate from './PrintTemplate';

export default function DocumentEditor({ 
  type, 
  initialData, 
  clients, 
  catalog, 
  config, 
  onSave, 
  onCancel 
}: { 
  type: 'presupuesto' | 'factura', 
  initialData?: any, 
  clients: any[], 
  catalog: any[], 
  config: any, 
  onSave: (d: any) => void, 
  onCancel: () => void 
}) {
  const [data, setData] = useState<any>({
    client: null,
    items: [],
    notes: '',
    ...initialData
  });
  
  const [prompt, setPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  // Recalcular subtotales, IVA y total automáticamente
  useEffect(() => {
    let subtotal = 0;
    (data.items || []).forEach((item: any) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.unitPrice ?? item.price) || 0;
      subtotal += q * p;
    });
    const ivaRate = Number(config?.defaultIva ?? 21);
    const tax = subtotal * (ivaRate / 100);
    const total = subtotal + tax;
    setData((prev: any) => ({ ...prev, subtotal, tax, total }));
  }, [data.items, config]);

  const handleAiParse = async () => {
    if (!prompt.trim()) return;
    setIsAiLoading(true);
    setAiFeedback(null);
    setAiError(null);

    try {
      const res = await adminFetch('/api/obraclima/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const result = await res.json();

      if (result.error) {
        setAiError(result.error);
      } else if (result.success && result.data) {
        const rawItems = result.data.items || [];
        if (rawItems.length === 0) {
          setAiError("La IA no identificó partidas concretas en el texto. Prueba a detallar un poco más el trabajo o equipo.");
        } else {
          const parsedItems = rawItems.map((i: any) => {
            const catItem = catalog.find(c => 
              (c.code && i.code && c.code.toString().toLowerCase() === i.code.toString().toLowerCase()) ||
              (c.id && i.code && c.id.toString().toLowerCase() === i.code.toString().toLowerCase()) ||
              (c.name && i.description && c.name.toLowerCase() === i.description.toLowerCase())
            );
            return {
              description: catItem ? catItem.name : (i.description || 'Partida de instalación'),
              quantity: Number(i.quantity) || 1,
              unitPrice: catItem ? Number(catItem.price) : (Number(i.unitPrice ?? i.price) || 0)
            };
          });

          // Si la IA identificó un cliente en el prompt, buscar coincidencia en la base de clientes
          let matchedClient = data.client;
          if (!matchedClient && result.data.customer?.name) {
            const searchName = result.data.customer.name.toLowerCase().trim();
            matchedClient = clients.find(c => 
              c.name.toLowerCase().includes(searchName) || searchName.includes(c.name.toLowerCase())
            ) || null;
          }

          setData((prev: any) => ({
            ...prev,
            client: matchedClient || prev.client,
            items: [...(prev.items || []), ...parsedItems],
            notes: result.data.notes 
              ? (prev.notes ? `${prev.notes}\n${result.data.notes}` : result.data.notes)
              : prev.notes
          }));

          setAiFeedback(`✓ Se han añadido ${parsedItems.length} partida(s) al presupuesto con éxito.`);
          setPrompt("");
        }
      } else {
        setAiError("No se pudo interpretar el texto. Por favor, inténtalo de nuevo.");
      }
    } catch (e: any) {
      console.error(e);
      setAiError(e.message || "Error al conectar con el servidor de IA.");
    }
    setIsAiLoading(false);
  };

  const addItem = () => setData({ 
    ...data, 
    items: [...(data.items || []), { description: '', quantity: 1, unitPrice: 0 }] 
  });
  
  const updateItem = (index: number, field: string, val: any) => {
    const newItems = [...(data.items || [])];
    newItems[index] = { ...newItems[index], [field]: val };
    setData({ ...data, items: newItems });
  };
  
  const removeItem = (index: number) => {
    setData({ ...data, items: (data.items || []).filter((_: any, i: number) => i !== index) });
  };

  const handleSave = () => {
    if (!data.client) return alert("Selecciona un cliente para guardar el documento.");
    if (!data.items || data.items.length === 0) return alert("Añade al menos una partida al documento.");
    onSave(data);
  };

  if (showPrint) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 overflow-y-auto pb-20 admin-light">
        <div className="bg-slate-800 p-4 sticky top-0 flex justify-between items-center print:hidden shadow-lg z-50">
           <h3 className="text-white font-bold text-lg">Vista Previa de Impresión</h3>
           <div className="flex gap-4">
             <button onClick={() => setShowPrint(false)} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors">Volver</button>
             <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors">Imprimir / Guardar PDF</button>
           </div>
        </div>
        <div className="mt-8 shadow-2xl mx-auto max-w-[800px] print:shadow-none print:m-0 print:mt-0">
           <PrintTemplate data={data} type={type} config={config} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-5xl text-slate-900 admin-light">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            {type === 'factura' ? 'Nueva Factura' : 'Nuevo Presupuesto'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Rellena los datos o utiliza el Asistente Inteligente</p>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancelar</button>
           <button onClick={() => setShowPrint(true)} className="px-4 py-2 bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 rounded-lg font-medium transition-colors">Ver PDF</button>
           <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-sm transition-colors">Guardar</button>
        </div>
      </div>

      {type === 'presupuesto' && (
        <div className="mb-8 p-5 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-blue-950 flex items-center gap-2">
              <Sparkles size={17} className="text-blue-600" /> Asistente Inteligente de Presupuestos
            </label>
            <span className="text-xs text-blue-600 bg-blue-100/80 px-2.5 py-0.5 rounded-full font-medium">IA Generativa</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input 
              type="text" 
              value={prompt} 
              onChange={e => setPrompt(e.target.value)} 
              placeholder="Ej: Instalar 2 splits Daikin en salón y cuarto con tubería y soporte..."
              className="flex-1 p-3 rounded-lg border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 font-medium shadow-sm transition-all"
              onKeyDown={e => {
                if (e.key === 'Enter' && !isAiLoading) {
                  e.preventDefault();
                  handleAiParse();
                }
              }}
            />
            <button 
              onClick={handleAiParse} 
              disabled={isAiLoading || !prompt.trim()} 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 transition-colors shadow-sm cursor-pointer"
            >
              {isAiLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Interpretando...</span>
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  <span>Interpretar</span>
                </>
              )}
            </button>
          </div>

          {/* Sugerencias rápidas para probar con 1 clic */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-xs text-blue-800 font-semibold">Ejemplos:</span>
            {[
              "Instalar 2 splits Daikin en salón y habitación",
              "Sustitución de caldera por equipo de aerotermia",
              "Mantenimiento anual preventivo de climatización",
              "Carga de gas refrigerante R32 y revisión de fugas"
            ].map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(sug)}
                className="text-xs bg-white text-blue-700 border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
              >
                + {sug}
              </button>
            ))}
          </div>

          {/* Feedback o Error de la IA */}
          {aiFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600 shrink-0"/> {aiFeedback}</span>
              <button onClick={() => setAiFeedback(null)} className="text-emerald-700 hover:text-emerald-900"><X size={14}/></button>
            </div>
          )}
          {aiError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><AlertCircle size={16} className="text-amber-600 shrink-0"/> {aiError}</span>
              <button onClick={() => setAiError(null)} className="text-amber-700 hover:text-amber-900"><X size={14}/></button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-3 border-t border-blue-200/60">
             <span className="text-xs font-medium text-blue-900">O extrae automáticamente las partidas de un PDF:</span>
             <input 
                type="file" 
                accept="application/pdf" 
                className="text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer" 
                onChange={async (e) => {
                   const file = e.target.files?.[0];
                   if (!file) return;
                   setIsAiLoading(true);
                   setAiFeedback(null);
                   setAiError(null);
                   try {
                     const reader = new FileReader();
                     reader.onload = async () => {
                       const base64Pdf = (reader.result as string).split(',')[1];
                       const res = await adminFetch('/api/obraclima/parse-pdf', {
                         method: 'POST',
                         headers: {'Content-Type': 'application/json'},
                         body: JSON.stringify({ base64Pdf })
                       });
                       const result = await res.json();
                       if (result.error) {
                         setAiError(result.error);
                       } else if (result.success && result.data) {
                          const parsedItems = (result.data.items || []).map((i: any) => ({
                             description: i.description || 'Partida extraída',
                             quantity: Number(i.quantity) || 1,
                             unitPrice: Number(i.unitPrice ?? i.price) || 0
                          }));
                          setData((prev: any) => ({
                             ...prev,
                             items: [...(prev.items || []), ...parsedItems],
                             notes: result.data.notes ? (prev.notes ? `${prev.notes}\n${result.data.notes}` : result.data.notes) : prev.notes
                          }));
                          setAiFeedback(`✓ Se han extraído ${parsedItems.length} partida(s) del documento PDF con éxito.`);
                       }
                       setIsAiLoading(false);
                     };
                     reader.readAsDataURL(file);
                   } catch(err: any) {
                     console.error(err);
                     setAiError(err.message || "Error procesando el archivo PDF.");
                     setIsAiLoading(false);
                   }
                }}
             />
          </div>
          <p className="text-[11px] text-blue-700/80">La IA añadirá los conceptos directamente a la tabla inferior. Podrás ajustar cantidades y precios en cualquier momento.</p>
        </div>
      )}

      <div className="mb-8">
        <label className="block text-sm font-bold text-slate-700 mb-2">Cliente Destinatario</label>
        <select 
          className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 font-medium"
          value={data.client?.id || ''}
          onChange={e => setData({ ...data, client: clients.find(c => c.id === e.target.value) || null })}
        >
          <option value="">Seleccione un cliente registrado...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name} - NIF: {c.nif || 'S/N'}</option>)}
        </select>
        {data.client && (
           <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed">
             <div className="font-bold text-slate-900">{data.client.name}</div>
             <div>{data.client.address || 'Sin dirección'}, {data.client.postalCode || ''} {data.client.city || ''} {data.client.province ? `(${data.client.province})` : ''}</div>
             <div className="text-xs text-slate-500 mt-1">NIF / CIF: <span className="font-mono font-medium text-slate-800">{data.client.nif || 'No indicado'}</span></div>
           </div>
        )}
      </div>

      <div className="mb-8">
        <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between items-center">
          <span>Partidas / Conceptos Valorados</span>
          <span className="text-xs font-normal text-slate-500">{(data.items || []).length} partida(s)</span>
        </label>
        
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
              <tr>
                <th className="p-3 w-24 text-center">Cant.</th>
                <th className="p-3">Concepto / Descripción</th>
                <th className="p-3 w-36 text-right">Precio/Ud</th>
                <th className="p-3 w-36 text-right">Importe</th>
                <th className="p-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {(data.items || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 bg-slate-50/50">
                    <p className="font-medium text-slate-700">No hay partidas en este documento.</p>
                    <p className="text-xs text-slate-500 mt-1">Escribe tu petición en el Asistente Inteligente o pulsa en "+ Añadir partida manual".</p>
                  </td>
                </tr>
              ) : (
                data.items.map((item: any, idx: number) => (
                  <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                    <td className="p-2.5">
                      <input 
                        type="number" 
                        min="1" 
                        value={item.quantity ?? 1} 
                        onChange={e => updateItem(idx, 'quantity', e.target.value)} 
                        className="w-full p-2 border border-slate-300 rounded-lg text-center outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 font-bold" 
                      />
                    </td>
                    <td className="p-2.5">
                      <input 
                        type="text" 
                        value={item.description || item.name || ''} 
                        onChange={e => updateItem(idx, 'description', e.target.value)} 
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 font-medium" 
                        placeholder="Descripción detallada del equipo o servicio..." 
                      />
                    </td>
                    <td className="p-2.5">
                      <div className="relative">
                        <input 
                          type="number" 
                          step="0.01"
                          value={item.unitPrice ?? item.price ?? 0} 
                          onChange={e => updateItem(idx, 'unitPrice', e.target.value)} 
                          className="w-full p-2 pr-6 border border-slate-300 rounded-lg text-right outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 font-bold" 
                        />
                        <span className="absolute right-2.5 top-2.5 text-slate-400 text-xs font-semibold">€</span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      {((Number(item.quantity) || 0) * (Number(item.unitPrice ?? item.price) || 0)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>
                    <td className="p-2 text-center">
                      <button 
                        onClick={() => removeItem(idx)} 
                        title="Eliminar partida" 
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <button onClick={addItem} className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-blue-50 transition-colors">
              <Plus size={16} /> Añadir partida manual
            </button>
            {(data.items || []).length > 0 && (
              <span className="text-xs text-slate-500 font-medium">
                Subtotal partidas: {((data.subtotal || 0)).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <label className="block text-sm font-bold text-slate-700 mb-2">Observaciones y Condiciones</label>
          <textarea 
            className="w-full h-32 p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm bg-white text-slate-900 placeholder:text-slate-400 font-normal leading-relaxed"
            placeholder="Detalles sobre el plazo de ejecución, validez de la oferta, forma de pago..."
            value={data.notes || ''}
            onChange={e => setData({ ...data, notes: e.target.value })}
          />
        </div>
        
        <div className="w-full md:w-80 bg-slate-50 p-6 rounded-xl border border-slate-200 self-start shadow-sm">
          <div className="flex justify-between items-center mb-3 text-slate-600 text-sm">
             <span>Base Imponible</span>
             <span className="font-semibold text-slate-900">{(data.subtotal || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between items-center mb-4 text-slate-600 text-sm">
             <span>IVA ({config?.defaultIva ?? 21}%)</span>
             <span className="font-semibold text-slate-900">{(data.tax || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-slate-300">
             <span className="font-black text-lg text-slate-900">TOTAL</span>
             <span className="font-black text-2xl text-blue-700">{(data.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
          </div>
        </div>
      </div>

    </div>
  );
}
