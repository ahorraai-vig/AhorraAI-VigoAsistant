import { useEffect, useState } from 'react';
import { Users, MessageSquare, TrendingUp, Store } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    conversations: 0,
    users: 0,
    businesses: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Pedimos el contador exacto para cada tabla
        const [convRes, bizRes, profRes] = await Promise.all([
          supabase.from('conversations').select('*', { count: 'exact', head: true }),
          supabase.from('businesses').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true })
        ]);
        
        setStats({
          conversations: convRes.count || 0,
          businesses: bizRes.count || 0,
          users: profRes.count || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard General</h1>
        <p className="text-slate-500 mt-1">Resumen de la actividad en Asistente Vigo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Conversaciones', value: loading ? '...' : stats.conversations, icon: <MessageSquare size={20} className="text-blue-600" /> },
          { label: 'Usuarios y Admins', value: loading ? '...' : stats.users, icon: <Users size={20} className="text-emerald-600" /> },
          { label: 'Negocios Activos', value: loading ? '...' : stats.businesses, icon: <Store size={20} className="text-amber-600" /> },
          { label: 'Satisfacción', value: '4.8/5', icon: <TrendingUp size={20} className="text-purple-600" /> }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-500">{stat.label}</h3>
              <div className="p-2 bg-slate-50 rounded-lg">{stat.icon}</div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-8 h-64 flex items-center justify-center">
        <p className="text-slate-400 font-medium">El gráfico de actividad irá aquí (requiere componentes de charts adicionales)</p>
      </div>
    </div>
  );
}
