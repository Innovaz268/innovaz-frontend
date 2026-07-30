import { useState } from 'react'
import { supabase } from '../supabase'

// Tablas que se pueden limpiar, agrupadas para claridad visual
const GRUPOS = [
  {
    grupo: 'Movimientos',
    color: 'text-red-600',
    tablas: [
      { tabla: 'asientos_lineas', label: 'Líneas de asientos contables' },
      { tabla: 'asientos_contables', label: 'Asientos contables (encabezados)' },
      { tabla: 'caja', label: 'Movimientos de caja' },
      { tabla: 'kardex', label: 'Movimientos de kardex' },
      { tabla: 'alquiler_lineas', label: 'Líneas de alquiler (control equipos)' },
      { tabla: 'contratos', label: 'Facturas de alquiler' },
      { tabla: 'muebles_costos', label: 'Costos de órdenes de muebles' },
      { tabla: 'muebles_ordenes', label: 'Órdenes de producción de muebles' },
      { tabla: 'muebles_cotizaciones', label: 'Cotizaciones de muebles' },
    ]
  },
  {
    grupo: 'Maestros (cuidado)',
    color: 'text-amber-600',
    tablas: [
      { tabla: 'terceros', label: 'Terceros (clientes/proveedores/socios)' },
      { tabla: 'equipos', label: 'Equipos y maquinaria' },
    ]
  }
]

function Supervisor() {
  const [seleccion, setSeleccion] = useState([])
  const [reiniciarConsec, setReiniciarConsec] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const toggle = tabla => {
    setSeleccion(seleccion.includes(tabla) ? seleccion.filter(t => t !== tabla) : [...seleccion, tabla])
  }

  const todasMovimientos = () => {
    const movs = GRUPOS[0].tablas.map(t => t.tabla)
    const yaEstan = movs.every(m => seleccion.includes(m))
    setSeleccion(yaEstan ? seleccion.filter(t => !movs.includes(t)) : [...new Set([...seleccion, ...movs])])
  }

  async function ejecutarLimpieza() {
    if (seleccion.length === 0 && !reiniciarConsec) { setMensaje('No ha seleccionado nada para limpiar'); return }
    if (confirmacion !== 'BORRAR') { setMensaje('Escriba BORRAR en mayúsculas para confirmar'); return }
    if (!window.confirm(`¿Está SEGURO? Se borrarán ${seleccion.length} tabla(s). Esta acción NO se puede deshacer.`)) return

    setProcesando(true)
    setMensaje('')
    const resultados = []

    // Borrar en el orden dado (las líneas antes que sus encabezados por las llaves foráneas)
    for (const tabla of seleccion) {
      const { error } = await supabase.from(tabla).delete().not('id', 'is', null)
      resultados.push(error ? `❌ ${tabla}: ${error.message}` : `✓ ${tabla} limpiada`)
    }

    if (reiniciarConsec) {
      const { error } = await supabase.from('consecutivos').update({ ultimo: 0 }).not('prefijo', 'is', null)
      resultados.push(error ? `❌ consecutivos: ${error.message}` : '✓ consecutivos reiniciados a 0')
    }

    setMensaje(resultados.join('\n'))
    setSeleccion([])
    setReiniciarConsec(false)
    setConfirmacion('')
    setProcesando(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4 mt-2">
        <h2 className="text-xl font-bold text-red-600">🛠️ Supervisor</h2>
        <p className="text-xs text-gray-400">Herramientas de administración del sistema</p>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-bold text-red-700 mb-1">⚠️ Limpieza de datos</p>
        <p className="text-xs text-red-600">Esta herramienta borra datos de forma permanente. Úsela solo para dejar el sistema limpio antes de pasar a producción. No borra el catálogo de cuentas (puc_cuentas) ni la estructura.</p>
      </div>

      {GRUPOS.map(g => (
        <div key={g.grupo} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-bold ${g.color}`}>{g.grupo}</span>
            {g.grupo === 'Movimientos' && (
              <button onClick={todasMovimientos} className="text-xs text-[#185FA5] hover:underline font-semibold">Seleccionar todos</button>
            )}
          </div>
          {g.tablas.map(t => (
            <label key={t.tabla} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 px-2 rounded">
              <input type="checkbox" checked={seleccion.includes(t.tabla)} onChange={() => toggle(t.tabla)} />
              <span className="text-sm text-gray-700">{t.label}</span>
              <span className="text-xs text-gray-300 ml-auto">{t.tabla}</span>
            </label>
          ))}
        </div>
      ))}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input type="checkbox" checked={reiniciarConsec} onChange={e => setReiniciarConsec(e.target.checked)} />
          <span className="text-sm text-gray-700">Reiniciar consecutivos a 0 (FC, RC, CM, CO, CE, etc.)</span>
        </label>
      </div>

      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">Para confirmar, escriba <span className="font-bold text-red-600">BORRAR</span> en el campo:</p>
        <div className="flex gap-3">
          <input value={confirmacion} onChange={e => setConfirmacion(e.target.value)} placeholder="BORRAR"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <button onClick={ejecutarLimpieza} disabled={procesando}
            className="px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
            {procesando ? 'Procesando...' : 'Ejecutar limpieza'}
          </button>
        </div>
      </div>

      {mensaje && (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{mensaje}</pre>
        </div>
      )}
    </div>
  )
}

export default Supervisor