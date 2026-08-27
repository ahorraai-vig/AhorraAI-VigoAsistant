import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, MapPin, Store, CheckCircle2, XCircle } from 'lucide-react';

export default function AdminBusinessesList() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [currentBusiness, setCurrentBusiness] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    website: '',
    latitude: '',
    longitude: '',
    opening_hours: '{}',
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  const fetchBusinesses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching businesses:', error);
    } else {
      setBusinesses(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const handleAddNew = () => {
    setCurrentBusiness(null);
    setFormData({
      name: '',
      description: '',
      address: '',
      phone: '',
      website: '',
      latitude: '',
      longitude: '',
      opening_hours: '{}',
      is_active: true
    });
    setView('form');
  };

  const handleEdit = (business: any) => {
    setCurrentBusiness(business);
    setFormData({
      name: business.name || '',
      description: business.description || '',
      address: business.address || '',
      phone: business.phone || '',
      website: business.website || '',
      latitude: business.latitude || '',
      longitude: business.longitude || '',
      opening_hours: typeof business.opening_hours === 'string' 
        ? business.opening_hours 
        : JSON.stringify(business.opening_hours || {}),
      is_active: business.is_active ?? true
    });
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este negocio? Esta acción no se puede deshacer.')) {
      const { error } = await supabase.from('businesses').delete().eq('id', id);
      if (error) {
        alert('Error al eliminar: ' + error.message);
      } else {
        fetchBusinesses();
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Prepare payload
      const payload: any = {
        name: formData.name,
        description: formData.description,
        address: formData.address,
        phone: formData.phone,
        website: formData.website,
        is_active: formData.is_active
      };

      if (formData.latitude) payload.latitude = parseFloat(formData.latitude);
      if (formData.longitude) payload.longitude = parseFloat(formData.longitude);
      
      try {
        payload.opening_hours = JSON.parse(formData.opening_hours);
      } catch (err) {
        payload.opening_hours = {}; // fallback
      }

      if (currentBusiness) {
        // Update
        const { error } = await supabase
          .from('businesses')
          .update(payload)
          .eq('id', currentBusiness.id);
        if (error) throw error;
      } else {
        // Insert (needs owner_id)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No estás autenticado');
        
        payload.owner_id = user.id;
        const { error } = await supabase
          .from('businesses')
          .insert(payload);
        if (error) throw error;
      }

      setView('list');
      fetchBusinesses();
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (view === 'form') {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {currentBusiness ? 'Editar Negocio' : 'Nuevo Negocio'}
            </h1>
            <p className="text-slate-500 mt-1">
              Rellena los datos del establecimiento.
            </p>
          </div>
          <button 
            onClick={() => setView('list')}
            className="text-slate-500 hover:text-slate-700 font-medium"
          >
            Volver al listado
          </button>
        </div>

        <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input 
                type="text" required
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>
            
            <div className="col-span-2 md:col-span-1 flex items-center mt-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-600"
                />
                <span className="text-sm font-medium text-slate-700">Negocio Activo (Visible)</span>
              </label>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <textarea 
                rows={3}
                value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none resize-none"
              ></textarea>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Dirección Física</label>
              <input 
                type="text"
                value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input 
                type="text"
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sitio Web</label>
              <input 
                type="url"
                value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Latitud (Opcional)</label>
              <input 
                type="number" step="any"
                value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Longitud (Opcional)</label>
              <input 
                type="number" step="any"
                value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Horario (Formato JSON)</label>
              <textarea 
                rows={2}
                value={formData.opening_hours} onChange={e => setFormData({...formData, opening_hours: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none font-mono text-sm"
              ></textarea>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button 
              type="button" onClick={() => setView('list')}
              className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition"
            >
              Cancelar
            </button>
            <button 
              type="submit" disabled={saving}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Negocio'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Negocios</h1>
          <p className="text-slate-500 mt-1">Gestión de todos los negocios registrados en la plataforma.</p>
        </div>
        <button 
          onClick={handleAddNew}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          <Plus size={18} />
          <span>Añadir Negocio</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando negocios...</div>
        ) : businesses.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Store size={48} className="text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">Sin negocios</h3>
            <p className="text-slate-500 mb-4">No hay ningún negocio registrado todavía.</p>
            <button onClick={handleAddNew} className="text-blue-600 font-medium hover:underline">
              Crea el primero ahora
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 font-medium">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Dirección</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {businesses.map(biz => (
                  <tr key={biz.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {biz.name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1 text-slate-500">
                        <MapPin size={14} />
                        <span className="truncate max-w-[200px]">{biz.address || 'Sin dirección'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {biz.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle2 size={12} className="mr-1" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          <XCircle size={12} className="mr-1" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        <button 
                          onClick={() => handleEdit(biz)}
                          className="text-blue-600 hover:text-blue-800 transition p-1"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(biz.id)}
                          className="text-red-500 hover:text-red-700 transition p-1"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
