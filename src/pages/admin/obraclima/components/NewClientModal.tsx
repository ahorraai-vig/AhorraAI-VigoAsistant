import React, { useState } from 'react';
import { X, UserPlus, ShieldCheck, Lock, CheckCircle2, AlertCircle, Building, MapPin, Phone, Mail, FileText } from 'lucide-react';
import { adminFetch } from '../../../../lib/apiAuth';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (newClient?: any) => void;
}

export default function NewClientModal({ isOpen, onClose, onSaved }: NewClientModalProps) {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    name: '',
    nif: '',
    address: '',
    postalCode: '',
    city: 'Vigo',
    province: 'Pontevedra',
    phone: '',
    email: '',
    rgpdAccepted: true
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('El nombre o razón social es obligatorio.');
      return;
    }

    if (!formData.rgpdAccepted) {
      setError('Debe confirmar la cláusula de protección de datos y aislamiento de IA.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        name: formData.name.trim(),
        nif: formData.nif.trim(),
        address: formData.address.trim(),
        postalCode: formData.postalCode.trim(),
        city: formData.city.trim() || 'Vigo',
        province: formData.province.trim() || 'Pontevedra',
        phone: formData.phone.trim(),
        email: formData.email.trim()
      };

      const res = await adminFetch('/api/obraclima/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al guardar el cliente');
      }

      const savedClient = await res.json();
      setSuccess(true);
      setTimeout(() => {
        onSaved(savedClient);
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar el cliente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Añadir Nuevo Cliente
                <span className="text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> RGPD + AI Act
                </span>
              </h2>
              <p className="text-xs text-slate-400">Directorio oficial de clientes de ObraClima S.L.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Cliente registrado y protegido con éxito.</span>
            </div>
          )}

          {/* Formulario de Datos */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre / Razón Social <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Mari Carmen Alonso Vicente / Instalaciones Clima S.L."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  NIF / CIF
                </label>
                <input
                  type="text"
                  placeholder="Ej: 76891822Q / B27804456"
                  value={formData.nif}
                  onChange={(e) => setFormData({ ...formData, nif: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Teléfono
                </label>
                <input
                  type="tel"
                  placeholder="Ej: 600 123 456"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Dirección Postal
              </label>
              <input
                type="text"
                placeholder="Ej: C/ Julio Xesto nº 2, Segundo C"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">C. Postal</label>
                <input
                  type="text"
                  placeholder="36200"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Población</label>
                <input
                  type="text"
                  placeholder="Vigo"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Provincia</label>
                <input
                  type="text"
                  placeholder="Pontevedra"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Correo Electrónico (para presupuestos/facturas)
              </label>
              <input
                type="email"
                placeholder="cliente@ejemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Bloque Legal de Cumplimiento RGPD & Regulación IA */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-xs space-y-2 text-slate-300">
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs border-b border-slate-800 pb-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Garantía de Protección de Datos (RGPD) & Gobernanza de IA</span>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-400">
              <strong className="text-slate-300">Responsable:</strong> ObraClima S.L. &bull; <strong className="text-slate-300">Finalidad:</strong> Elaboración de presupuestos oficiales, facturación y ejecución de servicios de climatización y reformas.
            </p>

            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-2 flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-emerald-300/90">
                <strong className="text-emerald-300">Aislamiento de IA (AI Act):</strong> Los datos identificativos (nombre, NIF, dirección, teléfono) permanecen custodiados en la base de datos interna y <strong className="underline">NUNCA se transmiten a modelos externos de IA</strong>. Cuando se genera un presupuesto con IA, el modelo solo procesa conceptos técnicos de obra seudonimizados.
              </p>
            </div>

            <p className="text-[10px] text-slate-500">
              Derechos ARSOPOL (acceso, rectificación, supresión y limitación): administracion@obraclima.com.
            </p>

            <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.rgpdAccepted}
                onChange={(e) => setFormData({ ...formData, rgpdAccepted: e.target.checked })}
                className="mt-0.5 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 w-4 h-4"
              />
              <span className="text-[11px] text-slate-300 leading-snug">
                He informado al cliente conforme a la LOPD-GDD y confirmo el aislamiento de sus datos frente a sistemas de Inteligencia Artificial.
              </span>
            </label>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{saving ? 'Guardando...' : 'Guardar Cliente'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
