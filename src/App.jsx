import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Layout from './components/Layout'
import Dashboard from './modules/Dashboard'
import Clientes from './modules/Clientes'
import Equipos from './modules/Equipos'
import Cotizaciones from './modules/Cotizaciones'
import Facturas from './modules/Facturas'
import Caja from './modules/Caja'
import Flujo from './modules/Flujo'
import Muebles from './modules/Muebles'
import Contabilidad from './modules/Contabilidad'
import Informes from './modules/Informes'
import Supervisor from './modules/Supervisor'
import Empresas from './modules/Empresas'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const [modulo, setModulo] = useState('dashboard')
  const [empresa, setEmpresa] = useState(null)
  const [esSuperUsuario, setEsSuperUsuario] = useState(false)
  const [cargandoEmpresa, setCargandoEmpresa] = useState(true)
  const [listaEmpresas, setListaEmpresas] = useState([])

  useEffect(() => {
    let usuarioActual = null
    supabase.auth.getSession().then(({ data: { session } }) => {
      usuarioActual = session?.user?.id ?? null
      setUser(session?.user ?? null)
      if (session?.user) cargarEmpresa(session.user.id)
      else setCargandoEmpresa(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nuevoId = session?.user?.id ?? null
      // Solo actuar si el usuario REALMENTE cambió
      if (nuevoId === usuarioActual) return
      usuarioActual = nuevoId
      setUser(session?.user ?? null)
      if (session?.user) cargarEmpresa(session.user.id)
      else { setEmpresa(null); setEsSuperUsuario(false); setCargandoEmpresa(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function cargarEmpresa(userId) {
    setCargandoEmpresa(true)
    // ¿Es super usuario?
    const { data: sup } = await supabase.from('super_usuarios').select('user_id').eq('user_id', userId).maybeSingle()
    const esSuper = !!sup
    setEsSuperUsuario(esSuper)
    if (esSuper) {
      const { data: todas } = await supabase.from('empresas').select('*').order('nombre')
      setListaEmpresas(todas || [])
      // La empresa activa del super usuario viene de super_empresa_activa (la que usa la RLS)
      const { data: activa } = await supabase.from('super_empresa_activa').select('empresa_id').eq('user_id', userId).maybeSingle()
      if (activa?.empresa_id) {
        const empActiva = (todas || []).find(e => e.id === activa.empresa_id)
        if (empActiva) {
          setEmpresa(empActiva)
          localStorage.setItem('empresa_id', empActiva.id)
          setCargandoEmpresa(false)
          return
        }
      }
    }
    // Buscar la empresa del usuario
    const { data: ue } = await supabase.from('usuarios_empresa').select('empresa_id').eq('user_id', userId).maybeSingle()
    if (ue?.empresa_id) {
      const { data: emp } = await supabase.from('empresas').select('*').eq('id', ue.empresa_id).maybeSingle()
      setEmpresa(emp || null)
      if (emp) localStorage.setItem('empresa_id', emp.id)
    } else if (esSuper) {
      // Super usuario sin empresa asignada: toma la primera (luego podrá elegir)
      const { data: emp } = await supabase.from('empresas').select('*').order('created_at').limit(1).maybeSingle()
      setEmpresa(emp || null)
    }
    setCargandoEmpresa(false)
  }
  async function cambiarEmpresa(empresaId) {
    const emp = listaEmpresas.find(e => e.id === empresaId)
    if (!emp) return
    // Si es super usuario, actualizar su empresa activa (para la RLS) ANTES de recargar
    if (esSuperUsuario) {
      const { error } = await supabase.from('super_empresa_activa').upsert({ user_id: user.id, empresa_id: empresaId }, { onConflict: 'user_id' })
      if (error) { alert('Error cambiando de empresa: ' + error.message); return }
    }
    localStorage.setItem('empresa_id', emp.id)
    // Pequeña espera para asegurar que la base registró el cambio antes de recargar
    await new Promise(r => setTimeout(r, 300))
    window.location.reload()
  }

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Correo o contraseña incorrectos')
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (user) {
    if (cargandoEmpresa) {
      return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Cargando empresa...</div>
    }
    if (!empresa) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-gray-600 text-sm">Tu usuario no está asignado a ninguna empresa.</p>
          <button onClick={handleLogout} className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg">Cerrar sesión</button>
        </div>
      )
    }
    return (
      <Layout user={user} empresa={empresa} esSuperUsuario={esSuperUsuario} listaEmpresas={listaEmpresas} onCambiarEmpresa={cambiarEmpresa} onLogout={handleLogout} moduloActivo={modulo} onModulo={setModulo}>
        {modulo === 'dashboard'    && <Dashboard />}
        {modulo === 'clientes'     && <Clientes />}
        {modulo === 'equipos'      && <Equipos />}
        {modulo === 'flujo' && <Flujo />}
        {modulo === 'contratos' && <Facturas />}
        {modulo === 'cotizaciones' && <Cotizaciones />}
        {modulo === 'caja' && <Caja />}
        {modulo === 'muebles' && <Muebles />}
        {modulo === 'contabilidad' && <Contabilidad />}
        {modulo === 'informes' && <Informes />}
        {modulo === 'empresas' && <Empresas />}
      </Layout>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0C447C] via-[#185FA5] to-[#5B21B6] flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl p-10 w-full max-w-sm shadow-2xl">
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-[#185FA5]">⚙️ INNOVAZ ERP</h1>
          <p className="text-sm text-gray-400 mt-1">Sistema de Gestión Empresarial</p>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Correo electrónico</label>
          <input type="email" placeholder="admin@innovaz.com" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
        </div>
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Contraseña</label>
          <input type="password" placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
        </div>
        <button onClick={handleLogin} disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-[#185FA5] to-[#5B21B6] text-white font-bold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
          {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>
      </div>
    </div>
  )
}

export default App