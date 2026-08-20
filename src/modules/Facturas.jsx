import { siguienteConsecutivo } from '../utils/consecutivo'
import React, { useState, useEffect } from 'react'
import { supabase, empresaActiva } from '../supabase'
import { asientoFactura } from '../utils/asientosAuto'
import { moverKardex } from '../utils/kardexAuto'
import { imprimirConMembrete } from '../utils/membrete'
import PanelFirma from '../components/PanelFirma'
import { registrarAuditoria } from '../utils/auditoria'
import BuscadorTercero from '../components/BuscadorTercero'

function Facturas() {
  const [contratos, setContratos] = useState([])
  const [terceros, setTerceros] = useState([])
  const [equipos, setEquipos] = useState([])
  const [lineas, setLineas] = useState([])
  const [verLineas, setVerLineas] = useState(null)
  const [refacturando, setRefacturando] = useState([])
  const [seleccionRefac, setSeleccionRefac] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [firmandoFactura, setFirmandoFactura] = useState(null)
  const [form, setForm] = useState({
    cliente_id: '', estado: 'Activo', fecha_salida: new Date().toISOString().slice(0,10),
    fecha_est_dev: '', ubicacion: '', unidad_negocio: 'ALQ',
    observaciones: '', items: [], transporte: 0, descuento: 0, anticipo: 0
  })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: cts }, { data: trcs }, { data: eqs }, { data: lns }] = await Promise.all([
      supabase.from('contratos').select('*').order('created_at', { ascending: false }),
      supabase.from('terceros').select('id, nombre, dir').order('nombre'),
      supabase.from('equipos').select('id, nombre, tarifa, stock').order('nombre'),
      supabase.from('alquiler_lineas').select('*').order('created_at', { ascending: false }),
    ])
    setContratos(cts || [])
    setTerceros(trcs || [])
    setEquipos(eqs || [])
    setLineas(lns || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setEditandoId(null)
    setRefacturando([])
    setSeleccionRefac([])
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

    // Control de stock: detectar equipos facturados por encima de lo disponible
    if (!editandoId) {
      console.log('EQUIPOS EN MEMORIA:', equipos.map(e => ({ nombre: e.nombre, stock: e.stock })))
      const excedidos = []
      for (const it of form.items) {
        if (it.equipo_id) {
         const eq = equipos.find(e => e.id === it.equipo_id)
          const disp = eq ? (eq.stock || 0) : 0
          const pedida = parseFloat(it.cantidad) || 0
          if (pedida > disp) {
            excedidos.push(`${it.nombre}: pide ${pedida}, disponible ${disp}`)
          }
        }
      }
      if (excedidos.length > 0) {
        // Exigir la observación (prestado por XXX)
        if (!form.observaciones || !form.observaciones.trim()) {
          setMensaje('⚠️ Está facturando más de lo disponible (' + excedidos.join(' · ') + '). Indique en Observaciones de quién es el equipo prestado (ej: "Prestado por Juan").')
          return
        }
        // Confirmar que quiere continuar
        if (!window.confirm('Atención: está facturando más de lo disponible:\n\n' + excedidos.join('\n') + '\n\nObservación: ' + form.observaciones + '\n\n¿Desea continuar?')) {
          return
        }
      }
    }
    setGuardando(true)
    setMensaje('')
    const datos = { ...form, total: totalFinal }
    
    let codigo = ''
let error
    if (editandoId) {
      // Al editar: revertir rastros viejos (stock, kardex, líneas, asiento) y recrear
      // 1. Devolver stock de las salidas viejas
      const { data: movsViejos } = await supabase.from('kardex').select('equipo_id, tipo, cantidad').eq('contrato_id', editandoId)
      for (const m of (movsViejos || [])) {
        if (m.tipo === 'Salida' && m.equipo_id) {
          const { data: eq } = await supabase.from('equipos').select('stock').eq('id', m.equipo_id).single()
          if (eq) await supabase.from('equipos').update({ stock: (eq.stock || 0) + (parseInt(m.cantidad) || 0) }).eq('id', m.equipo_id)
        }
      }
      // 2. Borrar kardex, líneas y asiento viejos
      await supabase.from('kardex').delete().eq('contrato_id', editandoId)
      await supabase.from('alquiler_lineas').delete().eq('contrato_id', editandoId)
      const { data: facVieja } = await supabase.from('contratos').select('id_doc').eq('id', editandoId).single()
      codigo = facVieja?.id_doc || ''
      if (codigo) {
        const { data: asViejo } = await supabase.from('asientos_contables').select('id').eq('documento_id', codigo)
        for (const a of (asViejo || [])) {
          await supabase.from('asientos_lineas').delete().eq('asiento_id', a.id)
          await supabase.from('asientos_contables').delete().eq('id', a.id)
        }
      }
      // 3. Actualizar el contrato (conserva su id_doc)
      const res = await supabase.from('contratos').update(datos).eq('id', editandoId).select().single()
      error = res.error
      if (!error && res.data) {
        const lineas = form.items.map(it => ({
          contrato_id: res.data.id,
          equipo_id: it.equipo_id || null,
          nombre: it.nombre || '',
          cantidad: parseFloat(it.cantidad) || 1,
          dias: parseFloat(it.dias) || 1,
          tarifa: parseFloat(it.tarifa) || 0,
          subtotal: parseFloat(it.subtotal) || 0,
          fecha_salida: form.fecha_salida || null,
          fecha_est_dev: form.fecha_est_dev || null,
          estado: 'En obra',
          empresa_id: empresaActiva()
        }))
        if (lineas.length > 0) await supabase.from('alquiler_lineas').insert(lineas)
        for (const it of form.items) {
          if (it.equipo_id) {
            await moverKardex({
              equipo_id: it.equipo_id,
              tipo: 'Salida',
              cantidad: it.cantidad,
              contrato_id: res.data.id,
              observacion: 'Alquiler ' + (codigo || '')
            })
          }
        }
        await asientoFactura({ ...datos, id_doc: codigo })
        await registrarAuditoria('editó', 'Factura', codigo)
      }
    } else {
      codigo = await siguienteConsecutivo('FC')
      const datos2 = { ...datos, id_doc: codigo, empresa_id: empresaActiva() }
      const res = await supabase.from('contratos').insert([datos2]).select().single()
      error = res.error
      if (!error && res.data) {
        const lineas = form.items.map(it => ({
          contrato_id: res.data.id,
          equipo_id: it.equipo_id || null,
          nombre: it.nombre || '',
          cantidad: parseFloat(it.cantidad) || 1,
          dias: parseFloat(it.dias) || 1,
          tarifa: parseFloat(it.tarifa) || 0,
          subtotal: parseFloat(it.subtotal) || 0,
          fecha_salida: form.fecha_salida || null,
          fecha_est_dev: form.fecha_est_dev || null,
          estado: 'En obra',
          empresa_id: empresaActiva()
        }))
        if (lineas.length > 0) await supabase.from('alquiler_lineas').insert(lineas)
          if (refacturando.length === 0) {
          for (const it of form.items) {
            if (it.equipo_id) {
              await moverKardex({
                equipo_id: it.equipo_id,
                tipo: 'Salida',
                cantidad: it.cantidad,
                contrato_id: res.data.id,
                observacion: 'Alquiler ' + (codigo || '')
              })
            }
          }
        }
        if (refacturando.length > 0) {
          for (const r of refacturando) {
            const cantMax = parseFloat(r.cantidad) || 1
            const cant = parseFloat(r.cantRefac) || cantMax
            if (cant >= cantMax) {
              await supabase.from('alquiler_lineas')
                .update({ estado: 'Refacturado', refactura_id: res.data.id })
                .eq('id', r.id)
            } else {
              await supabase.from('alquiler_lineas')
                .update({ cantidad: cantMax - cant, subtotal: (cantMax - cant) * (parseFloat(r.dias)||0) * (parseFloat(r.tarifa)||0) })
                .eq('id', r.id)
              await supabase.from('alquiler_lineas').insert([{
                contrato_id: r.contrato_id,
                equipo_id: r.equipo_id,
                nombre: r.nombre,
                cantidad: cant,
                dias: r.dias,
                tarifa: r.tarifa,
                subtotal: cant * (parseFloat(r.dias)||0) * (parseFloat(r.tarifa)||0),
                fecha_salida: r.fecha_salida,
                fecha_est_dev: r.fecha_est_dev,
                estado: 'Refacturado',
                refactura_id: res.data.id,
                empresa_id: empresaActiva()
              }])
            }
          }
        }
      }
    }
    if (error) { setMensaje('Error: ' + error.message); setGuardando(false); return }
    if (!editandoId) {
      await asientoFactura({ ...datos, id_doc: codigo })
      await registrarAuditoria('creó', 'Factura', codigo)
    }
    setMensaje(editandoId ? 'Factura actualizada' : 'Factura creada')  
    setMostrarForm(false)
    setRefacturando([])
    setSeleccionRefac([])
    setEditandoId(null)
    await cargarDatos()
    setGuardando(false)
  }

  async function eliminarFactura(id) {
    if (!window.confirm('¿Eliminar esta factura? Se borrarán también su asiento contable, los pagos recibidos, y se devolverá el stock de los equipos. Esta acción no se puede deshacer.')) return

    // 1. Traer la factura (para su id_doc)
    const { data: factura } = await supabase.from('contratos').select('id_doc').eq('id', id).single()
    const idDoc = factura?.id_doc

    // 2. Devolver el stock: leer las salidas de kardex de esta factura y sumar de vuelta
    const { data: movs } = await supabase.from('kardex').select('equipo_id, tipo, cantidad').eq('contrato_id', id)
    for (const m of (movs || [])) {
      if (m.tipo === 'Salida' && m.equipo_id) {
        const { data: eq } = await supabase.from('equipos').select('stock').eq('id', m.equipo_id).single()
        if (eq) {
          await supabase.from('equipos').update({ stock: (eq.stock || 0) + (parseInt(m.cantidad) || 0) }).eq('id', m.equipo_id)
        }
      }
    }

    // 3. Borrar el kardex de esta factura
    await supabase.from('kardex').delete().eq('contrato_id', id)

    // 4. Borrar los pagos de caja de esta factura + sus asientos
    const { data: pagos } = await supabase.from('caja').select('id_doc').eq('contrato_id', id)
    for (const p of (pagos || [])) {
      if (p.id_doc) {
        const { data: asPago } = await supabase.from('asientos_contables').select('id').eq('documento_id', p.id_doc)
        for (const a of (asPago || [])) {
          await supabase.from('asientos_lineas').delete().eq('asiento_id', a.id)
          await supabase.from('asientos_contables').delete().eq('id', a.id)
        }
      }
    }
    await supabase.from('caja').delete().eq('contrato_id', id)

    // 5. Borrar el asiento de la factura + sus líneas (por id_doc)
    if (idDoc) {
      const { data: asFactura } = await supabase.from('asientos_contables').select('id').eq('documento_id', idDoc)
      for (const a of (asFactura || [])) {
        await supabase.from('asientos_lineas').delete().eq('asiento_id', a.id)
        await supabase.from('asientos_contables').delete().eq('id', a.id)
      }
    }

    // 6. Borrar las líneas de alquiler
    await supabase.from('alquiler_lineas').delete().eq('contrato_id', id)

    // 7. Borrar el contrato
    await supabase.from('contratos').delete().eq('id', id)

    await registrarAuditoria('eliminó', 'Factura', idDoc || '')
    await cargarDatos()
  }

  function imprimirFactura(c) {
    const trc = terceros.find(t => t.id === c.cliente_id)
    const equipos = lineas.filter(l => l.contrato_id === c.id)
    const saldoC = (c.total || 0) - (c.anticipo || 0)
    let filasEq = ''
        equipos.forEach((l, i) => filasEq += `<tr><td style="text-align:center">${i+1}</td><td>${l.nombre || '—'}</td><td style="text-align:center">${l.cantidad || 0}</td><td style="text-align:center">${l.fecha_salida || '—'}</td><td style="text-align:center">${l.fecha_est_dev || '—'}</td></tr>`)
    const contenido = `
      <table style="margin-bottom:15px">
        <tr><td class="tot" style="width:30%">Factura N°</td><td>${c.id_doc || '—'}</td><td class="tot" style="width:20%">Fecha</td><td>${c.fecha_salida || '—'}</td></tr>
        <tr><td class="tot">Cliente</td><td>${trc?.nombre || '—'}</td><td class="tot">Identificación</td><td>${trc?.nit || '—'}</td></tr>
        <tr><td class="tot">Teléfono</td><td>${trc?.tel || '—'}</td><td class="tot">Dev. estimada</td><td>${c.fecha_est_dev || '—'}</td></tr>
        <tr><td class="tot">Ubicación</td><td colspan="3">${c.ubicacion || '—'}</td></tr>
      </table>
            ${equipos.length > 0 ? `<table><thead><tr><th style="width:40px">#</th><th>Equipo</th><th style="width:60px">Cant.</th><th style="width:90px">Salida</th><th style="width:90px">Dev. est.</th></tr></thead><tbody>${filasEq}</tbody></table>` : ''}
      <table style="margin-top:15px;width:50%;margin-left:auto">
        <tr><td class="tot">Total</td><td class="der">${fmt(c.total)}</td></tr>
        <tr><td class="tot">Anticipo</td><td class="der">${fmt(c.anticipo)}</td></tr>
        <tr><td class="tot" style="font-size:14px">Saldo</td><td class="der" style="font-size:14px;font-weight:bold">${fmt(saldoC)}</td></tr>
      </table>
      ${c.firma ? `<div style="text-align:center;margin-top:50px"><img src="${c.firma}" style="height:50px"><div style="border-top:1px solid #333;width:220px;margin:4px auto 0;padding-top:4px;font-size:12px">Recibí conforme — ${trc?.nombre || 'Cliente'}</div></div>` : `<div style="text-align:center;margin-top:70px"><div style="border-top:1px solid #333;width:220px;margin:0 auto;padding-top:4px;font-size:12px">Recibí conforme — ${trc?.nombre || 'Cliente'}</div></div>`}`
    imprimirConMembrete('Factura de Alquiler', contenido, '#185FA5')
  }
  async function devolverEquipo(linea) {
    const cantMax = parseFloat(linea.cantidad) || 1
    let cant = cantMax
    if (cantMax > 1) {
      const resp = window.prompt(`¿Cuántas unidades devuelve? (disponibles: ${cantMax})`, cantMax)
      if (resp === null) return
      cant = parseFloat(resp)
      if (!cant || cant <= 0 || cant > cantMax) { setMensaje('Cantidad inválida'); return }
    }
    const fecha = window.prompt('Fecha de devolución (AAAA-MM-DD):', new Date().toISOString().slice(0,10))
    if (!fecha) return

    if (cant === cantMax) {
      // Devuelve toda la línea
      const { error } = await supabase.from('alquiler_lineas')
        .update({ estado: 'Devuelto', fecha_dev_real: fecha })
        .eq('id', linea.id)
      if (error) { setMensaje('Error: ' + error.message); return }
    } else {
      // Devuelve parte: reduce la original y crea una fila devuelta
      await supabase.from('alquiler_lineas')
        .update({ cantidad: cantMax - cant, subtotal: (cantMax - cant) * (parseFloat(linea.dias)||0) * (parseFloat(linea.tarifa)||0) })
        .eq('id', linea.id)
      await supabase.from('alquiler_lineas').insert([{
        contrato_id: linea.contrato_id,
        equipo_id: linea.equipo_id,
        nombre: linea.nombre,
        cantidad: cant,
        dias: linea.dias,
        tarifa: linea.tarifa,
        subtotal: cant * (parseFloat(linea.dias)||0) * (parseFloat(linea.tarifa)||0),
        fecha_salida: linea.fecha_salida,
        fecha_est_dev: linea.fecha_est_dev,
        estado: 'Devuelto',
        fecha_dev_real: fecha
      }])
    }
    if (linea.equipo_id) {
      await moverKardex({
        equipo_id: linea.equipo_id,
        tipo: 'Entrada',
        cantidad: cant,
        contrato_id: linea.contrato_id,
        observacion: 'Devolución equipo'
      })
    }
    setMensaje('✓ Devolución registrada: ' + linea.nombre + ' (' + cant + ')')
    await cargarDatos()
  }
  function iniciarRefacturacion(contrato) {
    const seleccionados = seleccionRefac.filter(s => s.contrato_id === contrato.id)
    if (seleccionados.length === 0) return
    const conCantidad = []
    for (const s of seleccionados) {
      const cantMax = parseFloat(s.cantidad) || 1
      let cant = cantMax
      if (cantMax > 1) {
        const resp = window.prompt(`${s.nombre}: ¿cuántas unidades continúan? (disponibles: ${cantMax})`, cantMax)
        if (resp === null) return
        cant = parseFloat(resp)
        if (!cant || cant <= 0 || cant > cantMax) { setMensaje('Cantidad inválida en ' + s.nombre); return }
      }
      conCantidad.push({ ...s, cantRefac: cant })
    }
    setEditandoId(null)
    setRefacturando(conCantidad)
    setForm({
      cliente_id: contrato.cliente_id || '',
      estado: 'Activo',
      fecha_salida: new Date().toISOString().slice(0,10),
      fecha_est_dev: '',
      ubicacion: contrato.ubicacion || '',
      unidad_negocio: 'ALQ',
      observaciones: 'Refacturación de ' + (contrato.id_doc || ''),
      items: conCantidad.map(s => ({
        equipo_id: s.equipo_id || '',
        nombre: s.nombre || '',
        cantidad: s.cantRefac,
        dias: 1,
        tarifa: parseFloat(s.tarifa) || 0,
        subtotal: s.cantRefac * (parseFloat(s.tarifa) || 0),
        bloqueado: true
      })),
      transporte: 0, descuento: 0, anticipo: 0
    })
    setMostrarForm(true)
    setVerLineas(null)
    setMensaje('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
          className="px-4 py-2 btn-empresa text-white text-xs font-bold rounded-lg hover:opacity-90">
          {mostrarForm ? '✕ Cancelar' : '+ Nueva Factura'}
        </button>
      </div>

      {mensaje && (
        <div className={`mb-3 p-3 rounded-lg text-sm font-semibold ${mensaje.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {mensaje}
        </div>
      )}

      {mostrarForm && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">{editandoId ? '✏️ Editar factura' : 'Nueva factura de alquiler'}</h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Cliente *</label>
              <BuscadorTercero
                value={form.cliente_id}
                onChange={id => clienteSeleccionado(id)}
                terceros={terceros}
                onNuevoTercero={cargarDatos}
              />
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
              <label className="block text-xs font-semibold text-gray-500 mb-1">📍 Dirección de entrega</label>
              <input value={form.ubicacion} onChange={e => setForm({...form, ubicacion: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="A dónde se lleva el equipo" />
              {form.cliente_id && (() => {
                const dirCli = terceros.find(t => t.id === form.cliente_id)?.dir || ''
                return dirCli ? (
                  <p className="text-xs text-gray-400 mt-1">
                    Dirección del cliente: {dirCli}
                    {form.ubicacion !== dirCli && (
                      <button type="button" onClick={() => setForm({ ...form, ubicacion: dirCli })}
                        className="ml-2 text-blue-400 hover:text-blue-600">usar esta</button>
                    )}
                  </p>
                ) : null
              })()}
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
                            {equipos.map(e => <option key={e.id} value={e.id}>{e.nombre} (disp: {e.stock ?? 0})</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1"><input type="number" value={item.cantidad} onChange={e => actualizarItem(i, 'cantidad', e.target.value)} disabled={item.bloqueado} className={`w-16 px-2 py-1 border border-gray-200 rounded text-xs ${item.bloqueado ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`} min="1" title={item.bloqueado ? 'Cantidad fija por refacturación' : ''} /></td>
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
      <div className="card overflow-hidden">
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
                  <React.Fragment key={c.id}>
                  <tr className="border-t border-gray-50 hover:bg-gray-50">
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
                    <td className="px-4 py-2 text-right flex gap-2 justify-end whitespace-nowrap">
                      <button onClick={() => setVerLineas(verLineas === c.id ? null : c.id)} className="text-xs text-[#185FA5] hover:underline font-semibold">Equipos</button>
                      <button onClick={() => setFirmandoFactura(c.id)} className="text-xs text-[#5B21B6] hover:underline">{c.firma ? '✓ Firmado' : '✍️ Firmar'}</button>
                      <button onClick={() => imprimirFactura(c)} className="text-xs text-[#185FA5] hover:underline">🖨️</button>
                      <button onClick={() => abrirEditar(c)} className="text-xs text-blue-400 hover:text-blue-600">✏️</button>
                      <button onClick={() => eliminarFactura(c.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                  {verLineas === c.id && (
                      <tr>
                        <td colSpan={9} className="px-4 py-3 bg-gray-50">
                          <div className="text-xs font-semibold text-gray-600 mb-2">Equipos de esta factura</div>
                          {lineas.filter(l => l.contrato_id === c.id).length === 0 ? (
                            <div className="text-xs text-gray-400 p-2">Sin equipos registrados en control</div>
                          ) : (
                            <table className="w-full text-xs bg-white rounded-lg overflow-hidden">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-2 py-1 text-left text-gray-500">Equipo</th>
                                  <th className="px-2 py-1 text-left text-gray-500">Salida</th>
                                  <th className="px-2 py-1 text-left text-gray-500">Dev. est.</th>
                                  <th className="px-2 py-1 text-left text-gray-500">Estado</th>
                                  <th className="px-2 py-1 text-left text-gray-500">Dev. real</th>
                                  <th className="px-2 py-1"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {lineas.filter(l => l.contrato_id === c.id).map(l => (
                                  <tr key={l.id} className="border-t border-gray-50">
                                    <td className="px-2 py-1 font-semibold">{l.nombre}</td>
                                    <td className="px-2 py-1 text-gray-500">{l.fecha_salida || '—'}</td>
                                    <td className="px-2 py-1 text-gray-500">{l.fecha_est_dev || '—'}</td>
                                    <td className="px-2 py-1">
                                      <span className={`px-2 py-0.5 rounded-full font-semibold ${l.estado === 'En obra' ? 'bg-amber-50 text-amber-700' : l.estado === 'Devuelto' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'}`}>{l.estado}</span>
                                    </td>
                                    <td className="px-2 py-1 text-gray-500">{l.fecha_dev_real || '—'}</td>
                                    <td className="px-2 py-1 text-right">
                                      {l.estado === 'En obra' && (
                                        <div className="flex gap-2 justify-end items-center">
                                          <button onClick={() => devolverEquipo(l)} className="text-xs text-green-600 hover:underline font-semibold">Devolver</button>
                                          <label className="text-xs text-purple-600 flex items-center gap-1 cursor-pointer">
                                            <input type="checkbox"
                                              checked={seleccionRefac.some(s => s.id === l.id)}
                                              onChange={() => setSeleccionRefac(seleccionRefac.some(s => s.id === l.id) ? seleccionRefac.filter(s => s.id !== l.id) : [...seleccionRefac, l])} />
                                            Refacturar
                                          </label>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {seleccionRefac.filter(s => s.contrato_id === c.id).length > 0 && (
                            <div className="flex justify-end mt-2">
                              <button onClick={() => iniciarRefacturacion(c)}
                                className="px-4 py-1.5 bg-[#5B21B6] text-white text-xs font-bold rounded-lg hover:opacity-90">
                                Refacturar seleccionados ({seleccionRefac.filter(s => s.contrato_id === c.id).length})
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {firmandoFactura && (
        <PanelFirma
          titulo="Firma del cliente"
          onCancelar={() => setFirmandoFactura(null)}
          onGuardar={async (dataURL) => {
            const { error } = await supabase.from('contratos').update({ firma: dataURL }).eq('id', firmandoFactura)
            if (error) { alert('Error: ' + error.message); return }
            setFirmandoFactura(null)
            await cargarDatos()
          }}
        />
      )}
    </div>
  )
}

export default Facturas