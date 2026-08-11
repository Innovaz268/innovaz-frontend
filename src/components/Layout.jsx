function Layout({ user, empresa, esSuperUsuario, listaEmpresas = [], onCambiarEmpresa, onLogout, moduloActivo, onModulo, children }) {
  const mods = empresa?.modulos || []
  const tieneAlquiler = mods.includes('alquiler')
  const tieneMuebles = mods.includes('muebles')

  const modulos = [
    // Permanentes
    { id: 'dashboard', label: '📊 Resumen' },
    // Flujo: aparece si tiene alguna línea de negocio
    ...(tieneAlquiler || tieneMuebles ? [{ id: 'flujo', label: '⚙️ Flujo' }] : []),
    // Módulo Alquiler
    ...(tieneAlquiler ? [
      { id: 'contratos', label: '📄 Facturas' },
      { id: 'cotizaciones', label: '📝 Cotizaciones' },
      { id: 'equipos', label: '🔧 Equipos' },
    ] : []),
    // Módulo Muebles
    ...(tieneMuebles ? [{ id: 'muebles', label: '🪵 Diseño' }] : []),
    // Permanentes contables
    { id: 'caja', label: '💳 Caja' },
    { id: 'clientes', label: '👥 Clientes' },
    { id: 'contabilidad', label: '📒 Contabilidad' },
    { id: 'informes', label: '📊 Informes' },
    // Administración
    ...(user?.email === 'admin@innovaz.com' ? [{ id: 'supervisor', label: '🛠️ Supervisor' }] : []),
    ...(esSuperUsuario ? [{ id: 'empresas', label: '🏢 Empresas' }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      <div className="px-4 py-3 flex items-center justify-between shadow-sm"
        style={{ background: `linear-gradient(to right, ${empresa?.color || '#185FA5'}, ${empresa?.color || '#185FA5'}dd)` }}>
        <div className="flex items-center gap-2">
          {esSuperUsuario && listaEmpresas.length > 0 ? (
            <select value={empresa?.id || ''} onChange={e => onCambiarEmpresa(e.target.value)}
              className="text-lg font-bold text-[#185FA5] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#185FA5] bg-white">
              {listaEmpresas.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
            </select>
          ) : (
            <span className="text-lg font-bold text-[#185FA5]">{empresa?.nombre || 'ERP'}</span>
          )}
          {esSuperUsuario && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">Super usuario</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/90">{user?.email}</span>
          <button onClick={onLogout} className="text-xs px-3 py-1.5 border border-white/30 rounded-lg text-white hover:bg-white/10 transition">
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-4 flex gap-1 overflow-x-auto">
        {modulos.map(mod => (
          <button key={mod.id} onClick={() => onModulo(mod.id)}
            className={`px-3 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors
              ${moduloActivo === mod.id
                ? 'text-[#185FA5] border-[#185FA5]'
                : 'text-gray-500 border-transparent hover:text-[#185FA5] hover:border-[#185FA5]'
              }`}>
            {mod.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

export default Layout