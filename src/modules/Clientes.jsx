import { useState, useEffect } from 'react'
import { supabase, empresaActiva } from '../supabase'

function Clientes() {
  const [terceros, setTerceros] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState({ nombre: '', clase: 'Cliente', tel: '', dir: '', correo: '', nit: '', ciudad: '', pais: 'Colombia' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => { cargarTerceros() }, [])

  async function cargarTerceros() {
    setLoading(true)
    const { data, error } = await supabase.from('terceros').select('*').order('nombre')
    if (error) setMensaje('Error cargando: ' + error.message)
    setTerceros(data || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setEditandoId(null)
    setForm({ nombre: '', clase: 'Cliente', tel: '', dir: '', correo: '', nit: '', ciudad: '', pais: 'Colombia' })
    setMostrarForm(true)
    setMensaje('')
  }

  function abrirEditar(t) {
    setEditandoId(t.id)
    setForm({ nombre: t.nombre || '', clase: t.clase || 'Cliente', tel: t.tel || '', dir: t.dir || '', correo: t.correo || '', nit: t.nit || '', ciudad: t.ciudad || '', pais: t.pais || 'Colombia' })
    setMostrarForm(true)
    setMensaje('')
  }

  async function guardarTercero() {
    if (!form.nombre.trim()) { setMensaje('El nombre es obligatorio'); return }
    setGuardando(true)
    setMensaje('')
    let error
    if (editandoId) {
      const res = await supabase.from('terceros').update(form).eq('id', editandoId)
      error = res.error
    } else {
      const res = await supabase.from('terceros').insert([{ ...form, empresa_id: empresaActiva() }])
      error = res.error
    }
    if (error) { setMensaje('Error guardando: ' + error.message); setGuardando(false); return }
    setMensaje(editandoId ? '✓ Actualizado correctamente' : '✓ Guardado correctamente')
    setForm({ nombre: '', clase: 'Cliente', tel: '', dir: '', correo: '', nit: '', ciudad: '', pais: 'Colombia' })
    setMostrarForm(false)
    setEditandoId(null)
    await cargarTerceros()
    setGuardando(false)
  }

  async function eliminarTercero(id) {
    if (!window.confirm('¿Eliminar este registro?')) return
    await supabase.from('terceros').delete().eq('id', id)
    await cargarTerceros()
  }

  const filtrados = terceros.filter(t =>
    t.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    t.nit?.includes(busqueda) ||
    t.tel?.includes(busqueda)
  )

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 mt-2">
        <h2 className="text-xl font-bold text-[#185FA5]">👥 Clientes y Terceros</h2>
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
            {editandoId ? '✏️ Editar cliente / tercero' : 'Nuevo cliente / tercero'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="Nombre completo" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
              <select value={form.clase} onChange={e => setForm({...form, clase: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option>Cliente</option>
                <option>Proveedor</option>
                <option>Empleado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">NIT / Cédula</label>
              <input value={form.nit} onChange={e => setForm({...form, nit: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="123456789" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Teléfono</label>
              <input value={form.tel} onChange={e => setForm({...form, tel: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="+57 300 000 0000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Correo</label>
              <input value={form.correo} onChange={e => setForm({...form, correo: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="correo@email.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Dirección</label>
              <input value={form.dir} onChange={e => setForm({...form, dir: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="Calle 123 # 45-67" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Ciudad</label>
              <input value={form.ciudad} onChange={e => setForm({...form, ciudad: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                placeholder="Bogotá" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">País</label>
              <select value={form.pais} onChange={e => setForm({...form, pais: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                <option>Colombia</option>
                <option>Costa Rica</option>
                <option>Venezuela</option>
                <option>Ecuador</option>
                <option>Panamá</option>
                <option>Otro</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={guardarTercero} disabled={guardando}
              className="px-6 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
              {guardando ? 'Guardando...' : '✓ Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-3">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5] bg-white"
          placeholder="🔍 Buscar por nombre, NIT o teléfono..." />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-8 text-center text-gray-300 text-sm">
            {busqueda ? 'Sin resultados' : 'No hay clientes aún — crea el primero'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Nombre</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Tipo</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">NIT/Cédula</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Teléfono</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Ciudad</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">País</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(t => (
                <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-xs">{t.nombre}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                      ${t.clase === 'Cliente' ? 'bg-blue-50 text-blue-700' :
                        t.clase === 'Proveedor' ? 'bg-amber-50 text-amber-700' :
                        'bg-gray-100 text-gray-600'}`}>
                      {t.clase}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{t.nit || '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{t.tel || '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{t.ciudad || '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{t.pais || '—'}</td>
                  <td className="px-4 py-2 text-right flex gap-2 justify-end">
                    <button onClick={() => abrirEditar(t)}
                      className="text-xs text-blue-400 hover:text-blue-600">✏️</button>
                    <button onClick={() => eliminarTercero(t.id)}
                      className="text-xs text-red-400 hover:text-red-600">✕</button>
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

export default Clientes