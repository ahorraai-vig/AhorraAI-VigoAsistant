import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, MessageSquare, Tag, Globe } from 'lucide-react';

export default function AdminChats() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
          
        if (!error && data) {
          setConversations(data);
        }
      } catch (err) {
        console.error('Error loading conversations:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchConversations();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Conversaciones</h1>
        <p className="text-slate-500 mt-1">Historial de conversaciones recientes.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando historial...</div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No hay conversaciones registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <th className="p-4 font-medium">Fecha</th>
                  <th className="p-4 font-medium">Idioma</th>
                  <th className="p-4 font-medium">Tiempo</th>
                  <th className="p-4 font-medium">Intereses</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {conversations.map((conv) => (
                  <tr key={conv.id || conv.session_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-600">
                      {new Date(conv.created_at).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2 text-slate-700">
                        <Globe size={14} className="text-blue-500" />
                        <span>{conv.language || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2 text-slate-700">
                        <Clock size={14} className="text-amber-500" />
                        <span>{conv.time_available || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2 text-slate-700">
                        <Tag size={14} className="text-emerald-500" />
                        <span>{conv.interests?.join(', ') || 'N/A'}</span>
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
