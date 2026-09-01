import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Store, MessageSquare, Settings, LogOut, Menu, X, ArrowLeft, Handshake, MapPin, Bot } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<'admin' | 'business'>('admin');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-medium">Cargando panel...</div>;
  }

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={20} />, roles: ['admin', 'business'] },
    { name: 'Agente Prospector', path: '/admin/prospector', icon: <Bot size={20} />, roles: ['admin'] },
    { name: 'Grafo de Cooperación', path: '/admin/cooperacion', icon: <Handshake size={20} />, roles: ['admin'] },
    { name: 'Mi Negocio', path: '/admin/business', icon: <Store size={20} />, roles: ['business'] },
    { name: 'Negocios (Todos)', path: '/admin/businesses', icon: <Store size={20} />, roles: ['admin'] },
    { name: 'Mapa de Negocios', path: '/admin/map', icon: <MapPin size={20} />, roles: ['admin'] },
    { name: 'Conversaciones', path: '/admin/chats', icon: <MessageSquare size={20} />, roles: ['admin'] },
    { name: 'Configuración', path: '/admin/config', icon: <Settings size={20} />, roles: ['admin'] },
  ];

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-slate-50 font-sans overflow-hidden">
      {/* Topbar móvil (visible solo en pantallas pequeñas) */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 text-white z-30 shrink-0 border-b border-slate-800 shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -ml-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
            aria-label="Abrir menú de navegación"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">Panel Vigo</h1>
            <p className="text-[11px] text-slate-400">
              {role === 'admin' ? 'Administrador' : 'Negocio'}
            </p>
          </div>
        </div>

        <Link
          to="/"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-full transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Ir al Chat</span>
        </Link>
      </header>

      {/* Overlay Backdrop en móvil cuando el menú está abierto */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sidebar / Panel Lateral (Fijo en desktop, deslizable lateral en móvil) */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300 ease-in-out shrink-0 shadow-2xl md:shadow-none ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5 md:p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Panel Vigo</h2>
            <p className="text-slate-400 text-xs md:text-sm mt-0.5">
              Nivel: <span className="text-blue-400 font-medium">{role === 'admin' ? 'Administrador' : 'Negocio'}</span>
            </p>
          </div>
          {/* Botón cerrar para móvil */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 py-4 md:py-6 px-3 space-y-1.5 overflow-y-auto">
          {navItems.filter(item => item.roles.includes(role)).map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Acciones inferiores */}
        <div className="p-4 border-t border-slate-800 space-y-1.5">
          <Link
            to="/"
            className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors"
          >
            <ArrowLeft size={18} className="mr-3 text-slate-400" />
            Volver al Asistente
          </Link>
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-colors"
          >
            <LogOut size={18} className="mr-3" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido Principal con Scroll Independiente */}
      <main className="flex-1 overflow-y-auto min-w-0 bg-slate-50 w-full">
        <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

