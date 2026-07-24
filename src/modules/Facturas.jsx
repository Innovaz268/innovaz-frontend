import { siguienteConsecutivo } from '../utils/consecutivo'
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { asientoFactura } from '../utils/asientosAuto'

function Facturas() {
  const [contratos, setContratos] = useState([])
  const [terceros, setTerceros] = useState([])
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    cliente_id: '', estado: 'Activo', fecha_salida: new Date().toISOString().slice(0,10),
    fecha_est_dev: '', ubicacion: '', unidad_negocio: 'ALQ',
    observaciones: '', items: [], transporte: 0, descuento: 0, anticipo: 0
  })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: cts }, { data: trcs }, { data: eqs }] = await Promise.all([
      supabase.from('contratos').select('*').order('created_at', { ascending: false }),
      supabase.from('terceros').select('id, nombre, dir').order('nombre'),
      supabase.from('equipos').select('id, nombre, tarifa').order('nombre'),
    ])
    setContratos(cts || [])
    setTerceros(trcs || [])
    setEquipos(eqs || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setEditandoId(null)
    setForm({ cliente_id: '', estado: 'Activo', fecha_salida: new Date().toISOString().slice(0,10), fecha_est_dev: '', ubicacion: '', unidad_negocio: 'ALQ', observaciones: '', items: [], transporte: 0, descuento: 0, anticipo: 0 })
    setMostrarForm(true)
    setMensaje('')
  }

  function abrirEditar(c) {
    setEditandoId(c.id)
    setForm({ cliente_id: c.cliente_id || '', estado: c.estado || 'Activo', fecha_salida: c.fecha_salida || '', fecha_est_dev: c.fecha_est_dev || '', ubicacion: c.ubicacion || '', unidad_negocio: c.unidad_negocio || 'ALQ', observaciones: c.observaciones || '', items: c.items || [], transporte: c.transporte || 0, descuento: c.descuento || 0, anticipo: c.anticipo || 0 })
    setMostrarForm(true)
    setMensaje('')
  }

  function clienteSeleccionado(id) {
    const trc = terceros.find(t => t.id === id)
    setForm({ ...form, cliente_id: id, ubicacion: trc?.dir || '' })
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

  const subtotal = form.items.reduce((s, i) => s + (i.subtotal || 0), 0)
  const totalFinal = subtotal + (parseFloat(form.transporte) || 0) - (parseFloat(form.descuento) || 0)
  const saldo = totalFinal - (parseFloat(form.anticipo) || 0)
  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')

  async function guardarFactura() {
    if (!form.cliente_id) { setMensaje('Seleccione un cliente'); return }
    if (form.items.length === 0) { setMensaje('Agregue al menos un equipo'); return }
    setGuardando(true)
    setMensaje('')
    const datos = { ...form, total: totalFinal }
    
    let codigo = ''
let error
    if (editandoId) {
      const res = await supabase.from('contratos').update(datos).eq('id', editandoId)
      error = res.error
    } else {
      codigo = await siguienteConsecutivo('FC')
      const datos2 = { ...datos, id_doc: codigo }
      const res = await supabase.from('contratos').insert([datos2])
      error = res.error
    }
    if (error) { setMensaje('Error: ' + error.message); setGuardando(false); return }
    if (!editandoId) await asientoFactura({ ...datos, id_doc: codigo })
    setMensaje(editandoId ? 'Factura actualizada' : 'Factura creada')  
    setMostrarForm(false)
    setEditandoId(null)
    await cargarDatos()
    setGuardando(false)
  }

  async function eliminarFactura(id) {
    if (!window.confirm('¿Eliminar esta factura?')) return
    await supabase.from('contratos').delete().eq('id', id)
    await cargarDatos()
  }

  const estadoBadge = estado => {
    const colores = { Activo: 'bg-green-50 text-green-700', Cerrado: 'bg-gray-100 text-gray-600', Cancelado: 'bg-red-50 text-red-700' }
    return colores[estado] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 mt-2">
        <h2 className="text-xl font-bold text-[#185FA5]">📄 Facturas de Alquiler</h2>
        <button onClick={mostrarForm ? () => setMostrarForm(false) : abrirNuevo}
          className="px-4 py-2 bg-gradient-to-r from-[#185FA5] to-[#5B21B6] text-white text-xs font-bold rounded-lg hover:opacity-90">
          {mostrarForm ? '✕ Cancelar' : '+ Nueva Factura'}
        </button>
      </div>

      {mensaje && (
        <div className={`mb-3 p-3 rounded-lg text-sm font-semibold ${mensaje.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {mensaje}
        </div>
      )}

      {mostrarForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">{editandoId ? '✏️ Editar factura' : 'Nueva factura de alquiler'}</h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Cliente *</label>
              <select value={form.cliente_id} onChange={e => clienteSeleccionado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option value="">— Seleccionar cliente —</option>
                {terceros.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Estado</label>
              <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option>Activo</option>
                <option>Cerrado</option>
                <option>Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha de salida</label>
              <input type="date" value={form.fecha_salida} onChange={e => setForm({...form, fecha_salida: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha estimada devolución</label>
              <input type="date" value={form.fecha_est_dev} onChange={e => setForm({...form, fecha_est_dev: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">📍 Ubicación / Lugar de entrega</label>
              <input value={form.ubicacion} onChange={e => setForm({...form, ubicacion: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="Dirección de entrega" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Observaciones</label>
              <textarea value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                rows={2} placeholder="Condiciones, notas adicionales..." />
            </div>
          </div>

          {/* Items */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">Equipos facturados</label>
              <button onClick={agregarItem} className="text-xs px-3 py-1 bg-[#185FA5] text-white rounded-lg hover:opacity-90">+ Agregar equipo</button>
            </div>
            {form.items.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs border border-dashed border-gray-200 rounded-lg">Sin equipos — clic en "+ Agregar equipo"</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
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
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">🚚 Transporte</label>
                <input type="number" value={form.transporte} onChange={e => setForm({...form, transporte: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5] bg-white" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">🏷️ Descuento</label>
                <input type="number" value={form.descuento} onChange={e => setForm({...form, descuento: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5] bg-white" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">💵 Anticipo recibido</label>
                <input type="number" value={form.anticipo} onChange={e => setForm({...form, anticipo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5] bg-white" placeholder="0" />
              </div>
            </div>
            <div className="border-t border-gray-200 pt-3 grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-xs text-gray-500">Subtotal equipos</div>
                <div className="font-semibold text-sm">{fmt(subtotal)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Total factura</div>
                <div className="font-bold text-lg text-[#185FA5]">{fmt(totalFinal)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Saldo pendiente</div>
                <div className={`font-bold text-lg ${saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(saldo)}</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={guardarFactura} disabled={guardando}
              className="px-6 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
              {guardando ? 'Guardando...' : '✓ Guardar factura'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
        ) : contratos.length === 0 ? (
          <div className="p-8 text-center text-gray-300 text-sm">No hay facturas aún</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">No.</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Cliente</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Salida</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Dev. Est.</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Total</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Anticipo</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Saldo</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {contratos.map(c => {
                const trc = terceros.find(t => t.id === c.cliente_id)
                const saldoC = (c.total || 0) - (c.anticipo || 0)
                return (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-[#185FA5] font-bold">{c.id_doc || '---'}</td>
                    <td className="px-4 py-2 font-semibold text-xs">{trc?.nombre || c.cliente_id}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{c.fecha_salida || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{c.fecha_est_dev || '—'}</td>
                    <td className="px-4 py-2 text-xs font-semibold text-[#185FA5]">{fmt(c.total)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{fmt(c.anticipo)}</td>
                    <td className="px-4 py-2 text-xs font-semibold">
                      <span className={saldoC > 0 ? 'text-red-600' : 'text-green-600'}>{fmt(saldoC)}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${estadoBadge(c.estado)}`}>{c.estado}</span>
                    </td>
                    <td className="px-4 py-2 text-right flex gap-2 justify-end">
                      <button onClick={() => abrirEditar(c)} className="text-xs text-blue-400 hover:text-blue-600">✏️</button>
                      <button onClick={() => eliminarFactura(c.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
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

export default Facturas