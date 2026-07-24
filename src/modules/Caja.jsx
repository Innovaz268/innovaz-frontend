import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { siguienteConsecutivo } from '../utils/consecutivo'
import { asientoPago } from '../utils/asientosAuto'

function Caja() {
  const [pagos, setPagos] = useState([])
  const [contratos, setContratos] = useState([])
  const [terceros, setTerceros] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    contrato_id: '', fecha: new Date().toISOString().slice(0,10),
    monto: '', metodo: 'Efectivo', concepto: 'Abono factura'
  })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: pgs }, { data: cts }, { data: trcs }] = await Promise.all([
      supabase.from('caja').select('*').order('created_at', { ascending: false }),
      supabase.from('contratos').select('id, cliente_id, total, anticipo, fecha_salida').eq('estado', 'Activo'),
      supabase.from('terceros').select('id, nombre').order('nombre'),
    ])
    setPagos(pgs || [])
    setContratos(cts || [])
    setTerceros(trcs || [])
    setLoading(false)
  }

  async function guardarPago() {
    if (!form.contrato_id) { setMensaje('Seleccione una factura'); return }
    if (!form.monto || parseFloat(form.monto) <= 0) { setMensaje('Ingrese un monto válido'); return }
    setGuardando(true)
    setMensaje('')
    const codigo = await siguienteConsecutivo('RC')
    const datosRC = { ...form, id_doc: codigo }
    const { error } = await supabase.from('caja').insert([datosRC])
    if (error) { setMensaje('Error: ' + error.message); setGuardando(false); return }
    const contrato = contratos.find(c => c.id === form.contrato_id)
    await asientoPago({ ...datosRC }, contrato?.cliente_id || '')
    setMensaje('✓ Pago registrado correctamente')
    setForm({ contrato_id: '', fecha: new Date().toISOString().slice(0,10), monto: '', metodo: 'Efectivo', concepto: 'Abono factura' })
    setMostrarForm(false)
    await cargarDatos()
    setGuardando(false)
  }

  async function eliminarPago(id) {
    if (!window.confirm('¿Eliminar este pago?')) return
    await supabase.from('caja').delete().eq('id', id)
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

  const totalIngresos = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 mt-2">
        <h2 className="text-xl font-bold text-[#185FA5]">💳 Caja — Registro de Pagos</h2>
        <button onClick={() => { setMostrarForm(!mostrarForm); setMensaje('') }}
          className="px-4 py-2 bg-gradient-to-r from-[#185FA5] to-[#5B21B6] text-white text-xs font-bold rounded-lg hover:opacity-90">
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Registrar nuevo pago</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Factura *</label>
              <select value={form.contrato_id} onChange={e => setForm({...form, contrato_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option value="">— Seleccionar factura —</option>
                {contratos.map(c => {
                  const trc = terceros.find(t => t.id === c.cliente_id)
                  const saldo = saldoPorContrato(c.id)
                  return <option key={c.id} value={c.id}>{trc?.nombre || c.cliente_id} — Saldo: {fmt(saldo)}</option>
                })}
              </select>
              {form.contrato_id && (
                <div className="mt-1 text-xs text-gray-500">
                  Saldo pendiente: <span className="font-bold text-red-600">{fmt(saldoPorContrato(form.contrato_id))}</span>
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
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
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
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => eliminarPago(p.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
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

export default Caja