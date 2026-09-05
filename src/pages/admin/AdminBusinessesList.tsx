import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { adminFetch } from '../../lib/apiAuth';
import { Plus, Edit2, Trash2, MapPin, Store, CheckCircle2, XCircle, RefreshCw, Key, ShieldCheck, Tag, Search } from 'lucide-react';

export default function AdminBusinessesList() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [currentBusiness, setCurrentBusiness] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    zone: '',
    access_code: '',
    honesty_status: 'OBSERVADO',
    description: '',
    address: '',
    phone: '',
    website: '',
    latitude: '',
    longitude: '',
    opening_hours: '{}',
    cooperation_offers: '',
    cooperation_needs: '',
    cooperation_valleyHours: '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredBusinesses = businesses.filter(b => 
    (b.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.zone || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEnrichAll = async () => {
    setEnriching(true);
    setNotification(null);
    try {
      const res = await adminFetch('/api/cooperation/enrich-database', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setNotification(data.message);
        await fetchBusinesses();
      } else {
        alert(data.error || 'Error al enriquecer');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setEnriching(false);
    }
  };

  const handleAddNew = () => {
    setCurrentBusiness(null);
    setFormData({
      name: '',
      category: 'Comercio Local',
      zone: 'Vigo Centro',
      access_code: '',
      honesty_status: 'DICHO',
      description: '',
      address: '',
      phone: '',
      website: '',
      latitude: '',
      longitude: '',
      opening_hours: '{}',
      cooperation_offers: '',
      cooperation_needs: '',
      cooperation_valleyHours: '',
      is_active: true
    });
    setView('form');
  };

  const handleEdit = (business: any) => {
    setCurrentBusiness(business);
    setFormData({
      name: business.name || '',
      category: business.category || 'Comercio Local',
      zone: business.zone || 'Vigo Centro',
      access_code: business.access_code || '',
      honesty_status: business.honesty_status || 'OBSERVADO',
      description: business.description || '',
      address: business.address || '',
      phone: business.phone || '',
      website: business.website || '',
      latitude: business.latitude || '',
      longitude: business.longitude || '',
      opening_hours: typeof business.opening_hours === 'string' 
        ? business.opening_hours 
        : JSON.stringify(business.opening_hours || {}),
      cooperation_offers: (business.cooperation?.offers || []).join(', '),
      cooperation_needs: (business.cooperation?.needs || []).join(', '),
      cooperation_valleyHours: business.cooperation?.valleyHours || '',
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
        category: formData.category,
        zone: formData.zone,
        access_code: formData.access_code || undefined,
        honesty_status: formData.honesty_status,
        description: formData.description,
        address: formData.address,
        phone: formData.phone,
        website: formData.website,
        is_active: formData.is_active,
        cooperation: {
          offers: formData.cooperation_offers.split(',').map(s => s.trim()).filter(Boolean),
          needs: formData.cooperation_needs.split(',').map(s => s.trim()).filter(Boolean),
          valleyHours: formData.cooperation_valleyHours
        }
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
              Rellena los datos estructurados del establecimiento.
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>
            
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoría / Sector</label>
              <input 
                type="text"
                value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
                placeholder="Ej. Hostelería, Salud y Farmacia, Deporte..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Zona de Vigo</label>
              <input 
                type="text"
                value={formData.zone} onChange={e => setFormData({...formData, zone: e.target.value})}
                placeholder="Ej. Casco Vello, Calvario, Príncipe..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado de Honestidad</label>
              <select
                value={formData.honesty_status}
                onChange={e => setFormData({...formData, honesty_status: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none bg-white"
              >
                <option value="DICHO">DICHO (Validado por el comerciante)</option>
                <option value="OBSERVADO">OBSERVADO (Extraído automáticamente)</option>
                <option value="SIN_CONFIRMAR">SIN_CONFIRMAR (Pendiente)</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Clave de Acceso Única</label>
              <input 
                type="text"
                value={formData.access_code} onChange={e => setFormData({...formData, access_code: e.target.value})}
                placeholder="Ej. VIGO-4432-CASCO (Dejar vacío para autogenerar)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none font-mono text-sm uppercase"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <textarea 
                rows={3}
                value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none resize-none"
              ></textarea>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Dirección Física</label>
              <input 
                type="text"
                value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input 
                type="text"
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sitio Web</label>
              <input 
                type="url"
                value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Latitud (Opcional)</label>
              <input 
                type="number" step="any"
                value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Longitud (Opcional)</label>
              <input 
                type="number" step="any"
                value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Horario (Formato JSON)</label>
              <textarea 
                rows={2}
                value={formData.opening_hours} onChange={e => setFormData({...formData, opening_hours: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none font-mono text-sm"
              ></textarea>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Ofertas para la red (separado por comas)</label>
              <input 
                type="text"
                value={formData.cooperation_offers} onChange={e => setFormData({...formData, cooperation_offers: e.target.value})}
                placeholder="Ej. Tapa gratis, 10% descuento"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Necesidades de aliados (separado por comas)</label>
              <input 
                type="text"
                value={formData.cooperation_needs} onChange={e => setFormData({...formData, cooperation_needs: e.target.value})}
                placeholder="Ej. Atraer turistas, Llenar mañanas"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Horas Valle a Dinamizar</label>
              <input 
                type="text"
                value={formData.cooperation_valleyHours} onChange={e => setFormData({...formData, cooperation_valleyHours: e.target.value})}
                placeholder="Ej. Martes a jueves de 16:00 a 19:00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-600"
                />
                <span className="text-sm font-medium text-slate-700">Negocio Activo (Visible en la Red)</span>
              </label>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Negocios ({businesses.length})</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestión de todos los negocios registrados en la base de datos de Vigo.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleEnrichAll}
            disabled={enriching}
            className="flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-2.5 rounded-xl font-medium shadow-xs transition-all disabled:opacity-50 text-sm"
            title="Estructura las fichas antiguas extrayendo categorías y zonas sin inventar datos."
          >
            <RefreshCw size={16} className={enriching ? 'animate-spin text-blue-600' : 'text-slate-500'} />
            <span>{enriching ? 'Estructurando...' : 'Estructurar Fichas Antiguas (IA)'}</span>
          </button>

          <button 
            onClick={handleAddNew}
            className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition shadow-xs text-sm"
          >
            <Plus size={16} />
            <span>Añadir Negocio</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold">
            Cerrar
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, zona o dirección..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando negocios...</div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Store size={48} className="text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">Sin negocios</h3>
            <p className="text-slate-500 mb-4">No hay ningún negocio registrado o que coincida con la búsqueda.</p>
            <button onClick={handleAddNew} className="text-blue-600 font-medium hover:underline">
              Crea el primero ahora
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {Object.entries(
              filteredBusinesses.reduce((acc, biz) => {
                const category = biz.category || 'Otros';
                if (!acc[category]) acc[category] = [];
                acc[category].push(biz);
                return acc;
              }, {} as Record<string, any[]>)
            ).sort(([a], [b]) => a.localeCompare(b)).map(([category, rawBizList]) => {
              const bizList = rawBizList as any[];
              return (
              <div key={category} className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Tag size={18} className="text-blue-500" />
                  {category} <span className="text-sm font-normal text-slate-500">({bizList.length})</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bizList.map((biz: any) => (
                    <div key={biz.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow relative group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-slate-900 truncate pr-4" title={biz.name}>{biz.name}</div>
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-white/80 rounded-md backdrop-blur-sm">
                          <button onClick={() => handleEdit(biz)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Editar">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleDelete(biz.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition" title="Eliminar">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-slate-500 space-y-1.5 mb-3">
                        {biz.access_code && (
                          <div className="flex items-center gap-1.5 text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded-md inline-flex">
                            <Key size={12} />
                            <span>{biz.access_code}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 truncate" title={biz.address || 'Sin dirección'}>
                          <MapPin size={13} className="shrink-0" />
                          <span>{biz.address || 'Sin dirección'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="shrink-0 opacity-0" /> {/* Spacer */}
                          <span>Zona: {biz.zone || 'Vigo'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          biz.honesty_status === 'DICHO' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          <ShieldCheck size={10} className="mr-1" />
                          {biz.honesty_status || 'OBSERVADO'}
                        </span>
                        
                        {biz.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 ml-auto">
                            <CheckCircle2 size={10} className="mr-1" /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-800 ml-auto">
                            <XCircle size={10} className="mr-1" /> Inactivo
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
