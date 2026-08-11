import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function Dashboard({ color = '#185FA5' }) {
  const [contratos, setContratos] = useState([])
  const [caja, setCaja] = useState([])
  const [terceros, setTerceros] = useState([])
  const [lineas, setLineas] = useState([])
  const [vista, setVista] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
      const [{ data: ct }, { data: cj }, { data: trcs }, { data: lns }] = await Promise.all([
        supabase.from('contratos').select('*').eq('estado', 'Activo'),
        supabase.from('caja').select('*').order('fecha', { ascending: false }),
        supabase.from('terceros').select('id, nombre'),
        supabase.from('alquiler_lineas').select('*'),
      ])
      setContratos(ct || [])
      setCaja(cj || [])
      setTerceros(trcs || [])
      setLineas(lns || [])
      setLoading(false)
    }
    cargarDatos()
  }, [])

  const totalCobrar = contratos.reduce((sum, c) => sum + ((c.total || 0) - (c.anticipo || 0)), 0)
  const flujoCaja = caja.reduce((sum, p) => sum + (p.monto || 0), 0)
  const equiposCampo = lineas.filter(l => l.estado === 'En obra').reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0)

  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')
  const nombreCliente = id => terceros.find(t => t.id === id)?.nombre || '---'
  const facturaDoc = id => contratos.find(c => c.id === id)?.id_doc || '---'

  const tarjetas = [
    { id: 'facturas', label: 'Facturas activas', valor: contratos.length, color: 'text-[#185FA5]' },
    { id: 'cobrar', label: 'Saldo por cobrar', valor: fmt(totalCobrar), color: 'text-[#27500A]' },
    { id: 'equipos', label: 'Equipos en campo', valor: equiposCampo, color: 'text-[#5B21B6]' },
    { id: 'caja', label: 'Flujo neto caja', valor: fmt(flujoCaja), color: 'text-[#92400E]' },
  ]

  const titulos = {
    facturas: '📄 Facturas activas en obra',
    cobrar: '💰 Facturas con saldo por cobrar',
    equipos: '🔧 Equipos en campo',
    caja: '💳 Movimientos de caja',
  }

  if (loading) return (
    <div className="flex items-center justify-center mt-20">
      <p className="text-gray-400 text-sm">Cargando datos...</p>
    </div>
  )

  const th = "px-4 py-2 text-left text-xs text-gray-500 font-semibold"
  const td = "px-4 py-2 text-xs"

  return (
    <div className="max-w-5xl mx-auto">

      <div className="grid grid-cols-2 gap-3 mb-6 mt-2">
        {tarjetas.map(m => (
          <div key={m.id} onClick={() => setVista(m.id)}
            onMouseEnter={ev => ev.currentTarget.style.backgroundColor = color + '0d'}
            onMouseLeave={ev => ev.currentTarget.style.backgroundColor = vista === m.id ? color + '0d' : '#ffffff'}
            style={{ backgroundColor: vista === m.id ? color + '0d' : '#ffffff', ...(vista === m.id ? { boxShadow: `0 0 0 1.5px ${color}66` } : {}) }}
            className="rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{m.label}</p>
            <p className={`text-2xl font-bold ${m.color}`}>{m.valor}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-700">{titulos[vista]}</span>
        </div>

        {vista === 'facturas' && (
          contratos.length === 0 ? <div className="p-8 text-center text-gray-300 text-sm">No hay facturas activas</div> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className={th}>Factura</th><th className={th}>Cliente</th><th className={th}>Salida</th><th className={th}>Total</th><th className={th}>Estado</th>
              </tr></thead>
              <tbody>
                {contratos.map(c => (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className={`${td} font-semibold text-[#185FA5]`}>{c.id_doc || '---'}</td>
                    <td className={td}>{nombreCliente(c.cliente_id)}</td>
                    <td className={`${td} text-gray-500`}>{c.fecha_salida || '---'}</td>
                    <td className={`${td} font-semibold`}>{fmt(c.total)}</td>
                    <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-semibold">{c.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {vista === 'cobrar' && (
          (() => {
            const conSaldo = contratos.filter(c => ((c.total || 0) - (c.anticipo || 0)) > 0)
            return conSaldo.length === 0 ? <div className="p-8 text-center text-gray-300 text-sm">No hay saldos pendientes</div> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className={th}>Factura</th><th className={th}>Cliente</th><th className={th}>Total</th><th className={th}>Anticipo</th><th className={th}>Saldo</th>
                </tr></thead>
                <tbody>
                  {conSaldo.map(c => (
                    <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className={`${td} font-semibold text-[#185FA5]`}>{c.id_doc || '---'}</td>
                      <td className={td}>{nombreCliente(c.cliente_id)}</td>
                      <td className={td}>{fmt(c.total)}</td>
                      <td className={`${td} text-gray-500`}>{fmt(c.anticipo)}</td>
                      <td className={`${td} font-semibold text-red-600`}>{fmt((c.total || 0) - (c.anticipo || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })()
        )}

        {vista === 'equipos' && (
          (() => {
            const enObra = lineas.filter(l => l.estado === 'En obra')
            return enObra.length === 0 ? <div className="p-8 text-center text-gray-300 text-sm">No hay equipos en campo</div> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className={th}>Equipo</th><th className={th}>Cant.</th><th className={th}>Factura</th><th className={th}>Salida</th><th className={th}>Dev. est.</th>
                </tr></thead>
                <tbody>
                  {enObra.map(l => (
                    <tr key={l.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className={`${td} font-semibold`}>{l.nombre}</td>
                      <td className={td}>{l.cantidad}</td>
                      <td className={`${td} text-[#185FA5]`}>{facturaDoc(l.contrato_id)}</td>
                      <td className={`${td} text-gray-500`}>{l.fecha_salida || '—'}</td>
                      <td className={`${td} text-gray-500`}>{l.fecha_est_dev || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })()
        )}

        {vista === 'caja' && (
          caja.length === 0 ? <div className="p-8 text-center text-gray-300 text-sm">No hay movimientos de caja</div> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className={th}>Fecha</th><th className={th}>Documento</th><th className={th}>Concepto</th><th className={th}>Método</th><th className={th}>Monto</th>
              </tr></thead>
              <tbody>
                {caja.map(p => (
                  <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className={`${td} text-gray-500`}>{p.fecha || '—'}</td>
                    <td className={`${td} text-[#185FA5]`}>{p.id_doc || '—'}</td>
                    <td className={td}>{p.concepto || '—'}</td>
                    <td className={`${td} text-gray-500`}>{p.metodo || '—'}</td>
                    <td className={`${td} font-semibold ${(p.monto || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

    </div>
  )
}

export default Dashboard