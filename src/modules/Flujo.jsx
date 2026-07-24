import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function Flujo() {
  const [contratos, setContratos] = useState([])
  const [cotizaciones, setCotizaciones] = useState([])
  const [terceros, setTerceros] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCliente, setFiltroCliente] = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: cts }, { data: cots }, { data: trcs }, { data: pgs }] = await Promise.all([
      supabase.from('contratos').select('*').eq('estado', 'Activo'),
      supabase.from('cotizaciones').select('*').order('created_at', { ascending: false }),
      supabase.from('terceros').select('id, nombre').order('nombre'),
      supabase.from('caja').select('*'),
    ])
    setContratos(cts || [])
    setCotizaciones(cots || [])
    setTerceros(trcs || [])
    setPagos(pgs || [])
    setLoading(false)
  }

  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')
  const fmtFecha = f => f ? f.split('-').reverse().join('/') : '—'

  const nombreCliente = id => terceros.find(t => t.id === id)?.nombre || id || '—'

  const saldoContrato = (c) => {
    const abonos = pagos.filter(p => p.contrato_id === c.id).reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    return (c.total || 0) - (c.anticipo || 0) - abonos
  }

  // Filtros por columna
  const cotsPendientes = cotizaciones.filter(c =>
    c.estado !== 'Aprobada' && c.estado !== 'Rechazada' &&
    (filtroCliente ? c.cliente_id === filtroCliente : true)
  )

  const porEntregar = contratos.filter(c =>
    !c.fecha_real_salida &&
    (filtroCliente ? c.cliente_id === filtroCliente : true)
  )

  const porCobrar = contratos.filter(c =>
    saldoContrato(c) > 0 &&
    (filtroCliente ? c.cliente_id === filtroCliente : true)
  )

  const enCampo = contratos.filter(c =>
    filtroCliente ? c.cliente_id === filtroCliente : true
  )

  const alertaColor = (c) => {
    if (!c.fecha_est_dev) return 'border-gray-200'
    const hoy = new Date()
    const dev = new Date(c.fecha_est_dev)
    const dias = Math.ceil((dev - hoy) / (1000 * 60 * 60 * 24))
    if (dias < 0) return 'border-red-400'
    if (dias <= 3) return 'border-amber-400'
    return 'border-green-400'
  }

  const alertaTexto = (c) => {
    if (!c.fecha_est_dev) return null
    const hoy = new Date()
    const dev = new Date(c.fecha_est_dev)
    const dias = Math.ceil((dev - hoy) / (1000 * 60 * 60 * 24))
    if (dias < 0) return { texto: `Vencido ${Math.abs(dias)}d`, color: 'bg-red-50 text-red-700' }
    if (dias === 0) return { texto: 'Vence hoy', color: 'bg-amber-50 text-amber-700' }
    if (dias <= 3) return { texto: `${dias}d para dev.`, color: 'bg-amber-50 text-amber-700' }
    return { texto: `${dias}d restantes`, color: 'bg-green-50 text-green-700' }
  }

  if (loading) return <div className="flex items-center justify-center mt-20"><p className="text-gray-400 text-sm">Cargando flujo...</p></div>

  return (
    <div className="max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 mt-2 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-[#185FA5]">⚙️ Flujo Logístico</h2>
          <p className="text-xs text-gray-400">Cotización → Entrega → Cobro → Devolución</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#185FA5] bg-white">
            <option value="">— Todos los clientes —</option>
            {terceros.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <button onClick={cargarDatos}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Tablero Kanban */}
      <div className="grid grid-cols-4 gap-3">

        {/* COL 1: COTIZACIONES */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-[#5B21B6] to-[#7C3AED]">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold">📝 Cotizaciones</span>
              <span className="bg-white bg-opacity-25 text-white text-xs px-2 py-0.5 rounded-full font-bold">{cotsPendientes.length}</span>
            </div>
            <p className="text-purple-200 text-xs mt-0.5">Pendientes de aprobar</p>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {cotsPendientes.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs">Sin cotizaciones pendientes</div>
            ) : cotsPendientes.map(c => (
              <div key={c.id} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                <div className="font-semibold text-xs text-gray-800">{nombreCliente(c.cliente_id)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{fmtFecha(c.fecha)} · {fmtFecha(c.vigencia)}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-bold text-[#185FA5]">{fmt(c.total)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.estado === 'Borrador' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>{c.estado}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COL 2: POR ENTREGAR */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-[#185FA5] to-[#0C447C]">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold">🚚 Por Entregar</span>
              <span className="bg-white bg-opacity-25 text-white text-xs px-2 py-0.5 rounded-full font-bold">{porEntregar.length}</span>
            </div>
            <p className="text-blue-200 text-xs mt-0.5">Facturas sin confirmar salida</p>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {porEntregar.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs">Sin entregas pendientes</div>
            ) : porEntregar.map(c => (
              <div key={c.id} className={`bg-white rounded-lg p-3 border-l-4 ${alertaColor(c)} border border-gray-100 shadow-sm`}>
                <div className="font-semibold text-xs text-gray-800">{nombreCliente(c.cliente_id)}</div>
                <div className="text-xs text-gray-400 mt-0.5">📍 {c.ubicacion || '—'}</div>
                <div className="text-xs text-gray-400">🗓 Salida: {fmtFecha(c.fecha_salida)}</div>
                <div className="text-xs font-bold text-[#185FA5] mt-1">{fmt(c.total)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* COL 3: POR COBRAR */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-[#065F46] to-[#059669]">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold">💰 Por Cobrar</span>
              <span className="bg-white bg-opacity-25 text-white text-xs px-2 py-0.5 rounded-full font-bold">{porCobrar.length}</span>
            </div>
            <p className="text-green-200 text-xs mt-0.5">Con saldo pendiente</p>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {porCobrar.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs">Sin cobros pendientes</div>
            ) : porCobrar.map(c => {
              const saldo = saldoContrato(c)
              return (
                <div key={c.id} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                  <div className="font-semibold text-xs text-gray-800">{nombreCliente(c.cliente_id)}</div>
                  <div className="mt-2 p-2 bg-red-50 rounded-lg">
                    <div className="text-xs text-gray-500">Saldo pendiente</div>
                    <div className="text-base font-bold text-red-600">{fmt(saldo)}</div>
                    <div className="text-xs text-gray-400">de {fmt(c.total)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* COL 4: EN CAMPO / DEVOLUCIÓN */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-[#7C2D12] to-[#EA580C]">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold">🔄 En Campo</span>
              <span className="bg-white bg-opacity-25 text-white text-xs px-2 py-0.5 rounded-full font-bold">{enCampo.length}</span>
            </div>
            <p className="text-orange-200 text-xs mt-0.5">Equipos fuera — pendiente devolución</p>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {enCampo.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs">Sin equipos en campo</div>
            ) : enCampo.map(c => {
              const alerta = alertaTexto(c)
              const saldo = saldoContrato(c)
              const items = c.items || []
              return (
                <div key={c.id} className={`bg-white rounded-lg p-3 border-l-4 ${alertaColor(c)} border border-gray-100 shadow-sm`}>
                  <div className="flex items-start justify-between gap-1">
                    <div className="font-semibold text-xs text-gray-800">{nombreCliente(c.cliente_id)}</div>
                    {alerta && <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${alerta.color}`}>{alerta.texto}</span>}
                  </div>
                  {items.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      🔧 {items.map(i => `${i.nombre || i.equipo_id} x${i.cantidad}`).join(', ')}
                    </div>
                  )}
                  <div className="text-xs text-gray-400">📍 {c.ubicacion || '—'}</div>
                  <div className="text-xs text-gray-400">📅 Dev: {fmtFecha(c.fecha_est_dev)}</div>
                  <div className={`text-xs font-bold mt-1 ${saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {saldo > 0 ? `💰 ${fmt(saldo)}` : '✓ Pagado'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

export default Flujo