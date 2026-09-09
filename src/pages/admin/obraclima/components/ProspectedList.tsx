import React, { useState, useMemo } from 'react';
import { 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Database, 
  ChevronDown, 
  ChevronUp, 
  Image as ImageIcon,
  Plus,
  Layers,
  Sparkles
} from 'lucide-react';
import { shouldAttachImage } from '../../../../../server/services/obraclima/productCardPolicy';

export interface ProspectedListProps {
  items: any[];
  loading?: boolean;
  onRefresh?: () => void;
  onAdoptToOfficial?: (item: any) => void;
  onOpenUrl?: (url: string) => void;
}

export function ProspectedList({
  items,
  loading = false,
  onRefresh,
  onAdoptToOfficial,
  onOpenUrl
}: ProspectedListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((p: any) => {
      const name = (p.nombre || p.name || '').toLowerCase();
      const sku = (p.sku || p.code || '').toLowerCase();
      const desc = (p.description_short || p.descripcion || p.description_raw || '').toLowerCase();
      const cat = (p.categoria || p.category || '').toLowerCase();
      const origin = (p.origen_url || '').toLowerCase();
      return name.includes(term) || sku.includes(term) || desc.includes(term) || cat.includes(term) || origin.includes(term);
    });
  }, [items, searchTerm]);

  const handleLinkClick = (e: React.MouseEvent, url: string) => {
    if (onOpenUrl) {
      e.preventDefault();
      onOpenUrl(url);
    }
  };

  return (
    <div className="space-y-3">
      {/* Top Header & Search Bar */}
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-emerald-700 shrink-0" />
          <span>
            Referencias del <strong>Cerebro IA de ObraClima</strong> (precios de mercado y fichas técnicas extraídas).
          </span>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md whitespace-nowrap">
            {filteredItems.length} Registros
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por producto, SKU, categoría o tienda..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 placeholder:text-slate-400"
          />
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Actualizar catálogo de prospección"
            className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-100 transition flex items-center gap-1 text-xs font-medium"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-600' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        )}
      </div>

      {/* Main List Container */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Table for standard / desktop views */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
              <tr>
                <th className="p-3 font-semibold w-24">Ref / SKU</th>
                <th className="p-3 font-semibold w-16 text-center">Img</th>
                <th className="p-3 font-semibold">Producto y Ficha Técnica</th>
                <th className="p-3 font-semibold w-32">Proveedor</th>
                <th className="p-3 font-semibold w-24 text-right">Precio</th>
                <th className="p-3 font-semibold w-28 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((p: any) => {
                const itemId = p.id || p.sku || p.origen_url;
                const isExpanded = expandedId === itemId;
                const name = p.nombre || p.name || 'Producto';
                const priceNum = p.precio !== undefined && p.precio !== null ? Number(p.precio) : (p.price !== undefined ? Number(p.price) : null);
                const desc = p.description_short || p.descripcion || p.description_raw;
                const imgUrl = p.image_cached_path || p.image_url;
                const hasValidImg = shouldAttachImage({ image_url: p.image_url, image_cached_path: p.image_cached_path });

                let hostname = 'Proveedor';
                if (p.origen_url) {
                  try {
                    hostname = new URL(p.origen_url).hostname.replace(/^www\./, '');
                  } catch {
                    hostname = 'Externo';
                  }
                }

                return (
                  <React.Fragment key={itemId}>
                    <tr className="hover:bg-slate-50/80 transition">
                      {/* SKU / Ref */}
                      <td className="p-3 align-top font-mono text-xs font-semibold text-emerald-800">
                        {p.sku || <span className="text-slate-400 font-normal italic">S/R</span>}
                      </td>

                      {/* Image Thumbnail / Policy Check */}
                      <td className="p-3 align-top text-center">
                        {hasValidImg && imgUrl ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center shrink-0">
                            <img
                              src={imgUrl}
                              alt={name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-dashed border-slate-200 mx-auto flex items-center justify-center text-slate-300">
                            <ImageIcon size={14} />
                          </div>
                        )}
                      </td>

                      {/* Product Name & Short Description */}
                      <td className="p-3 align-top">
                        <div className="font-semibold text-slate-900 text-sm">{name}</div>
                        {p.categoria && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{p.categoria}</div>
                        )}
                        {desc && (
                          <div className="text-xs text-slate-600 line-clamp-2 mt-1">
                            {p.description_short || desc}
                          </div>
                        )}
                        {(desc || (Array.isArray(p.specs) && p.specs.length > 0)) && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : itemId)}
                            className="text-[11px] text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 mt-1 font-medium"
                          >
                            <span>{isExpanded ? 'Ocultar detalles' : 'Ver ficha técnica y medidas'}</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </td>

                      {/* Provider Hostname */}
                      <td className="p-3 align-top text-xs text-slate-600">
                        {p.origen_url ? (
                          <a
                            href={p.origen_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => handleLinkClick(e, p.origen_url)}
                            className="text-blue-600 hover:underline flex items-center gap-1 font-medium truncate max-w-[130px]"
                            title={p.origen_url}
                          >
                            <span className="truncate">{hostname}</span>
                            <ExternalLink size={11} className="shrink-0" />
                          </a>
                        ) : (
                          <span>{hostname}</span>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(p.fecha_captura || Date.now()).toLocaleDateString('es-ES')}
                        </div>
                      </td>

                      {/* Price */}
                      <td className="p-3 align-top font-bold text-slate-900 text-right whitespace-nowrap">
                        {priceNum !== null
                          ? `${priceNum.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`
                          : <span className="text-slate-400 font-normal text-xs">Consultar</span>}
                      </td>

                      {/* Adopt Button */}
                      <td className="p-3 align-top text-center">
                        {onAdoptToOfficial && (
                          <button
                            type="button"
                            onClick={() => onAdoptToOfficial(p)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-lg text-xs font-medium transition inline-flex items-center gap-1 shadow-2xs"
                            title="Copiar a tarifas oficiales de ObraClima"
                          >
                            <Plus size={12} />
                            <span>Catálogo</span>
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Technical Details & Specs */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70 border-t border-slate-100">
                        <td colSpan={6} className="p-3 pl-8">
                          <div className="text-xs text-slate-700 bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
                            {Array.isArray(p.specs) && p.specs.length > 0 && (
                              <div>
                                <span className="font-semibold text-slate-900 block mb-1">Especificaciones Técnicas:</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {p.specs.map((s: any, idx: number) => (
                                    <div key={idx} className="flex items-baseline gap-1 text-[11px] bg-slate-50 p-1 rounded">
                                      <span className="font-medium text-slate-600">{s.label || s.key}:</span>
                                      <span className="text-slate-900">{s.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {desc && (
                              <div>
                                <span className="font-semibold text-slate-900 block mb-1">Descripción Completa:</span>
                                <div className="whitespace-pre-line text-slate-600 max-h-60 overflow-y-auto">
                                  {desc}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-xs">
            {searchTerm ? 'No se encontraron productos con ese filtro de búsqueda.' : 'No hay productos prospectados todavía. Añade una URL arriba para alimentar el catálogo.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProspectedList;
