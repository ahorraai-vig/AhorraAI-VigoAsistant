import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminBusiness() {
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);

  useEffect(() => {
    const fetchBusiness = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', session.user.id)
        .single();

      if (data) {
        setBusiness(data);
      } else {
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching business:', error);
        }
      }
      setLoading(false);
    };

    fetchBusiness();
  }, []);

  if (loading) {
    return <div className="text-slate-500">Cargando datos de tu negocio...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mi Negocio</h1>
        <p className="text-slate-500 mt-1">Gestiona la información de tu establecimiento.</p>
      </div>

      {business ? (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">{business.name}</h2>
          <div className="space-y-2">
            <p><span className="font-medium text-slate-700">Descripción:</span> {business.description || 'No especificada'}</p>
            <p><span className="font-medium text-slate-700">Dirección:</span> {business.address || 'No especificada'}</p>
            <p><span className="font-medium text-slate-700">Teléfono:</span> {business.phone || 'No especificado'}</p>
            <p><span className="font-medium text-slate-700">Sitio Web:</span> {business.website || 'No especificado'}</p>
            <p><span className="font-medium text-slate-700">Estado:</span> {business.is_active ? 'Activo' : 'Inactivo'}</p>
          </div>
          <button className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Editar Información
          </button>
        </div>
      ) : (
        <div className="bg-white p-8 text-center rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-400 mb-4">No tienes ningún negocio registrado todavía.</div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Registrar mi Negocio
          </button>
        </div>
      )}
    </div>
  );
}
