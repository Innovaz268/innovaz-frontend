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

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const [modulo, setModulo] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
  }, [])

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
    return (
      <Layout user={user} onLogout={handleLogout} moduloActivo={modulo} onModulo={setModulo}>
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
        {modulo === 'supervisor' && <Supervisor />}
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