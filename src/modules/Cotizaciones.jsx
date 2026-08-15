import { useState, useEffect } from 'react'
import { supabase, empresaActiva } from '../supabase'
import { siguienteConsecutivo } from '../utils/consecutivo'
import { imprimirConMembrete } from '../utils/membrete'
import { compartirDocumento } from '../utils/compartir'

function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([])
  const [terceros, setTerceros] = useState([])
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    cliente_id: '', estado: 'Borrador', fecha: new Date().toISOString().slice(0,10),
    vigencia: '', tipo: 'Alquiler de Equipos', observaciones: '',
    items: [], transporte: 0, descuento: 0
  })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: cots }, { data: trcs }, { data: eqs }] = await Promise.all([
      supabase.from('cotizaciones').select('*').order('created_at', { ascending: false }),
      supabase.from('terceros').select('id, nombre').order('nombre'),
      supabase.from('equipos').select('id, nombre, tarifa').order('nombre'),
    ])
    setCotizaciones(cots || [])
    setTerceros(trcs || [])
    setEquipos(eqs || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setEditandoId(null)
    setForm({ cliente_id: '', estado: 'Borrador', fecha: new Date().toISOString().slice(0,10), vigencia: '', tipo: 'Alquiler de Equipos', observaciones: '', items: [], transporte: 0, descuento: 0 })
    setMostrarForm(true)
    setMensaje('')
  }

  function abrirEditar(c) {
    setEditandoId(c.id)
    setForm({ cliente_id: c.cliente_id || '', estado: c.estado || 'Borrador', fecha: c.fecha || '', vigencia: c.vigencia || '', tipo: c.tipo || 'Alquiler de Equipos', observaciones: c.observaciones || '', items: c.items || [], transporte: c.transporte || 0, descuento: c.descuento || 0 })
    setMostrarForm(true)
    setMensaje('')
  }

  function agregarItem() {
    setForm({ ...form, items: [...form.items, { equipo_id: '', nombre: '', cantidad: 1, dias: 1, tarifa: 0, subtotal: 0 }] })
  }

  function actualizarItem(i, campo, valor) {
    const items = [...form.items]
    items[i] = { ...items[i], [campo]: valor }
    if (campo === 'equipo_id') {
      const eq = equipos.find(e => e.id === valor)
      if (eq) { items[i].nombre = eq.nombre; items[i].tarifa = eq.tarifa || 0 }
    }
    items[i].subtotal = (parseFloat(items[i].cantidad) || 0) * (parseFloat(items[i].dias) || 0) * (parseFloat(items[i].tarifa) || 0)
    setForm({ ...form, items })
  }

  function eliminarItem(i) {
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) })
  }

  const subtotalEquipos = form.items.reduce((s, i) => s + (i.subtotal || 0), 0)
  const totalFinal = subtotalEquipos + (parseFloat(form.transporte) || 0) - (parseFloat(form.descuento) || 0)
  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')

  async function guardarCotizacion() {
    if (!form.cliente_id) { setMensaje('Seleccione un cliente'); return }
    if (form.items.length === 0) { setMensaje('Agregue al menos un equipo'); return }
    setGuardando(true)
    setMensaje('')
    const datos = { ...form, total: totalFinal }
    let error
    if (editandoId) {
      const res = await supabase.from('cotizaciones').update(datos).eq('id', editandoId)
      error = res.error
    } else {
      const codigo = await siguienteConsecutivo('CQ')
      const datos2 = { ...datos, id_doc: codigo, empresa_id: empresaActiva() }
      const res = await supabase.from('cotizaciones').insert([datos2])
      error = res.error
    }
    if (error) { setMensaje('Error: ' + error.message); setGuardando(false); return }
    setMensaje(editandoId ? '✓ Actualizada' : '✓ Cotización guardada')
    setMostrarForm(false)
    setEditandoId(null)
    await cargarDatos()
    setGuardando(false)
  }

  async function eliminarCotizacion(id) {
    if (!window.confirm('¿Eliminar esta cotización?')) return
    await supabase.from('cotizaciones').delete().eq('id', id)
    await cargarDatos()
  }

  function htmlCotizacion(c) {
    const trc = terceros.find(t => t.id === c.cliente_id)
    const filas = (c.items || []).map(it => `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #eee">${it.nombre || ''}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:center">${it.cantidad || 0}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:center">${it.dias || 0}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${fmt(it.tarifa)}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${fmt(it.subtotal)}</td>
      </tr>`).join('')
    return `
      <div style="margin-bottom:16px">
        <p><b>Cotización N°:</b> ${c.id_doc || '—'}</p>
        <p><b>Cliente:</b> ${trc?.nombre || ''}</p>
        <p><b>Fecha:</b> ${c.fecha || '—'} &nbsp;&nbsp; <b>Vigencia:</b> ${c.vigencia || '—'}</p>
        <p><b>Tipo:</b> ${c.tipo || ''}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:6px;text-align:left">Descripción</th>
            <th style="padding:6px;text-align:center">Cant.</th>
            <th style="padding:6px;text-align:center">Días</th>
            <th style="padding:6px;text-align:right">Tarifa</th>
            <th style="padding:6px;text-align:right">Subtotal</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <div style="margin-top:16px;text-align:right;font-size:13px">
        <p>Transporte: ${fmt(c.transporte)}</p>
        <p>Descuento: ${fmt(c.descuento)}</p>
        <p style="font-size:16px;font-weight:bold;color:#185FA5">TOTAL: ${fmt(c.total)}</p>
      </div>
      ${c.observaciones ? `<div style="margin-top:12px;font-size:12px;color:#666"><b>Observaciones:</b> ${c.observaciones}</div>` : ''}
    `
  }

  function imprimirCotizacion(c) {
    imprimirConMembrete('COTIZACIÓN ' + (c.id_doc || ''), htmlCotizacion(c), '#185FA5')
  }

  async function compartirCotizacion(c) {
    await compartirDocumento(htmlCotizacion(c), 'Cotizacion-' + (c.id_doc || 'SN'), 'Le comparto la cotización ' + (c.id_doc || ''))
  }

  const estadoBadge = estado => {
    const colores = { Borrador: 'bg-gray-100 text-gray-600', Aprobada: 'bg-green-50 text-green-700', Rechazada: 'bg-red-50 text-red-700', Enviada: 'bg-blue-50 text-blue-700' }
    return colores[estado] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 mt-2">
        <h2 className="text-xl font-bold text-[#185FA5]">📝 Cotizaciones</h2>
        <button onClick={mostrarForm ? () => setMostrarForm(false) : abrirNuevo}
          className="px-4 py-2 btn-empresa text-white text-xs font-bold rounded-lg hover:opacity-90">
          {mostrarForm ? '✕ Cancelar' : '+ Nueva'}
        </button>
      </div>

      {mensaje && (
        <div className={`mb-3 p-3 rounded-lg text-sm font-semibold ${mensaje.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {mensaje}
        </div>
      )}

      {mostrarForm && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">{editandoId ? '✏️ Editar cotización' : 'Nueva cotización'}</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Cliente *</label>
              <select value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option value="">— Seleccionar cliente —</option>
                {terceros.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Estado</label>
              <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option>Borrador</option>
                <option>Enviada</option>
                <option>Aprobada</option>
                <option>Rechazada</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Vigencia hasta</label>
              <input type="date" value={form.vigencia} onChange={e => setForm({...form, vigencia: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Observaciones</label>
              <textarea value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                rows={2} placeholder="Condiciones de pago, notas adicionales..." />
            </div>
          </div>

          {/* Items */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">Equipos a cotizar</label>
              <button onClick={agregarItem} className="text-xs px-3 py-1 bg-[#185FA5] text-white rounded-lg hover:opacity-90">+ Agregar equipo</button>
            </div>
            {form.items.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs border border-dashed border-gray-200 rounded-lg">Sin equipos — clic en "+ Agregar equipo"</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">No.</th>
                      <th className="px-2 py-1 text-left text-gray-500">Equipo</th>
                      <th className="px-2 py-1 text-left text-gray-500">Cant.</th>
                      <th className="px-2 py-1 text-left text-gray-500">Días</th>
                      <th className="px-2 py-1 text-left text-gray-500">Tarifa/día</th>
                      <th className="px-2 py-1 text-left text-gray-500">Subtotal</th>
                      <th className="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-2 py-1">
                          <select value={item.equipo_id} onChange={e => actualizarItem(i, 'equipo_id', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs">
                            <option value="">— Seleccionar —</option>
                            {equipos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1"><input type="number" value={item.cantidad} onChange={e => actualizarItem(i, 'cantidad', e.target.value)} className="w-16 px-2 py-1 border border-gray-200 rounded text-xs" min="1" /></td>
                        <td className="px-2 py-1"><input type="number" value={item.dias} onChange={e => actualizarItem(i, 'dias', e.target.value)} className="w-16 px-2 py-1 border border-gray-200 rounded text-xs" min="1" /></td>
                        <td className="px-2 py-1"><input type="number" value={item.tarifa} onChange={e => actualizarItem(i, 'tarifa', e.target.value)} className="w-24 px-2 py-1 border border-gray-200 rounded text-xs" /></td>
                        <td className="px-2 py-1 font-semibold text-[#185FA5]">{fmt(item.subtotal)}</td>
                        <td className="px-2 py-1"><button onClick={() => eliminarItem(i)} className="text-red-400 hover:text-red-600">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Resumen financiero */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Subtotal equipos</label>
                <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700">{fmt(subtotalEquipos)}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">🚚 Transporte / Flete</label>
                <input type="number" value={form.transporte} onChange={e => setForm({...form, transporte: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5] bg-white"
                  placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">🏷️ Descuento / Ajuste</label>
                <input type="number" value={form.descuento} onChange={e => setForm({...form, descuento: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5] bg-white"
                  placeholder="0" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
              <span className="text-xs text-gray-500">Equipos {fmt(subtotalEquipos)} + Transporte {fmt(form.transporte)} - Descuento {fmt(form.descuento)}</span>
              <span className="text-lg font-bold text-[#185FA5]">Total: {fmt(totalFinal)}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={guardarCotizacion} disabled={guardando}
              className="px-6 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
              {guardando ? 'Guardando...' : '✓ Guardar cotización'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
        ) : cotizaciones.length === 0 ? (
          <div className="p-8 text-center text-gray-300 text-sm">No hay cotizaciones aún</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">No.</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Cliente</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Fecha</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Vigencia</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Transporte</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Descuento</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Total</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.map(c => {
                const trc = terceros.find(t => t.id === c.cliente_id)
                return (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-[#185FA5] font-bold">{c.id_doc || '---'}</td>
                    <td className="px-4 py-2 font-semibold text-xs">{trc?.nombre || c.cliente_id}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{c.fecha || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{c.vigencia || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{fmt(c.transporte)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{fmt(c.descuento)}</td>
                    <td className="px-4 py-2 text-xs font-semibold text-[#185FA5]">{fmt(c.total)}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${estadoBadge(c.estado)}`}>{c.estado}</span></td>
                    <td className="px-4 py-2 text-right flex gap-2 justify-end">
                      <button onClick={() => imprimirCotizacion(c)} className="text-xs text-gray-500 hover:text-gray-700" title="Imprimir">🖨️</button>
                      <button onClick={() => compartirCotizacion(c)} className="text-xs hover:opacity-70" title="Compartir">📲</button>
                      <button onClick={() => abrirEditar(c)} className="text-xs text-blue-400 hover:text-blue-600">✏️</button>
                      <button onClick={() => eliminarCotizacion(c.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Cotizaciones