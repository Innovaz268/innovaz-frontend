import { useState, useEffect } from 'react'
import { supabase, empresaActiva } from '../supabase'
import { moverKardex } from '../utils/kardexAuto'
import { asientoCompraEquipo } from '../utils/asientosAuto'

function Equipos() {
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [form, setForm] = useState({ nombre: '', categoria: '', tarifa: '', stock: '', costo_compra: '', proveedor: '', forma_pago: 'Contado', inventario_inicial: false })

  useEffect(() => { cargarEquipos() }, [])

  async function cargarEquipos() {
    setLoading(true)
    const { data, error } = await supabase.from('equipos').select('*').order('nombre')
    if (error) setMensaje('Error cargando: ' + error.message)
    setEquipos(data || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setEditandoId(null)
    setForm({ nombre: '', categoria: '', tarifa: '', stock: '', costo_compra: '', proveedor: '' })
    setMostrarForm(true)
    setMensaje('')
  }

  function abrirEditar(e) {
    setEditandoId(e.id)
    setForm({ nombre: e.nombre || '', categoria: e.categoria || '', tarifa: e.tarifa || '', stock: e.stock || '', costo_compra: e.costo_compra || '', proveedor: e.proveedor || '' })
    setMostrarForm(true)
    setMensaje('')
  }

  async function guardarEquipo() {
    if (!form.nombre.trim()) { setMensaje('El nombre es obligatorio'); return }
    setGuardando(true)
    setMensaje('')
    const { forma_pago, inventario_inicial, ...formSinPago } = form
    const datos = { ...formSinPago, tarifa: parseFloat(form.tarifa) || 0, stock: editandoId ? (parseInt(form.stock) || 0) : 0, costo_compra: parseFloat(form.costo_compra) || 0, empresa_id: empresaActiva() }
    let error
    if (editandoId) {
      const res = await supabase.from('equipos').update(datos).eq('id', editandoId)
      error = res.error
    } else {
      const res = await supabase.from('equipos').insert([datos]).select().single()
      error = res.error
      if (!error && res.data && (parseInt(form.stock) || 0) > 0) {
        await moverKardex({
          equipo_id: res.data.id,
          tipo: 'Entrada',
          cantidad: parseInt(form.stock) || 0,
          observacion: form.inventario_inicial ? 'Inventario inicial' : 'Compra inicial de equipo'
        })
        if (!form.inventario_inicial && (parseFloat(form.costo_compra) || 0) > 0) {
          await asientoCompraEquipo(res.data, form.forma_pago)
        }
      }
    }
    if (error) { setMensaje('Error: ' + error.message); setGuardando(false); return }
    setMensaje(editandoId ? '✓ Actualizado' : '✓ Guardado')
    setForm({ nombre: '', categoria: '', tarifa: '', stock: '', costo_compra: '', proveedor: '' })
    setMostrarForm(false)
    setEditandoId(null)
    await cargarEquipos()
    setGuardando(false)
  }

  async function eliminarEquipo(id) {
    if (!window.confirm('¿Eliminar este equipo?')) return
    await supabase.from('equipos').delete().eq('id', id)
    await cargarEquipos()
  }

  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')

  const filtrados = equipos.filter(e =>
    e.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.categoria?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 mt-2">
        <h2 className="text-xl font-bold text-[#185FA5]">🔧 Equipos y Maquinaria</h2>
        <button onClick={mostrarForm ? () => setMostrarForm(false) : abrirNuevo}
          className="px-4 py-2 bg-gradient-to-r from-[#185FA5] to-[#5B21B6] text-white text-xs font-bold rounded-lg hover:opacity-90">
          {mostrarForm ? '✕ Cancelar' : '+ Nuevo'}
        </button>
      </div>

      {mensaje && (
        <div className={`mb-3 p-3 rounded-lg text-sm font-semibold ${mensaje.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {mensaje}
        </div>
      )}

      {mostrarForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">
            {editandoId ? '✏️ Editar equipo' : 'Nuevo equipo'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="Ej: Andamio Amarillo" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Categoría</label>
              <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option value="">— Seleccionar —</option>
                <option>Andamiaje</option>
                <option>Compactación</option>
                <option>Mezclado</option>
                <option>Elevación</option>
                <option>Herramienta menor</option>
                <option>Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tarifa diaria ($)</label>
              <input type="number" value={form.tarifa} onChange={e => setForm({...form, tarifa: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Stock disponible</label>
              <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Costo de compra ($)</label>
              <input type="number" value={form.costo_compra} onChange={e => setForm({...form, costo_compra: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Proveedor</label>
              <input value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="Nombre del proveedor" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Forma de pago</label>
              <select value={form.forma_pago} onChange={e => setForm({...form, forma_pago: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option value="Contado">Contado (Caja)</option>
                <option value="Transferencia">Transferencia (Bancos)</option>
                <option value="Credito">Crédito con proveedor</option>
                <option value="Aporte">Aporte de socio</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <input type="checkbox" checked={form.inventario_inicial}
                  onChange={e => setForm({...form, inventario_inicial: e.target.checked})} />
                <span className="text-xs text-amber-700">
                  <strong>Inventario inicial</strong> — carga el stock sin generar asiento de compra (el valor se registra aparte como aporte de capital)
                </span>
              </label>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={guardarEquipo} disabled={guardando}
              className="px-6 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
              {guardando ? 'Guardando...' : '✓ Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-3">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5] bg-white"
          placeholder="🔍 Buscar por nombre o categoría..." />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-8 text-center text-gray-300 text-sm">
            {busqueda ? 'Sin resultados' : 'No hay equipos aún — crea el primero'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Nombre</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Categoría</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Tarifa/día</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Stock</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Costo compra</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(e => (
                <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-xs">{e.nombre}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-50 text-purple-700">
                      {e.categoria || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs font-semibold text-[#185FA5]">{fmt(e.tarifa)}</td>
                  <td className="px-4 py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${e.stock > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {e.stock || 0} uds
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{fmt(e.costo_compra)}</td>
                  <td className="px-4 py-2 text-right flex gap-2 justify-end">
                    <button onClick={() => abrirEditar(e)} className="text-xs text-blue-400 hover:text-blue-600">✏️</button>
                    <button onClick={() => eliminarEquipo(e.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Equipos