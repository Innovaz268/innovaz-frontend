import { useState, useEffect } from 'react'
import { supabase, empresaActiva } from '../supabase'

const MODULOS_DISPONIBLES = [
  { id: 'dashboard', label: '📊 Resumen' },
  { id: 'flujo', label: '⚙️ Flujo' },
  { id: 'contratos', label: '📄 Facturas' },
  { id: 'cotizaciones', label: '📝 Cotizaciones' },
  { id: 'equipos', label: '🔧 Equipos' },
  { id: 'muebles', label: '🪵 Diseño' },
  { id: 'caja', label: '💳 Caja' },
  { id: 'clientes', label: '👥 Clientes' },
  { id: 'contabilidad', label: '📒 Contabilidad' },
  { id: 'informes', label: '📊 Informes' },
]

const FUNCTION_URL = 'https://kdfoptwfvqyexhcgllyt.supabase.co/functions/v1/crear-usuario'

function Usuarios({ empresa, esSuperUsuario }) {
  const [usuarios, setUsuarios] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', modulos: [] })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => { cargarUsuarios() }, [])

  async function cargarUsuarios() {
    const { data } = await supabase
      .from('usuarios_empresa')
      .select('id, user_id, rol, modulos_permitidos')
      .eq('empresa_id', empresaActiva())
    setUsuarios(data || [])
  }

  function toggleModulo(id) {
    setForm(f => ({
      ...f,
      modulos: f.modulos.includes(id)
        ? f.modulos.filter(m => m !== id)
        : [...f.modulos, id]
    }))
  }

  async function crearUsuario() {
    if (!form.email || !form.password) { setMensaje('Ingrese correo y contraseña'); return }
    if (form.password.length < 6) { setMensaje('La contraseña debe tener al menos 6 caracteres'); return }
    setGuardando(true)
    setMensaje('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          empresa_id: empresaActiva(),
          rol: 'usuario',
          modulos_permitidos: form.modulos.length > 0 ? form.modulos : null
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setMensaje('Error: ' + (data.error || 'No se pudo crear'))
        setGuardando(false)
        return
      }
      setMensaje('✓ Usuario creado correctamente')
      setForm({ email: '', password: '', modulos: [] })
      setMostrarForm(false)
      await cargarUsuarios()
    } catch (e) {
      setMensaje('Error: ' + String(e))
    }
    setGuardando(false)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">👥 Usuarios de {empresa?.nombre || 'la empresa'}</h2>
          <p className="text-xs text-gray-400">Gestione el acceso y los permisos por módulo</p>
        </div>
        <button onClick={() => { setMostrarForm(!mostrarForm); setMensaje('') }}
          style={{ background: 'var(--color-empresa, #185FA5)' }}
          className="px-4 py-2 text-white text-xs font-bold rounded-lg hover:opacity-90">
          {mostrarForm ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      </div>

      {mensaje && (
        <div className={`mb-4 p-3 rounded-lg text-xs ${mensaje.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {mensaje}
        </div>
      )}

      {mostrarForm && (
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Correo *</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="usuario@empresa.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Contraseña *</label>
              <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Mínimo 6 caracteres" />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-500 mb-2">Módulos permitidos (si no marca ninguno, verá todos)</label>
            <div className="grid grid-cols-3 gap-2">
              {MODULOS_DISPONIBLES.map(m => (
                <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.modulos.includes(m.id)} onChange={() => toggleModulo(m.id)} />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <button onClick={crearUsuario} disabled={guardando}
            className="px-6 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
            {guardando ? 'Creando...' : '✓ Crear usuario'}
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-gray-500">Usuario (ID)</th>
              <th className="px-4 py-2 text-left text-gray-500">Rol</th>
              <th className="px-4 py-2 text-left text-gray-500">Módulos permitidos</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-300">Sin usuarios</td></tr>
            ) : usuarios.map(u => (
              <tr key={u.id} className="border-t border-gray-50">
                <td className="px-4 py-2 text-gray-600">{u.user_id?.slice(0, 8)}...</td>
                <td className="px-4 py-2">{u.rol || 'usuario'}</td>
                <td className="px-4 py-2 text-gray-500">
                  {u.modulos_permitidos ? u.modulos_permitidos.join(', ') : 'Todos'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Usuarios