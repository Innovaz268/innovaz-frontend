import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function Informes() {
  const [lineas, setLineas] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const hoy = new Date().toISOString().slice(0, 10)
  const inicioMes = hoy.slice(0, 8) + '01'
  const [desde, setDesde] = useState(inicioMes)
  const [hasta, setHasta] = useState(hoy)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: asc }, { data: cts }] = await Promise.all([
      supabase.from('asientos_contables').select('id, fecha'),
      supabase.from('puc_cuentas').select('codigo, nombre, clase, grupo'),
    ])
    const { data: lns } = await supabase.from('asientos_lineas').select('*')
    // Enlazar cada linea con la fecha de su asiento
    const fechas = {}
    ;(asc || []).forEach(a => { fechas[a.id] = a.fecha })
    const conFecha = (lns || []).map(l => ({ ...l, fecha: fechas[l.asiento_id] }))
    setLineas(conFecha)
    setCuentas(cts || [])
    setLoading(false)
  }

  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')

  // Clase de una cuenta segun su codigo (primer digito) o el catalogo
  const claseDe = codigo => {
    const c = cuentas.find(x => x.codigo === codigo)
    if (c) return c.clase
    return null
  }
  const grupoDe = codigo => cuentas.find(x => x.codigo === codigo)?.grupo || ''

  // Filtrar lineas por rango de fecha
  const enRango = lineas.filter(l => l.fecha && l.fecha >= desde && l.fecha <= hasta)

  // Sumar por clase con la naturaleza correcta
  const sumaClase = (clase, signo) => enRango
    .filter(l => claseDe(l.cuenta_codigo) === clase)
    .reduce((s, l) => s + (signo === 'credito' ? (l.haber - l.debe) : (l.debe - l.haber)), 0)

  const sumaGrupo = (clase, grupo, signo) => enRango
    .filter(l => claseDe(l.cuenta_codigo) === clase && grupoDe(l.cuenta_codigo) === grupo)
    .reduce((s, l) => s + (signo === 'credito' ? (l.haber - l.debe) : (l.debe - l.haber)), 0)

  const ingresosOrd = sumaGrupo('Ingreso', 'Ordinarios', 'credito')
  const otrosIngresos = sumaGrupo('Ingreso', 'Otros', 'credito')
  const costos = sumaClase('Costo', 'debito')
  const gastos = sumaClase('Gasto', 'debito')

  const utilidadBruta = ingresosOrd - costos
  const utilidadOperacional = utilidadBruta - gastos
  const utilidadNeta = utilidadOperacional + otrosIngresos

  // Detalle por cuenta dentro de una clase/grupo
  const detalle = (filtro) => {
    const map = {}
    enRango.filter(filtro).forEach(l => {
      if (!map[l.cuenta_codigo]) map[l.cuenta_codigo] = { nombre: l.cuenta_nombre, valor: 0 }
      map[l.cuenta_codigo].valor += (l.haber - l.debe)
    })
    return Object.entries(map).map(([codigo, v]) => ({ codigo, ...v }))
  }

  const detIngresos = detalle(l => claseDe(l.cuenta_codigo) === 'Ingreso' && grupoDe(l.cuenta_codigo) === 'Ordinarios')
  const detCostos = detalle(l => claseDe(l.cuenta_codigo) === 'Costo').map(d => ({ ...d, valor: -d.valor }))
  const detGastos = detalle(l => claseDe(l.cuenta_codigo) === 'Gasto').map(d => ({ ...d, valor: -d.valor }))
  const detOtros = detalle(l => claseDe(l.cuenta_codigo) === 'Ingreso' && grupoDe(l.cuenta_codigo) === 'Otros')

  const Fila = ({ label, valor, bold, indent, color }) => (
    <div className={`flex justify-between py-1.5 px-4 ${bold ? 'font-bold border-t border-gray-200' : ''} ${indent ? 'pl-8 text-gray-600' : ''}`}>
      <span className={`text-sm ${bold ? 'text-gray-800' : ''}`}>{label}</span>
      <span className={`text-sm ${color || ''}`}>{fmt(valor)}</span>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 mt-2">
        <div>
          <h2 className="text-xl font-bold text-[#185FA5]">📊 Estado de Resultados</h2>
          <p className="text-xs text-gray-400">Bajo NIIF para PYMES</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4 flex gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-bold text-gray-700">Del {desde} al {hasta}</span>
          </div>

          <div className="py-2">
            <Fila label="Ingresos de actividades ordinarias" valor={ingresosOrd} bold />
            {detIngresos.map(d => <Fila key={d.codigo} label={`${d.codigo} · ${d.nombre}`} valor={d.valor} indent />)}

            <Fila label="(−) Costo de ventas" valor={-costos} bold />
            {detCostos.map(d => <Fila key={d.codigo} label={`${d.codigo} · ${d.nombre}`} valor={d.valor} indent />)}

            <Fila label="= Utilidad bruta" valor={utilidadBruta} bold color={utilidadBruta >= 0 ? 'text-green-600' : 'text-red-600'} />

            <Fila label="(−) Gastos operacionales" valor={-gastos} bold />
            {detGastos.map(d => <Fila key={d.codigo} label={`${d.codigo} · ${d.nombre}`} valor={d.valor} indent />)}

            <Fila label="= Utilidad operacional" valor={utilidadOperacional} bold color={utilidadOperacional >= 0 ? 'text-green-600' : 'text-red-600'} />

            {detOtros.length > 0 && (
              <>
                <Fila label="(+) Otros ingresos" valor={otrosIngresos} bold />
                {detOtros.map(d => <Fila key={d.codigo} label={`${d.codigo} · ${d.nombre}`} valor={d.valor} indent />)}
              </>
            )}

            <div className="mx-4 my-2 border-t-2 border-gray-300"></div>
            <div className={`flex justify-between py-2 px-4 font-bold text-lg ${utilidadNeta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              <span>= Utilidad neta del periodo</span>
              <span>{fmt(utilidadNeta)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Informes