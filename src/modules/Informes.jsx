import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarExcel } from '../utils/exportarExcel'

function Informes() {
  const [lineas, setLineas] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [informe, setInforme] = useState('resultados')
  const [terceros, setTerceros] = useState([])
  const hoy = new Date().toISOString().slice(0, 10)
  const inicioMes = hoy.slice(0, 8) + '01'
  const [desde, setDesde] = useState(inicioMes)
  const [hasta, setHasta] = useState(hoy)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: asc }, { data: cts }, { data: trcs }] = await Promise.all([
      supabase.from('asientos_contables').select('id, fecha'),
      supabase.from('puc_cuentas').select('codigo, nombre, clase, grupo'),
      supabase.from('terceros').select('id, nombre'),
    ])
    const { data: lns } = await supabase.from('asientos_lineas').select('*')
    // Enlazar cada linea con la fecha de su asiento
    const fechas = {}
    ;(asc || []).forEach(a => { fechas[a.id] = a.fecha })
    const conFecha = (lns || []).map(l => ({ ...l, fecha: fechas[l.asiento_id] }))
    setLineas(conFecha)
    setCuentas(cts || [])
    setTerceros(trcs || [])
    setLoading(false)
  }

  function exportarEstadoResultados() {
    const filas = []
    filas.push({ Concepto: 'INGRESOS DE ACTIVIDADES ORDINARIAS', Valor: ingresosOrd })
    detIngresos.forEach(d => filas.push({ Concepto: '   ' + d.codigo + ' - ' + d.nombre, Valor: d.valor }))
    filas.push({ Concepto: '(-) COSTO DE VENTAS', Valor: -costos })
    detCostos.forEach(d => filas.push({ Concepto: '   ' + d.codigo + ' - ' + d.nombre, Valor: d.valor }))
    filas.push({ Concepto: '= UTILIDAD BRUTA', Valor: utilidadBruta })
    filas.push({ Concepto: '(-) GASTOS OPERACIONALES', Valor: -gastos })
    detGastos.forEach(d => filas.push({ Concepto: '   ' + d.codigo + ' - ' + d.nombre, Valor: d.valor }))
    filas.push({ Concepto: '= UTILIDAD OPERACIONAL', Valor: utilidadOperacional })
    if (detOtros.length > 0) {
      filas.push({ Concepto: '(+) OTROS INGRESOS', Valor: otrosIngresos })
      detOtros.forEach(d => filas.push({ Concepto: '   ' + d.codigo + ' - ' + d.nombre, Valor: d.valor }))
    }
    filas.push({ Concepto: '= UTILIDAD NETA DEL PERIODO', Valor: utilidadNeta })
    exportarExcel(filas, `estado-resultados_${desde}_a_${hasta}`, 'Estado de Resultados')
  }

  function exportarCartera() {
    const filas = carteraPorCliente.map(c => ({ Cliente: c.nombre, Saldo: c.saldo }))
    filas.push({ Cliente: 'TOTAL CARTERA', Saldo: totalCartera })
    exportarExcel(filas, `cartera_al_${hasta}`, 'Cartera')
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
  // CARTERA POR CLIENTE: saldo de la cuenta 1305 Clientes por tercero, hasta la fecha de corte
  const nombreTercero = id => terceros.find(t => t.id === id)?.nombre || '(sin identificar)'
  const carteraHasta = lineas.filter(l => l.fecha && l.fecha <= hasta && l.cuenta_codigo === '1305')
  const carteraPorCliente = (() => {
    const map = {}
    carteraHasta.forEach(l => {
      const key = l.tercero_id || 'sin'
      if (!map[key]) map[key] = 0
      map[key] += (l.debe - l.haber)
    })
    return Object.entries(map)
      .map(([id, saldo]) => ({ id, nombre: nombreTercero(id), saldo }))
      .filter(c => Math.round(c.saldo) !== 0)
      .sort((a, b) => b.saldo - a.saldo)
  })()
  const totalCartera = carteraPorCliente.reduce((s, c) => s + c.saldo, 0)

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
      <div className="mb-4 mt-2">
        <h2 className="text-xl font-bold text-[#185FA5]">📊 Informes</h2>
        <p className="text-xs text-gray-400">Bajo NIIF para PYMES</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { id: 'resultados', label: 'Estado de Resultados' },
          { id: 'cartera', label: 'Cartera por cliente' },
        ].map(t => (
          <button key={t.id} onClick={() => setInforme(t.id)}
            className={`px-3 py-2 text-xs font-bold rounded-lg ${informe === t.id ? 'bg-[#185FA5] text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {informe === 'resultados' && (<>
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
      </>)}

      {informe === 'cartera' && (
        <>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4 flex gap-3 items-end justify-between">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Corte a la fecha</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <button onClick={exportarCartera}
            className="px-4 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90">
            ⬇ Exportar Excel
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
        ) : carteraPorCliente.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-300 text-sm">No hay cartera pendiente al corte</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-bold text-gray-700">Cartera al {hasta}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Cliente</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {carteraPorCliente.map(c => (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs font-semibold">{c.nombre}</td>
                    <td className="px-4 py-2 text-xs text-right font-semibold text-red-600">{fmt(c.saldo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="px-4 py-2 text-sm font-bold">TOTAL CARTERA</td>
                  <td className="px-4 py-2 text-sm text-right font-bold text-[#185FA5]">{fmt(totalCartera)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        </>
      )}
    </div>
  )
}

export default Informes