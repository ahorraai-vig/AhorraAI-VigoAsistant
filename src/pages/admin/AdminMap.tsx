import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Tag } from 'lucide-react';

// Fix leaflet default icon issue with vite
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

export default function AdminMap() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchBusinesses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('businesses')
        .select('*');
      
      if (!error && data) {
        setBusinesses(data.filter(b => b.latitude && b.longitude));
      }
      setLoading(false);
    };

    fetchBusinesses();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    businesses.forEach(b => {
      if (b.category) cats.add(b.category);
      else cats.add('Otros');
    });
    return Array.from(cats).sort();
  }, [businesses]);

  const filteredBusinesses = useMemo(() => {
    if (!selectedCategory) return businesses;
    return businesses.filter(b => (b.category || 'Otros') === selectedCategory);
  }, [businesses, selectedCategory]);

  const vigoCenter: [number, number] = [42.2328, -8.7226]; // roughly Vigo center

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-120px)] md:h-[calc(100vh-80px)]">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mapa de Negocios</h1>
        <p className="text-slate-500 mt-1">Explora la ubicación de los negocios registrados según su sector.</p>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
            selectedCategory === null 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-1.5 ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Tag size={14} className={selectedCategory === cat ? 'text-blue-200' : 'text-slate-400'} />
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center">
            <span className="text-slate-600 font-medium">Cargando ubicaciones...</span>
          </div>
        )}
        <MapContainer center={vigoCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {filteredBusinesses.map(biz => (
            <Marker key={biz.id} position={[biz.latitude, biz.longitude]}>
              <Popup>
                <div className="text-sm font-sans p-1">
                  <div className="font-bold text-slate-900 mb-1">{biz.name}</div>
                  <div className="text-blue-600 text-xs font-medium mb-1.5">{biz.category || 'Otros'}</div>
                  <div className="text-slate-500 text-xs flex items-center gap-1">
                    <MapPin size={12} className="shrink-0" />
                    <span>{biz.address || 'Sin dirección'}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
