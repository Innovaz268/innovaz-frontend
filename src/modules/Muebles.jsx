import { useState, useEffect } from 'react'
import { supabase, empresaActiva } from '../supabase'
import { siguienteConsecutivo } from '../utils/consecutivo'
import { asientoMueble, asientoCostosMueble } from '../utils/asientosAuto'

function Muebles() {
  const [vista, setVista] = useState('cotizaciones')
  const [cotizaciones, setCotizaciones] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [terceros, setTerceros] = useState([])
  const [costos, setCostos] = useState([])
  const [facturas, setFacturas] = useState([])
  const [subiendoFotos, setSubiendoFotos] = useState(null)
  const [ordenCostos, setOrdenCostos] = useState(null)
  const [formCosto, setFormCosto] = useState({ fecha: new Date().toISOString().slice(0,10), tipo: 'Material', descripcion: '', proveedor_id: '', valor: 0, metodo_pago: 'Efectivo' })
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    cliente_id: '', estado: 'Borrador', fecha: new Date().toISOString().slice(0,10),
    vigencia: '', descripcion: '', items: [], valor: 0, descuento: 0, anticipo: 0, observaciones: ''
  })

  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')
  const nombreCliente = id => terceros.find(t => t.id === id)?.nombre || '---'

  useEffect(() => { cargarDatos() }, [])

