import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function Dashboard() {
  const [contratos, setContratos] = useState([])
  const [caja, setCaja] = useState([])
  const [terceros, setTerceros] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
      const [{ data: ct }, { data: cj }, { data: trcs }] = await Promise.all([
        supabase.from('contratos').select('*').eq('estado', 'Activo'),
        supabase.from('caja').select('*'),
        supabase.from('terceros').select('id, nombre'),
      ])
      setContratos(ct || [])
      setCaja(cj || [])
      setTerceros(trcs || [])
      setLoading(false)
    }
    cargarDatos()
  }, [])

  const totalCobrar = contratos.reduce((sum, c) => sum + (c.total || 0), 0)
  const flujoCaja = caja.reduce((sum, p) => sum + (p.monto || 0), 0)

  const fmt = n => '$' + Math.round(n).toLocaleString('es-CO')
  const nombreCliente = id => terceros.find(t => t.id === id)?.nombre || '---'

  if (loading) return (
    <div className="flex items-center justify-center mt-20">
      <p className="text-gray-400 text-sm">Cargando datos...</p>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto">

      <div className="grid grid-cols-2 gap-3 mb-6 mt-2">
        {[
          { label: 'Facturas activas', valor: contratos.length, color: 'text-[#185FA5]' },
          { label: 'Saldo por cobrar', valor: fmt(totalCobrar), color: 'text-[#27500A]' },
          { label: 'Equipos en campo', valor: '0', color: 'text-[#5B21B6]' },
          { label: 'Flujo neto caja', valor: fmt(flujoCaja), color: 'text-[#92400E]' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{m.label}</p>
            <p className={`text-2xl font-bold ${m.color}`}>{m.valor}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-700">📄 Facturas activas en obra</span>
        </div>
        {contratos.length === 0 ? (
          <div className="p-8 text-center text-gray-300 text-sm">
            No hay facturas activas aún
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Factura</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Cliente</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Salida</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Total</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map(c => (
                <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-xs text-[#185FA5]">{c.id_doc || '---'}</td>
                  <td className="px-4 py-2 text-xs">{nombreCliente(c.cliente_id)}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{c.fecha_salida || '---'}</td>
                  <td className="px-4 py-2 text-xs font-semibold">{fmt(c.total || 0)}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-semibold">
                      {c.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}

export default Dashboard