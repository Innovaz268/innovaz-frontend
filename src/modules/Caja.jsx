import { useState, useEffect } from 'react'
import { supabase, empresaActiva } from '../supabase'
import { siguienteConsecutivo } from '../utils/consecutivo'
import { asientoPago } from '../utils/asientosAuto'
import { imprimirConMembrete } from '../utils/membrete'
import PanelFirma from '../components/PanelFirma'
import { registrarAuditoria } from '../utils/auditoria'

function Caja() {
  const [pagos, setPagos] = useState([])
  const [contratos, setContratos] = useState([])
  const [facturasMuebles, setFacturasMuebles] = useState([])
  const [terceros, setTerceros] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [firmandoPago, setFirmandoPago] = useState(null)
  const [form, setForm] = useState({
    contrato_id: '', fecha: new Date().toISOString().slice(0,10),
    monto: '', metodo: 'Efectivo', concepto: 'Abono factura'
  })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: pgs }, { data: cts }, { data: mfs }, { data: trcs }] = await Promise.all([
      supabase.from('caja').select('*').order('created_at', { ascending: false }),
      supabase.from('contratos').select('id, id_doc, cliente_id, total, anticipo, fecha_salida').eq('estado', 'Activo'),
      supabase.from('muebles_facturas').select('*').eq('estado', 'Activa'),
      supabase.from('terceros').select('id, nombre').order('nombre'),
    ])
    setPagos(pgs || [])
    setContratos(cts || [])
    setFacturasMuebles(mfs || [])
    setTerceros(trcs || [])
    setLoading(false)
  }

  async function guardarPago() {
    if (!form.contrato_id) { setMensaje('Seleccione una factura'); return }
    if (!form.monto || parseFloat(form.monto) <= 0) { setMensaje('Ingrese un monto válido'); return }
    setGuardando(true)
    setMensaje('')
    const codigo = await siguienteConsecutivo('RC')

    // Interpretar el prefijo: 'c:' = alquiler (contratos), 'mf:' = muebles
    const esMueble = form.contrato_id.startsWith('mf:')
    const idReal = form.contrato_id.slice(form.contrato_id.indexOf(':') + 1)

    let clienteId = ''
    const datosRC = {
      fecha: form.fecha,
      monto: form.monto,
      metodo: form.metodo,
      concepto: form.concepto,
      id_doc: codigo,
      empresa_id: empresaActiva(),
    }
    if (esMueble) {
      datosRC.muebles_factura_id = idReal
      clienteId = facturasMuebles.find(f => f.id === idReal)?.cliente_id || ''
    } else {
      datosRC.contrato_id = idReal
      clienteId = contratos.find(c => c.id === idReal)?.cliente_id || ''
    }

    const { error } = await supabase.from('caja').insert([datosRC])
    if (error) { setMensaje('Error: ' + error.message); setGuardando(false); return }
    await asientoPago({ ...datosRC }, clienteId)
    await registrarAuditoria('registró pago', 'Recibo', codigo, 'Monto: ' + form.monto)
    setMensaje('✓ Pago registrado correctamente')
    setForm({ contrato_id: '', fecha: new Date().toISOString().slice(0,10), monto: '', metodo: 'Efectivo', concepto: 'Abono factura' })
    setMostrarForm(false)
    await cargarDatos()
    setGuardando(false)
  }

  function imprimirRecibo(p) {
    const contrato = contratos.find(c => c.id === p.contrato_id)
    const facMueble = facturasMuebles.find(f => f.id === p.muebles_factura_id)
    const clienteId = contrato?.cliente_id || facMueble?.cliente_id
    const trc = terceros.find(t => t.id === clienteId)
    const docRef = contrato?.id_doc || facMueble?.id_doc || '—'
    const contenido = `
      <table style="margin-bottom:20px">
        <tr><td class="tot" style="width:35%">Recibo N°</td><td>${p.id_doc || '—'}</td></tr>
        <tr><td class="tot">Fecha</td><td>${p.fecha || '—'}</td></tr>
        <tr><td class="tot">Recibí de</td><td>${trc?.nombre || '—'}</td></tr>
        <tr><td class="tot">Por concepto de</td><td>${p.concepto || '—'} (Factura ${docRef})</td></tr>
        <tr><td class="tot">Forma de pago</td><td>${p.metodo || '—'}</td></tr>
        <tr><td class="tot">Valor recibido</td><td style="font-size:16px;font-weight:bold">${fmt(p.monto)}</td></tr>
      </table>
      ${p.firma ? `<div style="text-align:center;margin-top:50px"><img src="${p.firma}" style="height:50px"><div style="border-top:1px solid #333;width:200px;margin:4px auto 0;padding-top:4px;font-size:12px">Recibí conforme</div></div>` : `<div style="text-align:center;margin-top:70px"><div style="border-top:1px solid #333;width:200px;margin:0 auto;padding-top:4px;font-size:12px">Recibí conforme</div></div>`}`
    imprimirConMembrete('Recibo de Caja', contenido, '#27500A')
  }

  async function eliminarPago(id) {
    if (!window.confirm('¿Eliminar este pago? Se borrará también su asiento contable. Esta acción no se puede deshacer.')) return

    // 1. Traer el pago para su id_doc (RC-...)
    const { data: pago } = await supabase.from('caja').select('id_doc').eq('id', id).single()

    // 2. Borrar el asiento del pago + sus líneas (por documento_id = id_doc del recibo)
    if (pago?.id_doc) {
      const { data: asientos } = await supabase.from('asientos_contables').select('id').eq('documento_id', pago.id_doc)
      for (const a of (asientos || [])) {
        await supabase.from('asientos_lineas').delete().eq('asiento_id', a.id)
        await supabase.from('asientos_contables').delete().eq('id', a.id)
      }
    }

    // 3. Borrar el pago
    await supabase.from('caja').delete().eq('id', id)

    await registrarAuditoria('eliminó', 'Recibo', pago?.id_doc || '')
    await cargarDatos()
  }

  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')

  // Calcular saldo por contrato
  const saldoPorContrato = (contratoId) => {
    const contrato = contratos.find(c => c.id === contratoId)
    if (!contrato) return 0
    const abonos = pagos.filter(p => p.contrato_id === contratoId).reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    return (contrato.total || 0) - (contrato.anticipo || 0) - abonos
  }
  // Saldo de una factura de muebles
  const saldoFacturaMueble = (facturaId) => {
    const f = facturasMuebles.find(x => x.id === facturaId)
    if (!f) return 0
    const abonos = pagos.filter(p => p.muebles_factura_id === facturaId).reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    return (f.total || 0) - (f.anticipo || 0) - abonos
  }

  const totalIngresos = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 mt-2">
        <h2 className="text-xl font-bold text-[#185FA5]">💳 Caja — Registro de Pagos</h2>
        <button onClick={() => { setMostrarForm(!mostrarForm); setMensaje('') }}
          className="px-4 py-2 btn-empresa text-white text-xs font-bold rounded-lg hover:opacity-90">
          {mostrarForm ? '✕ Cancelar' : '+ Registrar pago'}
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Total recaudado</p>
          <p className="text-2xl font-bold text-[#27500A]">{fmt(totalIngresos)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Pagos registrados</p>
          <p className="text-2xl font-bold text-[#185FA5]">{pagos.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Facturas activas</p>
          <p className="text-2xl font-bold text-[#5B21B6]">{contratos.length}</p>
        </div>
      </div>

      {mensaje && (
        <div className={`mb-3 p-3 rounded-lg text-sm font-semibold ${mensaje.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {mensaje}
        </div>
      )}

      {/* Formulario */}
      {mostrarForm && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Registrar nuevo pago</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Factura *</label>
              <select value={form.contrato_id} onChange={e => setForm({...form, contrato_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option value="">— Seleccionar factura —</option>
                <optgroup label="🔧 Alquiler">
                  {contratos.filter(c => saldoPorContrato(c.id) > 0).map(c => {
                    const trc = terceros.find(t => t.id === c.cliente_id)
                    const saldo = saldoPorContrato(c.id)
                    return <option key={c.id} value={'c:' + c.id}>{c.id_doc || '—'} · {trc?.nombre || c.cliente_id} — Saldo: {fmt(saldo)}</option>
                  })}
                </optgroup>
                <optgroup label="🪵 Muebles">
                  {facturasMuebles.filter(f => saldoFacturaMueble(f.id) > 0).map(f => {
                    const trc = terceros.find(t => t.id === f.cliente_id)
                    const saldo = saldoFacturaMueble(f.id)
                    return <option key={f.id} value={'mf:' + f.id}>{f.id_doc || '—'} · {trc?.nombre || f.cliente_id} — Saldo: {fmt(saldo)}</option>
                  })}
                </optgroup>
              </select>
              {form.contrato_id && (
                <div className="mt-1 text-xs text-gray-500">
                  Saldo pendiente: <span className="font-bold text-red-600">{fmt(form.contrato_id.startsWith('mf:') ? saldoFacturaMueble(form.contrato_id.slice(3)) : saldoPorContrato(form.contrato_id.slice(2)))}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Monto *</label>
              <input type="number" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Método de pago</label>
              <select value={form.metodo} onChange={e => setForm({...form, metodo: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Nequi</option>
                <option>Daviplata</option>
                <option>Cheque</option>
                <option>Tarjeta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Concepto</label>
              <select value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option>Abono factura</option>
                <option>Pago total</option>
                <option>Anticipo</option>
                <option>Otro</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={guardarPago} disabled={guardando}
              className="px-6 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
              {guardando ? 'Guardando...' : '✓ Registrar pago'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de pagos */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-700">📋 Historial de pagos</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
        ) : pagos.length === 0 ? (
          <div className="p-8 text-center text-gray-300 text-sm">No hay pagos registrados aún</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">No.</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Cliente</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Fecha</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Concepto</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Método</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Monto</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pagos.map(p => {
                const contrato = contratos.find(c => c.id === p.contrato_id)
                const trc = terceros.find(t => t.id === contrato?.cliente_id)
                return (
                  <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-[#185FA5] font-bold">{p.id_doc || '---'}</td>
                    <td className="px-4 py-2 font-semibold text-xs">{trc?.nombre || p.contrato_id}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{p.fecha || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{p.concepto}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700">{p.metodo}</span>
                    </td>
                    <td className="px-4 py-2 text-xs font-bold text-[#27500A]">{fmt(p.monto)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setFirmandoPago(p.id)} className="text-xs text-[#5B21B6] hover:underline mr-2">{p.firma ? '✓ Firmado' : '✍️ Firmar'}</button>
                      <button onClick={() => imprimirRecibo(p)} className="text-xs text-[#185FA5] hover:underline mr-2">🖨️ Recibo</button>
                      <button onClick={() => eliminarPago(p.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {firmandoPago && (
        <PanelFirma
          titulo="Firma de quien recibe el pago"
          onCancelar={() => setFirmandoPago(null)}
          onGuardar={async (dataURL) => {
            const { error } = await supabase.from('caja').update({ firma: dataURL }).eq('id', firmandoPago)
            if (error) { alert('Error: ' + error.message); return }
            setFirmandoPago(null)
            await cargarDatos()
          }}
        />
      )}
    </div>
  )
}

export default Caja