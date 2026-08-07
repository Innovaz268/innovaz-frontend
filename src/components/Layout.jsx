function Layout({ user, empresa, esSuperUsuario, onLogout, moduloActivo, onModulo, children }) {
  const modulos = [
    { id: 'dashboard', label: '📊 Resumen' },
    { id: 'flujo', label: '⚙️ Flujo' },
    { id: 'contratos', label: '📄 Facturas' },
    { id: 'cotizaciones', label: '📝 Cotizaciones' },
    { id: 'caja', label: '💳 Caja' },
    { id: 'equipos', label: '🔧 Equipos' },
    { id: 'clientes', label: '👥 Clientes' },
    { id: 'contabilidad', label: '📒 Contabilidad' },
    { id: 'muebles', label: '🪵 Diseño' },
    { id: 'informes', label: '📊 Informes' },
    ...(user?.email === 'admin@innovaz.com' ? [{ id: 'supervisor', label: '🛠️ Supervisor' }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#185FA5]">{empresa?.nombre || 'ERP'}</span>
          {esSuperUsuario && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">Super usuario</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={onLogout} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
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