async function cargarDatos() {
    setLoading(true)
    const [{ data: cots }, { data: ords }, { data: trcs }, { data: csts }, { data: facs }] = await Promise.all([
      supabase.from('muebles_cotizaciones').select('*').order('created_at', { ascending: false }),
      supabase.from('muebles_ordenes').select('*').order('created_at', { ascending: false }),
      supabase.from('terceros').select('id, nombre').order('nombre'),
      supabase.from('muebles_costos').select('*').order('fecha', { ascending: false }),
      supabase.from('muebles_facturas').select('*').order('created_at', { ascending: false }),
    ])
    setCotizaciones(cots || [])
    setOrdenes(ords || [])
    setTerceros(trcs || [])
    setCostos(csts || [])
    setFacturas(facs || [])
    setLoading(false)
  }

  function agregarItem() {
    setForm({ ...form, items: [...form.items, { descripcion: '', unidad: 'und', cantidad: 1, valor_unit: 0, subtotal: 0 }] })
  }

  function eliminarItem(i) {
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) })
  }
  function actualizarItem(i, campo, valor) {
    const items = [...form.items]
    items[i] = { ...items[i], [campo]: valor }
    items[i].subtotal = (parseFloat(items[i].cantidad) || 0) * (parseFloat(items[i].valor_unit) || 0)
    setForm({ ...form, items })
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
    const datos = { ...form, total: totalCot, valor: parseFloat(form.valor) || 0, descuento: parseFloat(form.descuento) || 0, anticipo: parseFloat(form.anticipo) || 0, vigencia: form.vigencia || null, fecha: form.fecha || null }
    let error
    if (editandoId) {
      const res = await supabase.from('muebles_cotizaciones').update(datos).eq('id', editandoId)
      error = res.error
    } else {
      const codigo = await siguienteConsecutivo('CM')
      const datos2 = { ...datos, id_doc: codigo, empresa_id: empresaActiva() }
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

  async function aceptarCotizacion(c) {
    if (!window.confirm('¿Aceptar la cotización y generar la Factura de Muebles?')) return
    const codigoFM = await siguienteConsecutivo('FM')
    const { data: factura, error } = await supabase.from('muebles_facturas').insert([{
      id_doc: codigoFM,
      cotizacion_id: c.id,
      cliente_id: c.cliente_id,
      descripcion: c.descripcion,
      items: c.items,
      total: c.total || 0,
      anticipo: c.anticipo || 0,
      estado: 'Activa',
      fecha: new Date().toISOString().slice(0,10),
      observaciones: c.observaciones,
      empresa_id: empresaActiva()
    }]).select().single()
    if (error) { setMensaje('Error: ' + error.message); return }

    // Asiento de venta + abono (con el número de factura FM)
    const resultAsiento = await asientoMueble({ ...c, id_doc: codigoFM })
    console.log('asiento factura muebles:', resultAsiento)

    // Marcar la cotización como Facturada
    await supabase.from('muebles_cotizaciones').update({ estado: 'Facturada' }).eq('id', c.id)

    setMensaje('Factura de muebles generada: ' + codigoFM)
    setVista('facturas')
    await cargarDatos()
  }
  async function emitirOrden(f) {
    if (!window.confirm('¿Emitir la Orden de Producción para esta factura?')) return
    const codigoOM = await siguienteConsecutivo('OM')
    const { error } = await supabase.from('muebles_ordenes').insert([{
      id_doc: codigoOM,
      factura_id: f.id,
      cotizacion_id: f.cotizacion_id,
      cliente_id: f.cliente_id,
      estado: 'En diseno',
      fecha_inicio: new Date().toISOString().slice(0,10),
      descripcion: f.descripcion,
      items: f.items,
      total: f.total,
      anticipo: f.anticipo,
      observaciones: f.observaciones,
      empresa_id: empresaActiva()
    }])
    if (error) { setMensaje('Error: ' + error.message); return }
    setMensaje('Orden de producción emitida: ' + codigoOM)
    setVista('ordenes')
    await cargarDatos()
  }

  async function cambiarEstadoOrden(id, estado) {
    const datos = { estado }
    if (estado === 'Entregado') {
      datos.fecha_entrega = new Date().toISOString().slice(0, 10)
    }
    await supabase.from('muebles_ordenes').update(datos).eq('id', id)
    if (estado === 'Entregado') {
      setSubiendoFotos(id)
    }
    await cargarDatos()
  }

  async function subirFotosEntrega(ordenId, files) {
    if (!files || files.length === 0) return
    setMensaje('Subiendo fotos...')
    const orden = ordenes.find(o => o.id === ordenId)
    const urls = [...(orden?.fotos_entrega || [])]
    for (const file of files) {
      const nombre = `entregas/${ordenId}_${Date.now()}_${file.name.replace(/\s/g, '_')}`
      const { error } = await supabase.storage.from('publico').upload(nombre, file, { upsert: true })
      if (error) { setMensaje('Error subiendo foto: ' + error.message); return }
      const { data } = supabase.storage.from('publico').getPublicUrl(nombre)
      urls.push(data.publicUrl)
    }
    await supabase.from('muebles_ordenes').update({ fotos_entrega: urls }).eq('id', ordenId)
    setMensaje('✓ Fotos de entrega guardadas')
    await cargarDatos()
  }

  async function eliminarOrden(id) {
    if (!window.confirm('Eliminar esta orden?')) return
    await supabase.from('muebles_ordenes').delete().eq('id', id)
    await cargarDatos()
  }
  const costosDeOrden = ordenId => costos.filter(c => c.orden_id === ordenId)
  const totalCostosOrden = ordenId => costosDeOrden(ordenId).reduce((s, c) => s + (parseFloat(c.valor) || 0), 0)

  function abrirCostos(orden) {
    setOrdenCostos(ordenCostos === orden.id ? null : orden.id)
    setFormCosto({ fecha: new Date().toISOString().slice(0,10), tipo: 'Material', descripcion: '', proveedor_id: '', valor: 0, metodo_pago: 'Efectivo' })
    setMensaje('')
  }

  async function guardarCosto(ordenId) {
    if (!formCosto.descripcion) { setMensaje('Escriba una descripcion del costo'); return }
    if (!formCosto.valor || parseFloat(formCosto.valor) <= 0) { setMensaje('El valor debe ser mayor a cero'); return }
    const datos = {
      orden_id: ordenId,
      fecha: formCosto.fecha || null,
      tipo: formCosto.tipo,
      descripcion: formCosto.descripcion,
      proveedor_id: formCosto.proveedor_id || null,
      valor: parseFloat(formCosto.valor) || 0,
      metodo_pago: formCosto.metodo_pago,
      empresa_id: empresaActiva()
    }
    const { error } = await supabase.from('muebles_costos').insert([datos])
    if (error) { setMensaje('Error: ' + error.message); return }
    setFormCosto({ fecha: new Date().toISOString().slice(0,10), tipo: 'Material', descripcion: '', proveedor_id: '', valor: 0, metodo_pago: 'Efectivo' })
    setMensaje('Costo registrado')
    await cargarDatos()
  }

  async function eliminarCosto(id) {
    if (!window.confirm('Eliminar este costo?')) return
    await supabase.from('muebles_costos').delete().eq('id', id)
    await cargarDatos()
  }

  async function generarAsientoCostos(orden) {
    if (orden.asiento_costos) { setMensaje('Esta orden ya fue costeada (' + orden.asiento_costos + ')'); return }
    const lista = costosDeOrden(orden.id)
    if (lista.length === 0) { setMensaje('Esta orden no tiene costos registrados'); return }
    if (!window.confirm('Generar el asiento contable con los costos de esta orden?')) return
    const res = await asientoCostosMueble(orden, lista)
    if (!res.ok) { setMensaje('Error: ' + res.msg); return }
    await supabase.from('muebles_ordenes').update({ asiento_costos: res.codigo }).eq('id', orden.id)
    setMensaje(res.msg)
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
          <button onClick={() => { setVista('facturas'); setMostrarForm(false) }}
            className={`px-3 py-2 text-xs font-bold rounded-lg ${vista === 'facturas' ? 'bg-[#27500A] text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
            Facturas
          </button>
          <button onClick={() => { setVista('ordenes'); setMostrarForm(false) }}
            className={`px-3 py-2 text-xs font-bold rounded-lg ${vista === 'ordenes' ? 'bg-[#5B21B6] text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
            Ordenes
          </button>
          {vista === 'cotizaciones' && (
            <button onClick={mostrarForm ? () => setMostrarForm(false) : abrirNuevaCot}
              className="px-3 py-2 btn-empresa text-white text-xs font-bold rounded-lg hover:opacity-90">
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
        <div className="card p-4 mb-4">
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
        <div className="card overflow-hidden">
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
                      {c.estado !== 'Facturada' && c.estado !== 'Aprobada' && (
                        <button onClick={() => aceptarCotizacion(c)} title="Aceptar y facturar"
                          className="text-xs text-green-600 hover:text-green-800 font-semibold">✓ Facturar</button>
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

{vista === 'facturas' && (
        <div className="card overflow-hidden">
          {facturas.length === 0 ? (
            <div className="p-8 text-center text-gray-300 text-sm">No hay facturas de muebles</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Factura</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Cliente</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Descripción</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Total</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Anticipo</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Saldo</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Estado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {facturas.map(f => {
                  const tieneOrden = ordenes.some(o => o.factura_id === f.id)
                  const saldo = (f.total || 0) - (f.anticipo || 0)
                  return (
                    <tr key={f.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 font-semibold text-xs text-[#27500A]">{f.id_doc || '—'}</td>
                      <td className="px-4 py-2 text-xs">{nombreCliente(f.cliente_id)}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{f.descripcion || '—'}</td>
                      <td className="px-4 py-2 text-xs text-right font-semibold">{fmt(f.total)}</td>
                      <td className="px-4 py-2 text-xs text-right text-gray-500">{fmt(f.anticipo)}</td>
                      <td className="px-4 py-2 text-xs text-right font-semibold text-red-600">{fmt(saldo)}</td>
                      <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-semibold">{f.estado}</span></td>
                      <td className="px-4 py-2 text-right">
                        {tieneOrden ? (
                          <span className="text-xs text-gray-400">Orden emitida</span>
                        ) : (
                          <button onClick={() => emitirOrden(f)} className="text-xs text-[#5B21B6] hover:underline font-semibold">Emitir orden</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
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
            <div key={o.id} className="card p-4">
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

              {subiendoFotos === o.id && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs font-semibold text-green-700 mb-2">📸 Fotos de entrega</p>
                  <input type="file" accept="image/*" multiple capture="environment" onChange={e => subirFotosEntrega(o.id, e.target.files)}
                    className="text-xs" />
                  <button onClick={() => setSubiendoFotos(null)} className="ml-2 text-xs text-gray-400 hover:text-gray-600">Cerrar</button>
                </div>
              )}

              {(o.fotos_entrega && o.fotos_entrega.length > 0) && (
                <div className="mb-3 flex gap-2 flex-wrap">
                  {o.fotos_entrega.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={`Entrega ${idx+1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                    </a>
                  ))}
                </div>
              )}
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
              <div className="flex justify-between items-center mt-2">
                <button onClick={() => abrirCostos(o)} className="text-xs font-semibold text-[#185FA5] hover:underline">
                  {ordenCostos === o.id ? 'Ocultar costos' : `Costos (${costosDeOrden(o.id).length})`}
                </button>
                <button onClick={() => eliminarOrden(o.id)} className="text-xs text-red-400 hover:text-red-600">x Eliminar</button>
              </div>

              {ordenCostos === o.id && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  {costosDeOrden(o.id).length === 0 ? (
                    <div className="p-3 text-center text-gray-300 text-xs border border-dashed border-gray-200 rounded-lg mb-3">Sin costos registrados</div>
                  ) : (
                    <table className="w-full text-xs mb-3">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1 text-left text-gray-500">Fecha</th>
                          <th className="px-2 py-1 text-left text-gray-500">Tipo</th>
                          <th className="px-2 py-1 text-left text-gray-500">Descripcion</th>
                          <th className="px-2 py-1 text-left text-gray-500">Proveedor</th>
                          <th className="px-2 py-1 text-right text-gray-500">Valor</th>
                          <th className="px-2 py-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {costosDeOrden(o.id).map(c => (
                          <tr key={c.id} className="border-t border-gray-50">
                            <td className="px-2 py-1 text-gray-500">{c.fecha || '---'}</td>
                            <td className="px-2 py-1">{c.tipo}</td>
                            <td className="px-2 py-1">{c.descripcion}</td>
                            <td className="px-2 py-1 text-gray-500">{nombreCliente(c.proveedor_id)}</td>
                            <td className="px-2 py-1 text-right font-semibold">{fmt(c.valor)}</td>
                            <td className="px-2 py-1"><button onClick={() => eliminarCosto(c.id)} className="text-red-400 hover:text-red-600">x</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div className="grid grid-cols-6 gap-2 mb-2">
                    <input type="date" value={formCosto.fecha} onChange={e => setFormCosto({...formCosto, fecha: e.target.value})} className="px-2 py-1 border border-gray-200 rounded text-xs" />
                    <select value={formCosto.tipo} onChange={e => setFormCosto({...formCosto, tipo: e.target.value})} className="px-2 py-1 border border-gray-200 rounded text-xs">
                      <option>Material</option>
                      <option>Mano de obra</option>
                      <option>Transporte</option>
                      <option>Otro</option>
                    </select>
                    <input value={formCosto.descripcion} onChange={e => setFormCosto({...formCosto, descripcion: e.target.value})} placeholder="Descripcion" className="col-span-2 px-2 py-1 border border-gray-200 rounded text-xs" />
                    <select value={formCosto.proveedor_id} onChange={e => setFormCosto({...formCosto, proveedor_id: e.target.value})} className="px-2 py-1 border border-gray-200 rounded text-xs">
                      <option value="">Proveedor</option>
                      {terceros.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                    <input type="number" value={formCosto.valor} onChange={e => setFormCosto({...formCosto, valor: e.target.value})} placeholder="Valor" className="px-2 py-1 border border-gray-200 rounded text-xs" />
                  </div>

                  <div className="flex justify-between items-center mb-3">
                    <select value={formCosto.metodo_pago} onChange={e => setFormCosto({...formCosto, metodo_pago: e.target.value})} className="px-2 py-1 border border-gray-200 rounded text-xs">
                      <option>Efectivo</option>
                      <option>Transferencia</option>
                      <option>Nequi</option>
                      <option>Daviplata</option>
                      <option>Credito</option>
                    </select>
                    <button onClick={() => guardarCosto(o.id)} className="px-4 py-1.5 bg-[#185FA5] text-white text-xs font-bold rounded-lg hover:opacity-90">+ Agregar costo</button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center bg-gray-50 rounded-lg p-2">
                    <div>
                      <div className="text-xs text-gray-400">Venta</div>
                      <div className="text-sm font-bold text-[#185FA5]">{fmt(o.total)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Costo total</div>
                      <div className="text-sm font-bold text-[#92400E]">{fmt(totalCostosOrden(o.id))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Utilidad</div>
                      <div className={`text-sm font-bold ${(o.total || 0) - totalCostosOrden(o.id) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt((o.total || 0) - totalCostosOrden(o.id))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-3">
                    {o.asiento_costos ? (
                      <span className="px-4 py-2 bg-green-50 text-green-700 text-xs font-bold rounded-lg">
                        ✓ Costeada — comprobante {o.asiento_costos}
                      </span>
                    ) : (
                      <button onClick={() => generarAsientoCostos(o)}
                        className="px-4 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90">
                        Generar asiento de costos
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

export default Muebles
