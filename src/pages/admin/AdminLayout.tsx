import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Store, MessageSquare, Settings, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<'admin' | 'business'>('admin');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      } else {
        let userRole = 'business'; // Default
        
        // Intentar leer de user_metadata primero por si está ahí
        if (session.user.user_metadata?.role) {
          userRole = session.user.user_metadata.role;
        }

        // Consultamos el rol real a la tabla profiles
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
          
        if (error) {
          console.error('Error al obtener perfil (posible recursión RLS):', error);
        }

        if (profile?.role) {
          userRole = profile.role;
        }
        
        setRole(userRole as 'admin' | 'business');
      }
      setLoading(false);
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          navigate('/login');
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Cargando panel...</div>;
  }

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={20} />, roles: ['admin', 'business'] },
    { name: 'Mi Negocio', path: '/admin/business', icon: <Store size={20} />, roles: ['business'] },
    { name: 'Negocios (Todos)', path: '/admin/businesses', icon: <Store size={20} />, roles: ['admin'] },
    { name: 'Conversaciones', path: '/admin/chats', icon: <MessageSquare size={20} />, roles: ['admin'] },
    { name: 'Configuración', path: '/admin/config', icon: <Settings size={20} />, roles: ['admin'] },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold tracking-tight">Panel Vigo</h2>
          <p className="text-slate-400 text-sm mt-1">
            Nivel: {role === 'admin' ? 'Administrador' : 'Negocio'}
          </p>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.filter(item => item.roles.includes(role)).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
