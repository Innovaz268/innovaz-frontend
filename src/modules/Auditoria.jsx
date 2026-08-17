import { useState, useEffect } from 'react'
import { supabase, empresaActiva } from '../supabase'

function Auditoria() {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('auditoria')
      .select('*')
      .eq('empresa_id', empresaActiva())
      .order('fecha', { ascending: false })
      .limit(500)
    setRegistros(data || [])
    setLoading(false)
  }

  const fmtFecha = f => {
    if (!f) return '—'
    const d = new Date(f)
    return d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const colorAccion = a => {
    if (a?.includes('elimin')) return 'bg-red-50 text-red-700'
    if (a?.includes('cre')) return 'bg-green-50 text-green-700'
    if (a?.includes('edit')) return 'bg-blue-50 text-blue-700'
    if (a?.includes('pago')) return 'bg-purple-50 text-purple-700'
    return 'bg-gray-50 text-gray-700'
  }

  const filtrados = registros.filter(r =>
    (!filtroTipo || r.documento_tipo === filtroTipo) &&
    (!filtroAccion || r.accion === filtroAccion)
  )

  const tipos = [...new Set(registros.map(r => r.documento_tipo).filter(Boolean))]
  const acciones = [...new Set(registros.map(r => r.accion).filter(Boolean))]

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-800">🔍 Auditoría</h2>
        <p className="text-xs text-gray-400">Registro de acciones: quién hizo qué y cuándo</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-xs">
          <option value="">Todos los documentos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-xs">
          <option value="">Todas las acciones</option>
          {acciones.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={cargar} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700">🔄 Actualizar</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-gray-500">Fecha</th>
              <th className="px-4 py-2 text-left text-gray-500">Usuario</th>
              <th className="px-4 py-2 text-left text-gray-500">Acción</th>
              <th className="px-4 py-2 text-left text-gray-500">Documento</th>
              <th className="px-4 py-2 text-left text-gray-500">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-300">Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-300">Sin registros</td></tr>
            ) : filtrados.map(r => (
              <tr key={r.id} className="border-t border-gray-50">
                <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{fmtFecha(r.fecha)}</td>
                <td className="px-4 py-2 text-gray-600">{r.user_email || '—'}</td>
                <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full font-semibold ${colorAccion(r.accion)}`}>{r.accion}</span></td>
                <td className="px-4 py-2 font-semibold">{r.documento_tipo} {r.documento_id}</td>
                <td className="px-4 py-2 text-gray-500">{r.detalle || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Auditoria