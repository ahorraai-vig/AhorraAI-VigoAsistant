import React from 'react';

export default function PrintTemplate({ data, type, config, preview }: { data: any, type: 'presupuesto' | 'factura', config: any, preview?: boolean }) {
  if (!data) return null;

  return (
    <div className={`${preview ? 'block' : 'hidden print:block'} w-full text-[11px] font-sans text-black max-w-[800px] mx-auto bg-white min-h-screen p-6 shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0`}>
      
      {/* HEADER: COMPANY INFO & LOGO */}
      <div className="flex justify-between items-start mb-8">
        <div className="border border-black p-2 w-[55%]">
          <div className="flex"><span className="font-bold w-24">NOMBRE:</span> <span>{config.companyName}</span></div>
          <div className="flex"><span className="font-bold w-24">DIRECCION:</span> <span>{config.address}</span></div>
          <div className="flex"><span className="font-bold w-24">CODIGO POSTAL:</span> <span>{config.postalCode}</span></div>
          <div className="flex"><span className="font-bold w-24">POBLACION:</span> <span>{config.city}</span></div>
          <div className="flex"><span className="font-bold w-24">PROVINCIA:</span> <span>{config.province}</span></div>
          <div className="flex"><span className="font-bold w-24">N.I.F.:</span> <span>{config.nif}</span></div>
        </div>
        <div className="w-[40%] flex flex-col items-end">
          {/* Logo Placeholder */}
          <div className="h-20 w-40 flex items-center justify-center font-bold text-red-600 text-2xl tracking-tighter" style={{ fontFamily: 'Impact, sans-serif' }}>
            <div className="flex flex-col items-center">
               <div className="flex gap-1 mb-1">
                  <div className="w-16 h-3 bg-slate-700 -skew-x-12"></div>
                  <div className="w-16 h-3 bg-red-600 -skew-x-12"></div>
               </div>
               <div className="flex gap-1 mb-1">
                  <div className="w-20 h-4 bg-slate-800 -skew-x-12"></div>
                  <div className="w-20 h-4 bg-red-600 -skew-x-12"></div>
               </div>
               <div className="text-xl">ObraClima S.L.</div>
               <div className="text-[7px] text-slate-500 font-normal tracking-normal uppercase">Obras • Reformas • Climatización</div>
            </div>
          </div>
          <div className="mt-6 font-bold text-xs">FECHA : {new Date(data.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      {/* CLIENT DATA */}
      <div className="flex justify-end mb-8">
        <div className="border border-black w-[60%]">
          <div className="text-center font-bold border-b border-black text-xs py-0.5 bg-slate-100">DATOS DEL CLIENTE</div>
          <div className="p-2">
            <div className="flex"><span className="font-bold w-28">NOMBRE:</span> <span>{data.client?.name || data.customer?.name}</span></div>
            <div className="flex"><span className="font-bold w-28">DIRECCIÓN:</span> <span>{data.client?.address || data.customer?.address}</span></div>
            <div className="flex"><span className="font-bold w-28">CODIGO POSTAL:</span> <span>{data.client?.postalCode || data.customer?.postalCode}</span></div>
            <div className="flex"><span className="font-bold w-28">POBLACIÓN:</span> <span>{data.client?.city || data.customer?.city}</span></div>
            <div className="flex"><span className="font-bold w-28">PROVINCIA:</span> <span>{data.client?.province || data.customer?.province}</span></div>
            <div className="flex"><span className="font-bold w-28">N.I.F.:</span> <span>{data.client?.nif || data.customer?.nif}</span></div>
          </div>
        </div>
      </div>

      {/* DOCUMENT NUMBER */}
      <div className="flex justify-between mb-4">
        <div className="w-[30%]">
          <div className="text-center font-bold border border-black bg-slate-100 py-0.5">SERIE</div>
          <div className="text-center border-l border-r border-b border-black py-0.5 h-5">{data.number?.split('/')[1] || config.invoiceSeries}</div>
        </div>
        <div className="w-[30%]">
          <div className="text-center font-bold border border-black bg-slate-100 py-0.5">NUMERO {type === 'factura' ? 'FACTURA' : 'PRESUPUESTO'}</div>
          <div className="text-center border-l border-r border-b border-black py-0.5 h-5">{data.number}</div>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div className="mb-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-200">
              <th className="border border-black py-1 px-2 w-[12%] text-center text-xs">UNIDADES</th>
              <th className="border border-black py-1 px-2 text-center text-xs">CONCEPTO</th>
              <th className="border border-black py-1 px-2 w-[15%] text-center text-xs">PVP / UN</th>
              <th className="border border-black py-1 px-2 w-[15%] text-center text-xs">IMPORTE</th>
            </tr>
          </thead>
          <tbody>
            {(data.items || []).map((item: any, i: number) => (
              <tr key={i}>
                <td className="border-l border-r border-black py-1 px-2 text-center align-top">{item.quantity}</td>
                <td className="border-l border-r border-black py-1 px-2 align-top break-words">{item.name || item.description}</td>
                <td className="border-l border-r border-black py-1 px-2 text-right align-top">{Number(item.price || item.unitPrice).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                <td className="border-l border-r border-black py-1 px-2 text-right align-top">{(Number(item.quantity) * Number(item.price || item.unitPrice)).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
              </tr>
            ))}
            {/* Filler rows to make table look complete */}
            {Array.from({ length: Math.max(1, 10 - (data.items?.length || 0)) }).map((_, i) => (
              <tr key={`filler-${i}`}>
                <td className="border-l border-r border-black py-3 px-2"></td>
                <td className="border-l border-r border-black py-3 px-2"></td>
                <td className="border-l border-r border-black py-3 px-2"></td>
                <td className="border-l border-r border-black py-3 px-2"></td>
              </tr>
            ))}
            <tr>
              <td className="border-t border-black" colSpan={4}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TOTALS */}
      <div className="flex justify-end mb-8">
        <div className="w-[45%]">
          <div className="flex border border-black border-b-0">
            <div className="w-1/2 p-1 font-bold text-center">BASE IMPONIBLE</div>
            <div className="w-1/2 p-1 text-right border-l border-black">{(data.subtotal || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
          </div>
          <div className="flex border border-black border-b-0">
            <div className="w-[25%] p-1 font-bold text-center">IVA</div>
            <div className="w-[25%] p-1 text-center border-l border-black bg-slate-100">{config.defaultIva}%</div>
            <div className="w-[50%] p-1 text-right border-l border-black">{(data.tax || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
          </div>
          <div className="flex border border-black border-4 border-t-2">
            <div className="w-1/2 p-2 font-bold text-center">TOTAL {type === 'factura' ? 'FACTURA' : 'PRESUPUESTO'}</div>
            <div className="w-1/2 p-2 text-right border-l border-black font-bold">{(data.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
          </div>
        </div>
      </div>

      {/* PAYMENT INFO */}
      <div className="border border-black p-1 mb-4 font-bold text-xs bg-slate-100">
        FORMA PAGO: {config.paymentMethod}
      </div>

      <div className="border border-black p-2 w-[40%] text-[10px]">
        <div className="font-bold mb-1">Datos Bancarios.</div>
        <div className="text-blue-800 font-bold">{config.iban}</div>
      </div>

    </div>
  );
}
