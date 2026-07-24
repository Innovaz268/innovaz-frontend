function Layout({ user, onLogout, moduloActivo, onModulo, children }) {
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
  ]

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold text-[#185FA5]">⚙️ INNOVAZ ERP</span>
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