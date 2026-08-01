import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { imprimirActaEntrega } from '../utils/actaEntrega'

function Flujo() {
  const [contratos, setContratos] = useState([])
  const [cotizaciones, setCotizaciones] = useState([])
  const [terceros, setTerceros] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [negocio, setNegocio] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [ordenesMuebles, setOrdenesMuebles] = useState([])
  const [cotsMuebles, setCotsMuebles] = useState([])

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: cts }, { data: cots }, { data: trcs }, { data: pgs }, { data: oms }, { data: cms }] = await Promise.all([
      supabase.from('contratos').select('*').eq('estado', 'Activo'),
      supabase.from('cotizaciones').select('*').order('created_at', { ascending: false }),
      supabase.from('terceros').select('id, nombre').order('nombre'),
      supabase.from('caja').select('*'),
      supabase.from('muebles_ordenes').select('*').order('created_at', { ascending: false }),
      supabase.from('muebles_cotizaciones').select('*').order('created_at', { ascending: false }),
    ])
    setContratos(cts || [])
    setCotizaciones(cots || [])
    setTerceros(trcs || [])
    setPagos(pgs || [])
    setOrdenesMuebles(oms || [])
    setCotsMuebles(cms || [])
    setLoading(false)
  }

  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')
  const fmtFecha = f => f ? f.split('-').reverse().join('/') : '—'

  const nombreCliente = id => terceros.find(t => t.id === id)?.nombre || id || '—'

  const saldoContrato = (c) => {
    const abonos = pagos.filter(p => p.contrato_id === c.id).reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    return (c.total || 0) - (c.anticipo || 0) - abonos
  }
  // FLUJO DE MUEBLES
  const cotsMueblesPend = cotsMuebles.filter(c => c.estado === 'Borrador' || c.estado === 'Pendiente')
  const mueblesEnProceso = ordenesMuebles.filter(o => o.estado === 'En diseno' || o.estado === 'En produccion')
  const mueblesTerminados = ordenesMuebles.filter(o => o.estado === 'Terminado')
  const mueblesEntregados = ordenesMuebles.filter(o => o.estado === 'Entregado')
  const saldoMueble = (o) => {
    const abonos = pagos.filter(p => p.contrato_id === o.id).reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    return (o.total || 0) - (o.anticipo || 0) - abonos
  }
  const mueblesPorCobrar = ordenesMuebles.filter(o => saldoMueble(o) > 0)

  async function marcarEntregado(contrato) {
    if (!window.confirm(`¿Confirmar la entrega de ${nombreCliente(contrato.cliente_id)}? Pasará a "En Campo".`)) return
    const { error } = await supabase.from('contratos')
      .update({ entregado: true, fecha_entrega: new Date().toISOString().slice(0, 10) })
      .eq('id', contrato.id)
    if (error) { alert('Error: ' + error.message); return }
    await cargarDatos()
  }

  // Filtros por columna
  const cotsPendientes = cotizaciones.filter(c =>
    c.estado !== 'Aprobada' && c.estado !== 'Rechazada' &&
    (filtroCliente ? c.cliente_id === filtroCliente : true)
  )

  const porCobrar = contratos.filter(c =>
    saldoContrato(c) > 0 &&
    (filtroCliente ? c.cliente_id === filtroCliente : true)
  )

  const porEntregar = contratos.filter(c =>
    !c.entregado &&
    (filtroCliente ? c.cliente_id === filtroCliente : true)
  )

  const enCampo = contratos.filter(c =>
    c.entregado &&
    (filtroCliente ? c.cliente_id === filtroCliente : true)
  )

  const proximasVencer = enCampo.filter(c => {
    if (!c.fecha_est_dev) return false
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const dev = new Date(c.fecha_est_dev)
    const dias = Math.ceil((dev - hoy) / (1000 * 60 * 60 * 24))
    return dias <= 2
  })

  // Conteos para la pantalla de selección de negocio
  const totalAlquilerActivas = contratos.filter(c => c.estado === 'Activo').length
  const totalMueblesProceso = cotizaciones.filter(c => c.estado !== 'Entregado' && c.estado !== 'Anulado').length

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
          <p className="text-xs text-gray-400">{negocio === 'alquiler' ? 'Alquiler: Cotización → Entrega → Cobro → Devolución' : negocio === 'muebles' ? 'Muebles: Cotización → Producción → Entrega → Cobro' : 'Seleccione una línea de negocio'}</p>
        </div>
        <div className="flex gap-2 items-center">
          {negocio && (
            <>
              <button onClick={() => setNegocio('')}
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                ← Volver
              </button>
              <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#185FA5] bg-white">
                <option value="">— Todos los clientes —</option>
                {terceros.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <button onClick={cargarDatos}
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                🔄 Actualizar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pantalla de selección de negocio */}
      {!negocio && (
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mt-8">
          <button onClick={() => setNegocio('alquiler')}
            className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm p-8 hover:border-[#185FA5] transition text-center">
            <div className="text-5xl mb-3">🔧</div>
            <div className="text-lg font-bold text-gray-800">Alquiler</div>
            <div className="text-4xl font-bold text-[#185FA5] mt-2">{contratos.filter(c => c.estado === 'Activo').length}</div>
            <div className="text-xs text-gray-400">facturas activas</div>
          </button>
          <button onClick={() => setNegocio('muebles')}
            className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm p-8 hover:border-[#5B21B6] transition text-center">
            <div className="text-5xl mb-3">🪵</div>
            <div className="text-lg font-bold text-gray-800">Muebles</div>
            <div className="text-4xl font-bold text-[#5B21B6] mt-2">{ordenesMuebles.filter(o => o.estado !== 'Entregado').length}</div>
            <div className="text-xs text-gray-400">órdenes en proceso</div>
          </button>
        </div>
      )}

      {/* Tablero Kanban - ALQUILER */}
      {negocio === 'alquiler' && (
      <div className="grid grid-cols-5 gap-3">

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

        {/* COL: POR ENTREGAR */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-[#1E3A8A] to-[#185FA5]">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold">📦 Por Entregar</span>
              <span className="bg-white bg-opacity-25 text-white text-xs px-2 py-0.5 rounded-full font-bold">{porEntregar.length}</span>
            </div>
            <p className="text-blue-200 text-xs mt-0.5">Facturado — pendiente de entrega</p>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {porEntregar.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs">Nada por entregar</div>
            ) : porEntregar.map(c => {
              const items = c.items || []
              return (
                <div key={c.id} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-xs text-gray-800">{nombreCliente(c.cliente_id)}</div>
                    <span className="text-xs font-bold text-[#185FA5]">{c.id_doc || '—'}</span>
                  </div>
                  {items.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">🔧 {items.map(i => `${i.nombre || i.equipo_id} x${i.cantidad}`).join(', ')}</div>
                  )}
                  <div className="text-xs text-gray-400">📍 {c.ubicacion || '—'}</div>
                  <div className="text-xs text-gray-400">📅 Salida: {fmtFecha(c.fecha_salida)}</div>
                  {c.ubicacion && (
                    <div className="flex gap-1 mt-1">
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.ubicacion)}`} target="_blank" rel="noreferrer"
                        className="flex-1 text-center px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded hover:bg-blue-100">🗺️ Maps</a>
                      <a href={`https://waze.com/ul?q=${encodeURIComponent(c.ubicacion)}`} target="_blank" rel="noreferrer"
                        className="flex-1 text-center px-2 py-1 bg-cyan-50 text-cyan-700 text-xs font-semibold rounded hover:bg-cyan-100">🚗 Waze</a>
                    </div>
                  )}
                  <button onClick={() => marcarEntregado(c)}
                    className="mt-1 w-full px-2 py-1.5 bg-[#27500A] text-white text-xs font-semibold rounded-lg hover:opacity-90">
                    ✓ Confirmar entrega
                  </button>
                </div>
              )
            })}
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
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-xs text-gray-800">{nombreCliente(c.cliente_id)}</div>
                    <span className="text-xs font-bold text-[#185FA5]">{c.id_doc || '—'}</span>
                  </div>
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
                  <button onClick={() => imprimirActaEntrega(c, terceros.find(t => t.id === c.cliente_id), items)}
                    className="mt-2 w-full px-2 py-1.5 bg-[#185FA5] text-white text-xs font-semibold rounded-lg hover:opacity-90">
                    📄 Acta de entrega
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* COL 5: DEVOLUCIONES */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-[#7C2D12] to-[#DC2626]">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold">⚠️ Devoluciones</span>
              <span className="bg-white bg-opacity-25 text-white text-xs px-2 py-0.5 rounded-full font-bold">{proximasVencer.length}</span>
            </div>
            <p className="text-red-200 text-xs mt-0.5">Próximas a vencer (2 días)</p>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {proximasVencer.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs">Nada próximo a vencer</div>
            ) : proximasVencer.map(c => {
              const alerta = alertaTexto(c)
              const dir = c.ubicacion || ''
              return (
                <div key={c.id} className="bg-white rounded-lg p-3 border-l-4 border-red-400 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-xs text-gray-800">{nombreCliente(c.cliente_id)}</div>
                    <span className="text-xs font-bold text-[#185FA5]">{c.id_doc || '—'}</span>
                  </div>
                  {alerta && <div className="mt-1"><span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${alerta.color}`}>{alerta.texto}</span></div>}
                  <div className="text-xs text-gray-400 mt-1">📅 Dev: {fmtFecha(c.fecha_est_dev)}</div>
                  <div className="text-xs text-gray-400">📍 {dir || '—'}</div>
                  {dir && (
                    <div className="flex gap-1 mt-1">
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}`} target="_blank" rel="noreferrer"
                        className="flex-1 text-center px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded hover:bg-blue-100">🗺️ Maps</a>
                      <a href={`https://waze.com/ul?q=${encodeURIComponent(dir)}`} target="_blank" rel="noreferrer"
                        className="flex-1 text-center px-2 py-1 bg-cyan-50 text-cyan-700 text-xs font-semibold rounded hover:bg-cyan-100">🚗 Waze</a>
                    </div>
                  )}
                  <button onClick={() => alert('Para registrar la devolución, vaya al módulo Facturas → Equipos de esta factura (' + (c.id_doc || '') + ')')}
                    className="mt-2 w-full px-2 py-1.5 bg-[#7C2D12] text-white text-xs font-semibold rounded-lg hover:opacity-90">
                    ↩️ Registrar devolución
                  </button>
                </div>
              )
            })}
          </div>
        </div>

      </div>
      )}

      {/* Tablero Kanban - MUEBLES */}
      {negocio === 'muebles' && (
      <div className="grid grid-cols-5 gap-3">

        {/* COL 1: COTIZACIONES MUEBLES */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-[#5B21B6] to-[#7C3AED]">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold">📝 Cotizaciones</span>
              <span className="bg-white bg-opacity-25 text-white text-xs px-2 py-0.5 rounded-full font-bold">{cotsMueblesPend.length}</span>
            </div>
            <p className="text-purple-200 text-xs mt-0.5">Pendientes de aprobar</p>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {cotsMueblesPend.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs">Sin cotizaciones</div>
            ) : cotsMueblesPend.map(c => (
              <div key={c.id} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-gray-800">{nombreCliente(c.cliente_id)}</div>
                  <span className="text-xs font-bold text-[#5B21B6]">{c.id_doc || '—'}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{c.descripcion || '—'}</div>
                <div className="text-xs font-bold text-[#5B21B6] mt-1">{fmt(c.total)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* COL 2: EN PROCESO */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-[#1E3A8A] to-[#185FA5]">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold">🔨 En Proceso</span>
              <span className="bg-white bg-opacity-25 text-white text-xs px-2 py-0.5 rounded-full font-bold">{mueblesEnProceso.length}</span>
            </div>
            <p className="text-blue-200 text-xs mt-0.5">Diseño y producción</p>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {mueblesEnProceso.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs">Nada en proceso</div>
            ) : mueblesEnProceso.map(o => (
              <div key={o.id} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-gray-800">{nombreCliente(o.cliente_id)}</div>
                  <span className="text-xs font-bold text-[#185FA5]">{o.id_doc || '—'}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{o.descripcion || '—'}</div>
                <div className="text-xs mt-1"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-semibold">{o.estado}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* COL 3: TERMINADOS */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-[#065F46] to-[#059669]">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold">✅ Terminados</span>
              <span className="bg-white bg-opacity-25 text-white text-xs px-2 py-0.5 rounded-full font-bold">{mueblesTerminados.length}</span>
            </div>
            <p className="text-green-200 text-xs mt-0.5">Listos para entregar</p>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {mueblesTerminados.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs">Nada terminado</div>
            ) : mueblesTerminados.map(o => (
              <div key={o.id} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-gray-800">{nombreCliente(o.cliente_id)}</div>
                  <span className="text-xs font-bold text-green-700">{o.id_doc || '—'}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{o.descripcion || '—'}</div>
                <div className="text-xs font-bold text-green-700 mt-1">{fmt(o.total)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* COL 4: ENTREGADOS */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-[#7C2D12] to-[#EA580C]">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold">📦 Entregados</span>
              <span className="bg-white bg-opacity-25 text-white text-xs px-2 py-0.5 rounded-full font-bold">{mueblesEntregados.length}</span>
            </div>
            <p className="text-orange-200 text-xs mt-0.5">Entregados al cliente</p>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {mueblesEntregados.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs">Nada entregado</div>
            ) : mueblesEntregados.map(o => (
              <div key={o.id} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-gray-800">{nombreCliente(o.cliente_id)}</div>
                  <span className="text-xs font-bold text-[#EA580C]">{o.id_doc || '—'}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{o.descripcion || '—'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* COL 5: POR COBRAR */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-[#7C2D12] to-[#DC2626]">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold">💰 Por Cobrar</span>
              <span className="bg-white bg-opacity-25 text-white text-xs px-2 py-0.5 rounded-full font-bold">{mueblesPorCobrar.length}</span>
            </div>
            <p className="text-red-200 text-xs mt-0.5">Con saldo pendiente</p>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {mueblesPorCobrar.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs">Sin cobros pendientes</div>
            ) : mueblesPorCobrar.map(o => {
              const saldo = saldoMueble(o)
              return (
                <div key={o.id} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-xs text-gray-800">{nombreCliente(o.cliente_id)}</div>
                    <span className="text-xs font-bold text-[#DC2626]">{o.id_doc || '—'}</span>
                  </div>
                  <div className="mt-2 p-2 bg-red-50 rounded-lg">
                    <div className="text-xs text-gray-500">Saldo pendiente</div>
                    <div className="text-base font-bold text-red-600">{fmt(saldo)}</div>
                    <div className="text-xs text-gray-400">de {fmt(o.total)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
      )}
    </div>
  )
}

export default Flujo