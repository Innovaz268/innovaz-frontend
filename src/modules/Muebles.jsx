import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { siguienteConsecutivo } from '../utils/consecutivo'
import { asientoMueble } from '../utils/asientosAuto'

function Muebles() {
  const [vista, setVista] = useState('cotizaciones')
  const [cotizaciones, setCotizaciones] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [terceros, setTerceros] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    cliente_id: '', estado: 'Borrador', fecha: new Date().toISOString().slice(0,10),
    vigencia: '', descripcion: '', items: [], valor: 0, descuento: 0, anticipo: 0, observaciones: ''
  })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: cots }, { data: ords }, { data: trcs }] = await Promise.all([
      supabase.from('muebles_cotizaciones').select('*').order('created_at', { ascending: false }),
      supabase.from('muebles_ordenes').select('*').order('created_at', { ascending: false }),
      supabase.from('terceros').select('id, nombre').order('nombre'),
    ])
    setCotizaciones(cots || [])
    setOrdenes(ords || [])
    setTerceros(trcs || [])
    setLoading(false)
  }

  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')
  const nombreCliente = id => terceros.find(t => t.id === id)?.nombre || '---'

  function agregarItem() {
    setForm({ ...form, items: [...form.items, { descripcion: '', unidad: 'und', cantidad: 1, valor_unit: 0, subtotal: 0 }] })
  }

  function actualizarItem(i, campo, valor) {
    const items = [...form.items]
    items[i] = { ...items[i], [campo]: valor }
    items[i].subtotal = (parseFloat(items[i].cantidad) || 0) * (parseFloat(items[i].valor_unit) || 0)
    setForm({ ...form, items })
  }

  function eliminarItem(i) {
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) })
  }

  const subtotalCot = form.items.reduce((s, i) => s + (i.subtotal || 0), 0)
  const totalCot = subtotalCot + (parseFloat(form.valor) || 0) - (parseFloat(form.descuento) || 0)
  const saldoCot = totalCot - (parseFloat(form.anticipo) || 0)

  function abrirNuevaCot() {
    setEditandoId(null)
    setForm({ cliente_id: '', estado: 'Borrador', fecha: new Date().toISOString().slice(0,10), vigencia: '', descripcion: '', items: [], valor: 0, descuento: 0, anticipo: 0, observaciones: '' })
    setMostrarForm(true)
    setMensaje('')
  }

  function abrirEditarCot(c) {
    setEditandoId(c.id)
    setForm({ cliente_id: c.cliente_id || '', estado: c.estado || 'Borrador', fecha: c.fecha || '', vigencia: c.vigencia || '', descripcion: c.descripcion || '', items: c.items || [], valor: c.valor || 0, descuento: c.descuento || 0, anticipo: c.anticipo || 0, observaciones: c.observaciones || '' })
    setMostrarForm(true)
    setMensaje('')
  }

  async function guardarCotizacion() {
    if (!form.cliente_id) { setMensaje('Seleccione un cliente'); return }
    setGuardando(true)
    const datos = { ...form, total: totalCot, vigencia: form.vigencia || null, fecha: form.fecha || null }
    let error
    if (editandoId) {
      const res = await supabase.from('muebles_cotizaciones').update(datos).eq('id', editandoId)
      error = res.error
    } else {
      const codigo = await siguienteConsecutivo('CM')
      const datos2 = { ...datos, id_doc: codigo }
      const res = await supabase.from('muebles_cotizaciones').insert([datos2])
      error = res.error
    }
    if (error) { setMensaje('Error: ' + error.message); setGuardando(false); return }
    setMensaje(editandoId ? 'Cotizacion actualizada' : 'Cotizacion guardada')
    setMostrarForm(false)
    setEditandoId(null)
    await cargarDatos()
    setGuardando(false)
  }

  async function eliminarCotizacion(id) {
    if (!window.confirm('Eliminar esta cotizacion?')) return
    await supabase.from('muebles_cotizaciones').delete().eq('id', id)
    await cargarDatos()
  }

  async function convertirAOrden(c) {
    if (!window.confirm('Convertir a Orden de Produccion?')) return
    const { error } = await supabase.from('muebles_ordenes').insert([{
      cotizacion_id: c.id, cliente_id: c.cliente_id, estado: 'En diseno',
      fecha_inicio: new Date().toISOString().slice(0,10),
      descripcion: c.descripcion, items: c.items,
      total: c.total, anticipo: c.anticipo, observaciones: c.observaciones
    }])
    if (error) { setMensaje('Error: ' + error.message); return }
    await supabase.from('muebles_cotizaciones').update({ estado: 'Aprobada' }).eq('id', c.id)
    const resultAsiento = await asientoMueble({ ...c })
    console.log('asiento mueble:', resultAsiento)
    setMensaje('Orden de produccion creada')
    setVista('ordenes')
    await cargarDatos()
  }

  async function cambiarEstadoOrden(id, estado) {
    await supabase.from('muebles_ordenes').update({ estado }).eq('id', id)
    await cargarDatos()
  }

  async function eliminarOrden(id) {
    if (!window.confirm('Eliminar esta orden?')) return
    await supabase.from('muebles_ordenes').delete().eq('id', id)
    await cargarDatos()
  }

  const estadoBadgeCot = e => {
    const colores = { Borrador: 'bg-gray-100 text-gray-600', Enviada: 'bg-blue-50 text-blue-700', Aprobada: 'bg-green-50 text-green-700', Rechazada: 'bg-red-50 text-red-700' }
    return colores[e] || 'bg-gray-100 text-gray-600'
  }

  const estadoBadgeOrden = e => {
    const colores = { 'En diseno': 'bg-purple-50 text-purple-700', 'En produccion': 'bg-amber-50 text-amber-700', 'Terminado': 'bg-blue-50 text-blue-700', 'Entregado': 'bg-green-50 text-green-700' }
    return colores[e] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 mt-2">
        <div>
          <h2 className="text-xl font-bold text-[#185FA5]">Diseno y Acabados</h2>
          <p className="text-xs text-gray-400">Cotizaciones y ordenes de produccion de muebles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setVista('cotizaciones'); setMostrarForm(false) }}
            className={`px-3 py-2 text-xs font-bold rounded-lg ${vista === 'cotizaciones' ? 'bg-[#185FA5] text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
            Cotizaciones
          </button>
          <button onClick={() => { setVista('ordenes'); setMostrarForm(false) }}
            className={`px-3 py-2 text-xs font-bold rounded-lg ${vista === 'ordenes' ? 'bg-[#5B21B6] text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
            Ordenes
          </button>
          {vista === 'cotizaciones' && (
            <button onClick={mostrarForm ? () => setMostrarForm(false) : abrirNuevaCot}
              className="px-3 py-2 bg-gradient-to-r from-[#185FA5] to-[#5B21B6] text-white text-xs font-bold rounded-lg hover:opacity-90">
              {mostrarForm ? 'Cancelar' : '+ Nueva'}
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <div className={`mb-3 p-3 rounded-lg text-sm font-semibold ${mensaje.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {mensaje}
        </div>
      )}

      {vista === 'cotizaciones' && mostrarForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">{editandoId ? 'Editar cotizacion' : 'Nueva cotizacion de mueble'}</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Cliente</label>
              <select value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option value="">Seleccionar cliente</option>
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
              <label className="block text-xs font-semibold text-gray-500 mb-1">Vigencia</label>
              <input type="date" value={form.vigencia} onChange={e => setForm({...form, vigencia: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Descripcion del proyecto</label>
              <textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                rows={2} placeholder="Ej: Cocina integral en marmol blanco, isla central..." />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">Partidas / Items</label>
              <button onClick={agregarItem} className="text-xs px-3 py-1 bg-[#185FA5] text-white rounded-lg hover:opacity-90">+ Agregar item</button>
            </div>
            {form.items.length === 0 ? (
              <div className="p-4 text-center text-gray-300 text-xs border border-dashed border-gray-200 rounded-lg">Sin items</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left text-gray-500">Descripcion</th>
                    <th className="px-2 py-1 text-left text-gray-500">Unidad</th>
                    <th className="px-2 py-1 text-left text-gray-500">Cant.</th>
                    <th className="px-2 py-1 text-left text-gray-500">Valor unit.</th>
                    <th className="px-2 py-1 text-left text-gray-500">Subtotal</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-2 py-1">
                        <input value={item.descripcion} onChange={e => actualizarItem(i, 'descripcion', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs" placeholder="Ej: Meson en marmol..." />
                      </td>
                      <td className="px-2 py-1">
                        <select value={item.unidad} onChange={e => actualizarItem(i, 'unidad', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-200 rounded text-xs">
                          <option>und</option>
                          <option>m2</option>
                          <option>ml</option>
                          <option>global</option>
                        </select>
                      </td>
                      <td className="px-2 py-1"><input type="number" value={item.cantidad} onChange={e => actualizarItem(i, 'cantidad', e.target.value)} className="w-16 px-2 py-1 border border-gray-200 rounded text-xs" min="1" /></td>
                      <td className="px-2 py-1"><input type="number" value={item.valor_unit} onChange={e => actualizarItem(i, 'valor_unit', e.target.value)} className="w-28 px-2 py-1 border border-gray-200 rounded text-xs" /></td>
                      <td className="px-2 py-1 font-semibold text-[#185FA5]">{fmt(item.subtotal)}</td>
                      <td className="px-2 py-1"><button onClick={() => eliminarItem(i)} className="text-red-400 hover:text-red-600">x</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Valor</label>
                <input type="number" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})
                } className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Descuento</label>
                <input type="number" value={form.descuento} onChange={e => setForm({...form, descuento: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Anticipo</label>
                <input type="number" value={form.anticipo} onChange={e => setForm({...form, anticipo: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" placeholder="0" />
              </div>
            </div>
            <div className="border-t border-gray-200 pt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xs text-gray-500">Subtotal</div>
                <div className="font-semibold text-sm">{fmt(subtotalCot)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total</div>
                <div className="font-bold text-lg text-[#185FA5]">{fmt(totalCot)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Saldo</div>
                <div className={`font-bold text-lg ${saldoCot > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(saldoCot)}</div>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={2}
              placeholder="Condiciones de pago, garantias, tiempos de entrega..." />
          </div>

          <div className="flex justify-end">
            <button onClick={guardarCotizacion} disabled={guardando}
              className="px-6 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Guardar cotizacion'}
            </button>
          </div>
        </div>
      )}

      {vista === 'cotizaciones' && !mostrarForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
          ) : cotizaciones.length === 0 ? (
            <div className="p-8 text-center text-gray-300 text-sm">No hay cotizaciones aun</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Cliente</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Descripcion</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Fecha</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Total</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Estado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {cotizaciones.map(c => (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-xs">{nombreCliente(c.cliente_id)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{(c.descripcion || '').slice(0,40) || '---'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{c.fecha || '---'}</td>
                    <td className="px-4 py-2 text-xs font-semibold text-[#185FA5]">{fmt(c.total)}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${estadoBadgeCot(c.estado)}`}>{c.estado}</span></td>
                    <td className="px-4 py-2 text-right flex gap-2 justify-end">
                      {c.estado !== 'Aprobada' && (
                        <button onClick={() => convertirAOrden(c)} title="Convertir a orden"
                          className="text-xs text-purple-400 hover:text-purple-600">Orden</button>
                      )}
                      <button onClick={() => abrirEditarCot(c)} className="text-xs text-blue-400 hover:text-blue-600">Editar</button>
                      <button onClick={() => eliminarCotizacion(c.id)} className="text-xs text-red-400 hover:text-red-600">x</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {vista === 'ordenes' && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
          ) : ordenes.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-300 text-sm border border-gray-100">
              No hay ordenes aun. Apruebe una cotizacion primero.
            </div>
          ) : ordenes.map(o => (
            <div key={o.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-sm text-gray-800">{nombreCliente(o.cliente_id)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{(o.descripcion || '').slice(0,60) || '---'}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${estadoBadgeOrden(o.estado)}`}>{o.estado}</span>
              </div>
              <div className="flex gap-1 mb-3">
                {['En diseno', 'En produccion', 'Terminado', 'Entregado'].map((e, i) => {
                  const estados = ['En diseno', 'En produccion', 'Terminado', 'Entregado']
                  const actual = estados.indexOf(o.estado)
                  const activo = i <= actual
                  return (
                    <button key={e} onClick={() => cambiarEstadoOrden(o.id, e)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${activo ? 'bg-[#185FA5] text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                      {e}
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center bg-gray-50 rounded-lg p-2">
                <div>
                  <div className="text-xs text-gray-400">Inicio</div>
                  <div className="text-xs font-semibold">{o.fecha_inicio || '---'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Total</div>
                  <div className="text-sm font-bold text-[#185FA5]">{fmt(o.total)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Entrega est.</div>
                  <div className="text-xs font-semibold">{o.fecha_entrega || '---'}</div>
                </div>
              </div>
              <div className="flex justify-end mt-2">
                <button onClick={() => eliminarOrden(o.id)} className="text-xs text-red-400 hover:text-red-600">x Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

export default Muebles
