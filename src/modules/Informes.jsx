import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarExcel } from '../utils/exportarExcel'
import { imprimirConMembrete } from '../utils/membrete'

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
  const [cuentaAux, setCuentaAux] = useState('')
  const [nitAux, setNitAux] = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: asc }, { data: cts }, { data: trcs }] = await Promise.all([
      supabase.from('asientos_contables').select('id, fecha, documento_id, tipo_doc, descripcion'),
      supabase.from('puc_cuentas').select('codigo, nombre, clase, grupo'),
      supabase.from('terceros').select('id, nombre, nit'),
    ])
    const { data: lns } = await supabase.from('asientos_lineas').select('*')
    // Enlazar cada linea con la fecha de su asiento
    const info = {}
    ;(asc || []).forEach(a => { info[a.id] = a })
    const conFecha = (lns || []).map(l => ({
      ...l,
      fecha: info[l.asiento_id]?.fecha,
      documento_id: info[l.asiento_id]?.documento_id,
      tipo_doc: info[l.asiento_id]?.tipo_doc,
      descripcion: info[l.asiento_id]?.descripcion
    }))
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

  function imprimirEstadoResultados() {
    let filas = ''
    filas += `<tr class="tot"><td>INGRESOS DE ACTIVIDADES ORDINARIAS</td><td class="der">${fmt(ingresosOrd)}</td></tr>`
    detIngresos.forEach(d => filas += `<tr><td style="padding-left:20px">${d.codigo} · ${d.nombre}</td><td class="der">${fmt(d.valor)}</td></tr>`)
    filas += `<tr class="tot"><td>(−) COSTO DE VENTAS</td><td class="der">${fmt(-costos)}</td></tr>`
    detCostos.forEach(d => filas += `<tr><td style="padding-left:20px">${d.codigo} · ${d.nombre}</td><td class="der">${fmt(d.valor)}</td></tr>`)
    filas += `<tr class="tot"><td>= UTILIDAD BRUTA</td><td class="der">${fmt(utilidadBruta)}</td></tr>`
    filas += `<tr class="tot"><td>(−) GASTOS OPERACIONALES</td><td class="der">${fmt(-gastos)}</td></tr>`
    detGastos.forEach(d => filas += `<tr><td style="padding-left:20px">${d.codigo} · ${d.nombre}</td><td class="der">${fmt(d.valor)}</td></tr>`)
    filas += `<tr class="tot"><td>= UTILIDAD OPERACIONAL</td><td class="der">${fmt(utilidadOperacional)}</td></tr>`
    if (detOtros.length > 0) {
      filas += `<tr class="tot"><td>(+) OTROS INGRESOS</td><td class="der">${fmt(otrosIngresos)}</td></tr>`
      detOtros.forEach(d => filas += `<tr><td style="padding-left:20px">${d.codigo} · ${d.nombre}</td><td class="der">${fmt(d.valor)}</td></tr>`)
    }
    filas += `<tr class="tot" style="font-size:14px"><td>= UTILIDAD NETA DEL PERIODO</td><td class="der">${fmt(utilidadNeta)}</td></tr>`
    const contenido = `
      <p style="text-align:center;font-size:12px;color:#666;margin-bottom:10px">Del ${desde} al ${hasta} · Bajo NIIF para PYMES</p>
      <table><thead><tr><th>Concepto</th><th class="der">Valor</th></tr></thead><tbody>${filas}</tbody></table>`
    imprimirConMembrete('Estado de Resultados', contenido, '#185FA5')
  }

  function exportarCartera() {
    const filas = carteraPorCliente.map(c => ({ Cliente: c.nombre, Saldo: c.saldo }))
    filas.push({ Cliente: 'TOTAL CARTERA', Saldo: totalCartera })
    exportarExcel(filas, `cartera_al_${hasta}`, 'Cartera')
  }

  function exportarBalance() {
    const filas = []
    filas.push({ Concepto: 'ACTIVOS', Valor: '' })
    detActivos.forEach(d => filas.push({ Concepto: '   ' + d.codigo + ' - ' + d.nombre, Valor: d.valor }))
    filas.push({ Concepto: 'TOTAL ACTIVOS', Valor: totalActivos })
    filas.push({ Concepto: 'PASIVOS', Valor: '' })
    detPasivos.forEach(d => filas.push({ Concepto: '   ' + d.codigo + ' - ' + d.nombre, Valor: d.valor }))
    filas.push({ Concepto: 'TOTAL PASIVOS', Valor: totalPasivos })
    filas.push({ Concepto: 'PATRIMONIO', Valor: '' })
    detPatrimonio.forEach(d => filas.push({ Concepto: '   ' + d.codigo + ' - ' + d.nombre, Valor: d.valor }))
    filas.push({ Concepto: '   Resultado del ejercicio', Valor: utilidadAcumulada })
    filas.push({ Concepto: 'TOTAL PATRIMONIO', Valor: totalPatrimonio })
    filas.push({ Concepto: 'TOTAL PASIVO + PATRIMONIO', Valor: totalPasivoPatrimonio })
    exportarExcel(filas, `balance-general_al_${hasta}`, 'Balance General')
  }

  function imprimirBalance() {
    let filas = ''
    filas += `<tr class="tot"><td colspan="2">ACTIVOS</td></tr>`
    detActivos.forEach(d => filas += `<tr><td style="padding-left:20px">${d.codigo} · ${d.nombre}</td><td class="der">${fmt(d.valor)}</td></tr>`)
    filas += `<tr class="tot"><td>TOTAL ACTIVOS</td><td class="der">${fmt(totalActivos)}</td></tr>`
    filas += `<tr class="tot"><td colspan="2">PASIVOS</td></tr>`
    detPasivos.forEach(d => filas += `<tr><td style="padding-left:20px">${d.codigo} · ${d.nombre}</td><td class="der">${fmt(d.valor)}</td></tr>`)
    filas += `<tr class="tot"><td>TOTAL PASIVOS</td><td class="der">${fmt(totalPasivos)}</td></tr>`
    filas += `<tr class="tot"><td colspan="2">PATRIMONIO</td></tr>`
    detPatrimonio.forEach(d => filas += `<tr><td style="padding-left:20px">${d.codigo} · ${d.nombre}</td><td class="der">${fmt(d.valor)}</td></tr>`)
    filas += `<tr><td style="padding-left:20px">Resultado del ejercicio</td><td class="der">${fmt(utilidadAcumulada)}</td></tr>`
    filas += `<tr class="tot"><td>TOTAL PATRIMONIO</td><td class="der">${fmt(totalPatrimonio)}</td></tr>`
    filas += `<tr class="tot" style="font-size:14px"><td>TOTAL PASIVO + PATRIMONIO</td><td class="der">${fmt(totalPasivoPatrimonio)}</td></tr>`
    const contenido = `
      <p style="text-align:center;font-size:12px;color:#666;margin-bottom:10px">Estado de Situación Financiera al ${hasta} · Bajo NIIF para PYMES</p>
      <table><thead><tr><th>Concepto</th><th class="der">Valor</th></tr></thead><tbody>${filas}</tbody></table>`
    imprimirConMembrete('Balance General', contenido, '#185FA5')
  }

  function imprimirCartera() {
    let filas = ''
    carteraPorCliente.forEach(c => filas += `<tr><td>${c.nombre}</td><td class="der">${fmt(c.saldo)}</td></tr>`)
    filas += `<tr class="tot"><td>TOTAL CARTERA</td><td class="der">${fmt(totalCartera)}</td></tr>`
    const contenido = `
      <p style="text-align:center;font-size:12px;color:#666;margin-bottom:10px">Cartera por cliente al ${hasta}</p>
      <table><thead><tr><th>Cliente</th><th class="der">Saldo</th></tr></thead><tbody>${filas}</tbody></table>`
    imprimirConMembrete('Cartera por Cliente', contenido, '#185FA5')
  }

  function exportarAuxiliar() {
    if (movimientosAux.length === 0) { alert('No hay movimientos para exportar'); return }
    const filas = movimientosAux.map(l => ({
      Fecha: l.fecha || '',
      Cuenta: l.cuenta_codigo + ' - ' + (l.cuenta_nombre || ''),
      Tercero: nombreTercero(l.tercero_id),
      Debe: l.debe || 0,
      Haber: l.haber || 0,
      Saldo: l.saldo
    }))
    filas.push({ Fecha: 'TOTALES', Cuenta: '', Tercero: '', Debe: totalDebeAux, Haber: totalHaberAux, Saldo: totalDebeAux - totalHaberAux })
    exportarExcel(filas, `auxiliar_${cuentaAux || 'todas'}_${nitAux || ''}_${desde}_a_${hasta}`, 'Libro auxiliar')
  }

  function imprimirAuxiliar() {
    if (movimientosAux.length === 0) { alert('No hay movimientos para imprimir'); return }
    let filas = ''
    movimientosAux.forEach(l => filas += `<tr><td>${l.fecha || ''}</td><td>${l.documento_id || ''}</td><td>${l.cuenta_codigo} · ${l.cuenta_nombre || ''}</td><td>${nombreTercero(l.tercero_id)}</td><td class="der">${l.debe ? fmt(l.debe) : ''}</td><td class="der">${l.haber ? fmt(l.haber) : ''}</td><td class="der">${fmt(l.saldo)}</td></tr>`)
    filas += `<tr class="tot"><td colspan="4">TOTALES</td><td class="der">${fmt(totalDebeAux)}</td><td class="der">${fmt(totalHaberAux)}</td><td class="der">${fmt(totalDebeAux - totalHaberAux)}</td></tr>`
    const cta = cuentaAux ? `${cuentaAux} · ${cuentasConMovimiento.find(c => c.codigo === cuentaAux)?.nombre || ''}` : 'Todas las cuentas'
    const contenido = `
      <p style="text-align:center;font-size:12px;color:#666;margin-bottom:10px">${cta} · del ${desde} al ${hasta}</p>
      <table><thead><tr><th>Fecha</th><th>Documento</th><th>Cuenta</th><th>Tercero</th><th class="der">Debe</th><th class="der">Haber</th><th class="der">Saldo</th></tr></thead><tbody>${filas}</tbody></table>`
    imprimirConMembrete('Libro Auxiliar', contenido, '#185FA5')
  }

  function exportarSaldosTercero() {
    if (!cuentaAux || saldosPorTercero.length === 0) { alert('No hay saldos para exportar'); return }
    const filas = saldosPorTercero.map(x => ({ Tercero: x.nombre, Saldo: x.saldo }))
    filas.push({ Tercero: 'TOTAL', Saldo: totalSaldosTercero })
    exportarExcel(filas, `saldos-por-tercero_${cuentaAux}_al_${hasta}`, 'Saldos por tercero')
  }

  function imprimirSaldosTercero() {
    const cta = cuentasConMovimiento.find(c => c.codigo === cuentaAux)
    let filas = ''
    saldosPorTercero.forEach(x => filas += `<tr><td>${x.nombre}</td><td class="der">${fmt(x.saldo)}</td></tr>`)
    filas += `<tr class="tot"><td>TOTAL</td><td class="der">${fmt(totalSaldosTercero)}</td></tr>`
    const contenido = `
      <p style="text-align:center;font-size:12px;color:#666;margin-bottom:10px">${cuentaAux} · ${cta?.nombre || ''} — saldos al ${hasta}</p>
      <table><thead><tr><th>Tercero</th><th class="der">Saldo</th></tr></thead><tbody>${filas}</tbody></table>`
    imprimirConMembrete('Saldos por Tercero', contenido, '#185FA5')
  }

  function imprimirBalancePrueba() {
    let filas = ''
    balancePrueba.forEach(r => {
      filas += `<tr>
        <td>${r.codigo}</td>
        <td>${r.nombre}</td>
        <td class="der">${fmt(r.saldoAnt)}</td>
        <td class="der">${r.debe ? fmt(r.debe) : '—'}</td>
        <td class="der">${r.haber ? fmt(r.haber) : '—'}</td>
        <td class="der">${fmt(r.saldoFin)}</td>
      </tr>`
    })
    const cuadre = Math.round(totalBP.debe - totalBP.haber) === 0 ? '✓ Cuadra' : '⚠ Descuadre'
    filas += `<tr class="tot">
      <td colspan="3">TOTALES</td>
      <td class="der">${fmt(totalBP.debe)}</td>
      <td class="der">${fmt(totalBP.haber)}</td>
      <td class="der">${cuadre}</td>
    </tr>`
    const contenido = `
      <p style="text-align:center;font-size:12px;color:#666;margin-bottom:10px">Del ${desde} al ${hasta}</p>
      <table><thead><tr>
        <th>Código</th><th>Cuenta</th><th class="der">Saldo anterior</th>
        <th class="der">Débitos</th><th class="der">Créditos</th><th class="der">Saldo final</th>
      </tr></thead><tbody>${filas}</tbody></table>`
    imprimirConMembrete('Balance de Prueba', contenido, '#185FA5')
  }

  function exportarBalancePrueba() {
    const datos = balancePrueba.map(r => ({
      'Código': r.codigo,
      'Cuenta': r.nombre,
      'Saldo anterior': Math.round(r.saldoAnt),
      'Débitos': Math.round(r.debe),
      'Créditos': Math.round(r.haber),
      'Saldo final': Math.round(r.saldoFin),
    }))
    datos.push({
      'Código': '', 'Cuenta': 'TOTALES',
      'Saldo anterior': '',
      'Débitos': Math.round(totalBP.debe),
      'Créditos': Math.round(totalBP.haber),
      'Saldo final': '',
    })
    exportarExcel(datos, 'Balance_de_Prueba')
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
  // BALANCE GENERAL: saldos acumulados de cuentas de balance hasta la fecha de corte
  const hastaBal = lineas.filter(l => l.fecha && l.fecha <= hasta)
  const saldoClaseBal = (clase, signo) => {
    const map = {}
    hastaBal.forEach(l => {
      const c = cuentas.find(x => x.codigo === l.cuenta_codigo)
      if (!c || c.clase !== clase) return
      if (!map[l.cuenta_codigo]) map[l.cuenta_codigo] = { nombre: l.cuenta_nombre, valor: 0 }
      map[l.cuenta_codigo].valor += (signo === 'debito' ? (l.debe - l.haber) : (l.haber - l.debe))
    })
    return Object.entries(map)
      .map(([codigo, v]) => ({ codigo, ...v }))
      .filter(x => Math.round(x.valor) !== 0)
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  }

  // BALANCE DE PRUEBA: saldo anterior (antes de 'desde') + movimientos del periodo + saldo final
  const balancePrueba = (() => {
    const map = {}
    lineas.forEach(l => {
      if (!l.fecha) return
      const cta = cuentas.find(x => x.codigo === l.cuenta_codigo)
      if (!cta) return
      if (!map[l.cuenta_codigo]) {
        map[l.cuenta_codigo] = {
          codigo: l.cuenta_codigo,
          nombre: cta.nombre || l.cuenta_nombre,
          naturaleza: cta.naturaleza || 'debito',
          antDebe: 0, antHaber: 0, debe: 0, haber: 0,
        }
      }
      const r = map[l.cuenta_codigo]
      if (l.fecha < desde) {
        r.antDebe += l.debe || 0
        r.antHaber += l.haber || 0
      } else if (l.fecha <= hasta) {
        r.debe += l.debe || 0
        r.haber += l.haber || 0
      }
    })
    return Object.values(map).map(r => {
      const esDebito = r.naturaleza === 'debito'
      const saldoAnt = esDebito ? (r.antDebe - r.antHaber) : (r.antHaber - r.antDebe)
      const saldoFin = esDebito
        ? (r.antDebe + r.debe) - (r.antHaber + r.haber)
        : (r.antHaber + r.haber) - (r.antDebe + r.debe)
      return { ...r, saldoAnt, saldoFin }
    })
    .filter(r => Math.round(r.saldoAnt) !== 0 || Math.round(r.debe) !== 0 || Math.round(r.haber) !== 0 || Math.round(r.saldoFin) !== 0)
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
  })()

  const totalBP = balancePrueba.reduce((t, r) => ({
    debe: t.debe + r.debe,
    haber: t.haber + r.haber,
  }), { debe: 0, haber: 0 })

  const detActivos = saldoClaseBal('Activo', 'debito')
  const detPasivos = saldoClaseBal('Pasivo', 'credito')
  const detPatrimonio = saldoClaseBal('Patrimonio', 'credito')
  const totalActivos = detActivos.reduce((s, x) => s + x.valor, 0)
  const totalPasivos = detPasivos.reduce((s, x) => s + x.valor, 0)
  // La utilidad del periodo (resultados acumulados hasta el corte) es parte del patrimonio
  const ingHasta = hastaBal.filter(l => cuentas.find(x => x.codigo === l.cuenta_codigo)?.clase === 'Ingreso').reduce((s, l) => s + (l.haber - l.debe), 0)
  const cosHasta = hastaBal.filter(l => cuentas.find(x => x.codigo === l.cuenta_codigo)?.clase === 'Costo').reduce((s, l) => s + (l.debe - l.haber), 0)
  const gasHasta = hastaBal.filter(l => cuentas.find(x => x.codigo === l.cuenta_codigo)?.clase === 'Gasto').reduce((s, l) => s + (l.debe - l.haber), 0)
  const utilidadAcumulada = ingHasta - cosHasta - gasHasta
  const totalPatrimonio = detPatrimonio.reduce((s, x) => s + x.valor, 0) + utilidadAcumulada
  const totalPasivoPatrimonio = totalPasivos + totalPatrimonio
  const descuadre = totalActivos - totalPasivoPatrimonio
  
  // LIBRO AUXILIAR: movimientos de una cuenta en el periodo, con saldo corriente
  const cuentasConMovimiento = [...new Set(lineas.map(l => l.cuenta_codigo))]
    .map(cod => {
      const c = cuentas.find(x => x.codigo === cod)
      return { codigo: cod, nombre: c?.nombre || (lineas.find(l => l.cuenta_codigo === cod)?.cuenta_nombre || cod) }
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo))

  // Resolver el tercero_id a partir del NIT/cedula digitado
  const soloDigitos = v => (v ?? '').toString().replace(/\D/g, '')
  const terceroDelNit = nitAux.trim()
    ? terceros.find(t => soloDigitos(t.nit) === soloDigitos(nitAux))
    : null
  const nitNoEncontrado = nitAux.trim() && !terceroDelNit

  const movimientosAux = (() => {
    if (!cuentaAux && !nitAux.trim()) return []
    if (nitAux.trim() && !terceroDelNit) return []
    const filtradas = enRango
      .filter(l => (!cuentaAux || l.cuenta_codigo === cuentaAux))
      .filter(l => (!terceroDelNit || l.tercero_id === terceroDelNit.id))
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
    let saldo = 0
    return filtradas.map(l => {
      saldo += (l.debe - l.haber)
      return { ...l, saldo }
    })
  })()
  const totalDebeAux = movimientosAux.reduce((s, l) => s + (l.debe || 0), 0)
  const totalHaberAux = movimientosAux.reduce((s, l) => s + (l.haber || 0), 0)

  // SALDOS POR TERCERO: para la cuenta seleccionada, el saldo de cada tercero hasta el corte
  const saldosPorTercero = (() => {
    if (!cuentaAux) return []
    const cta = cuentas.find(x => x.codigo === cuentaAux)
    const esDebito = cta ? cta.naturaleza === 'debito' : true
    const map = {}
    hastaBal.filter(l => l.cuenta_codigo === cuentaAux).forEach(l => {
      const key = l.tercero_id || 'sin'
      if (!map[key]) map[key] = 0
      map[key] += esDebito ? (l.debe - l.haber) : (l.haber - l.debe)
    })
    return Object.entries(map)
      .map(([id, saldo]) => ({ id, nombre: nombreTercero(id), saldo }))
      .filter(x => Math.round(x.saldo) !== 0)
      .sort((a, b) => b.saldo - a.saldo)
  })()
  const totalSaldosTercero = saldosPorTercero.reduce((s, x) => s + x.saldo, 0)

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
          { id: 'balance', label: 'Balance General' },
          { id: 'cartera', label: 'Cartera por cliente' },
          { id: 'auxiliar', label: 'Libro auxiliar' },
          { id: 'terceros', label: 'Saldos por tercero' },
          { id: 'balanceprueba', label: 'Balance de prueba' },
        ].map(t => (
          <button key={t.id} onClick={() => setInforme(t.id)}
            className={`px-3 py-2 text-xs font-bold rounded-lg ${informe === t.id ? 'bg-[#185FA5] text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {informe === 'resultados' && (<>
      <div className="flex justify-end gap-2 mb-3">
        <button onClick={imprimirEstadoResultados}
          className="px-4 py-2 bg-[#185FA5] text-white text-xs font-bold rounded-lg hover:opacity-90">
          🖨️ Imprimir
        </button>
        <button onClick={exportarEstadoResultados}
          className="px-4 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90">
          ⬇ Exportar Excel
        </button>
      </div>
      <div className="card p-3 mb-4 flex gap-3 items-end">
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
        <div className="card overflow-hidden">
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
        <div className="card p-3 mb-4 flex gap-3 items-end justify-between">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Corte a la fecha</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <button onClick={imprimirCartera}
            className="px-4 py-2 bg-[#185FA5] text-white text-xs font-bold rounded-lg hover:opacity-90">
            🖨️ Imprimir
          </button>
          <button onClick={exportarCartera}
            className="px-4 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90">
            ⬇ Exportar Excel
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
        ) : carteraPorCliente.length === 0 ? (
          <div className="card p-8 text-center text-gray-300 text-sm">No hay cartera pendiente al corte</div>
        ) : (
          <div className="card overflow-hidden">
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

      {informe === 'balance' && (
        <>
        <div className="card p-3 mb-4 flex gap-3 items-end justify-between">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Corte a la fecha</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <button onClick={imprimirBalance}
            className="px-4 py-2 bg-[#185FA5] text-white text-xs font-bold rounded-lg hover:opacity-90">
            🖨️ Imprimir
          </button>
          <button onClick={exportarBalance}
            className="px-4 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90">
            ⬇ Exportar Excel
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-bold text-gray-700">Estado de Situación Financiera al {hasta}</span>
            </div>
            <div className="py-2">
              <div className="px-4 py-1.5 font-bold text-[#185FA5] border-t border-gray-200">ACTIVOS</div>
              {detActivos.map(d => (
                <div key={d.codigo} className="flex justify-between py-1 px-4 pl-8 text-gray-600">
                  <span className="text-sm">{d.codigo} · {d.nombre}</span><span className="text-sm">{fmt(d.valor)}</span>
                </div>
              ))}
              <div className="flex justify-between py-1.5 px-4 font-bold border-t border-gray-100">
                <span className="text-sm">TOTAL ACTIVOS</span><span className="text-sm text-[#185FA5]">{fmt(totalActivos)}</span>
              </div>

              <div className="px-4 py-1.5 font-bold text-[#185FA5] border-t border-gray-200 mt-2">PASIVOS</div>
              {detPasivos.map(d => (
                <div key={d.codigo} className="flex justify-between py-1 px-4 pl-8 text-gray-600">
                  <span className="text-sm">{d.codigo} · {d.nombre}</span><span className="text-sm">{fmt(d.valor)}</span>
                </div>
              ))}
              <div className="flex justify-between py-1.5 px-4 font-bold border-t border-gray-100">
                <span className="text-sm">TOTAL PASIVOS</span><span className="text-sm">{fmt(totalPasivos)}</span>
              </div>

              <div className="px-4 py-1.5 font-bold text-[#185FA5] border-t border-gray-200 mt-2">PATRIMONIO</div>
              {detPatrimonio.map(d => (
                <div key={d.codigo} className="flex justify-between py-1 px-4 pl-8 text-gray-600">
                  <span className="text-sm">{d.codigo} · {d.nombre}</span><span className="text-sm">{fmt(d.valor)}</span>
                </div>
              ))}
              <div className="flex justify-between py-1 px-4 pl-8 text-gray-600">
                <span className="text-sm">Resultado del ejercicio</span><span className="text-sm">{fmt(utilidadAcumulada)}</span>
              </div>
              <div className="flex justify-between py-1.5 px-4 font-bold border-t border-gray-100">
                <span className="text-sm">TOTAL PATRIMONIO</span><span className="text-sm">{fmt(totalPatrimonio)}</span>
              </div>

              <div className="mx-4 my-2 border-t-2 border-gray-300"></div>
              <div className="flex justify-between py-2 px-4 font-bold text-lg text-[#185FA5]">
                <span>TOTAL PASIVO + PATRIMONIO</span><span>{fmt(totalPasivoPatrimonio)}</span>
              </div>
              {Math.round(descuadre) !== 0 && (
                <div className="mx-4 mb-3 p-2 bg-red-50 text-red-700 rounded-lg text-xs font-semibold text-center">
                  ⚠ Descuadre de {fmt(descuadre)} — Activo ≠ Pasivo + Patrimonio
                </div>
              )}
            </div>
          </div>
        )}
        </>
      )}

      {informe === 'auxiliar' && (
        <>
        <div className="card p-3 mb-4 flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Cuenta (opcional)</label>
            <select value={cuentaAux} onChange={e => setCuentaAux(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">— Todas las cuentas —</option>
              {cuentasConMovimiento.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">NIT / Cédula (opcional)</label>
            <input value={nitAux} onChange={e => setNitAux(e.target.value)} list="lista-nits" placeholder="Digite NIT o cédula"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <datalist id="lista-nits">
              {terceros.filter(t => t.nit).map(t => <option key={t.id} value={t.nit}>{t.nombre}</option>)}
            </datalist>
            {terceroDelNit && <p className="text-xs text-green-600 mt-1">✓ {terceroDelNit.nombre}</p>}
            {nitNoEncontrado && <p className="text-xs text-red-500 mt-1">NIT no encontrado</p>}
            
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <button onClick={imprimirAuxiliar}
            className="px-4 py-2 bg-[#185FA5] text-white text-xs font-bold rounded-lg hover:opacity-90">
            🖨️ Imprimir
          </button>
          <button onClick={exportarAuxiliar}
            className="px-4 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90">
            ⬇ Exportar Excel
          </button>
        </div>

        {!cuentaAux && !nitAux.trim() ? (
          <div className="card p-8 text-center text-gray-300 text-sm">Seleccione una cuenta o digite un NIT para ver los movimientos</div>
        ) : movimientosAux.length === 0 ? (
          <div className="card p-8 text-center text-gray-300 text-sm">Sin movimientos en el periodo</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-bold text-gray-700">
                {cuentaAux ? `${cuentaAux} · ${cuentasConMovimiento.find(c => c.codigo === cuentaAux)?.nombre}` : 'Todas las cuentas'}
                {terceroDelNit ? ` · ${terceroDelNit.nombre}` : ''}
                {' '}— del {desde} al {hasta}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Fecha</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Documento</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Cuenta</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Tercero</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Debe</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Haber</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {movimientosAux.map(l => (
                  <tr key={l.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-500">{l.fecha || '—'}</td>
                    <td className="px-4 py-2 text-xs text-[#185FA5] font-semibold">{l.documento_id || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{l.cuenta_codigo} · {l.cuenta_nombre}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{nombreTercero(l.tercero_id)}</td>
                    <td className="px-4 py-2 text-xs text-right">{l.debe ? fmt(l.debe) : ''}</td>
                    <td className="px-4 py-2 text-xs text-right">{l.haber ? fmt(l.haber) : ''}</td>
                    <td className="px-4 py-2 text-xs text-right font-semibold">{fmt(l.saldo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="px-4 py-2 text-sm font-bold">TOTALES</td>
                  <td className="px-4 py-2 text-sm text-right font-bold">{fmt(totalDebeAux)}</td>
                  <td className="px-4 py-2 text-sm text-right font-bold">{fmt(totalHaberAux)}</td>
                  <td className="px-4 py-2 text-sm text-right font-bold text-[#185FA5]">{fmt(totalDebeAux - totalHaberAux)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        </>
      )}

      {informe === 'terceros' && (
        <>
        <div className="card p-3 mb-4 flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Cuenta</label>
            <select value={cuentaAux} onChange={e => setCuentaAux(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">— Seleccionar cuenta —</option>
              {cuentasConMovimiento.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Corte a la fecha</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <button onClick={imprimirSaldosTercero}
            className="px-4 py-2 bg-[#185FA5] text-white text-xs font-bold rounded-lg hover:opacity-90">
            🖨️ Imprimir
          </button>
          <button onClick={exportarSaldosTercero}
            className="px-4 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90">
            ⬇ Exportar Excel
          </button>
        </div>

        {!cuentaAux ? (
          <div className="card p-8 text-center text-gray-300 text-sm">Seleccione una cuenta para ver sus saldos por tercero</div>
        ) : saldosPorTercero.length === 0 ? (
          <div className="card p-8 text-center text-gray-300 text-sm">Sin saldos en esta cuenta al corte</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-bold text-gray-700">{cuentaAux} · {cuentasConMovimiento.find(c => c.codigo === cuentaAux)?.nombre} — saldos al {hasta}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Tercero</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {saldosPorTercero.map(x => (
                  <tr key={x.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs font-semibold">{x.nombre}</td>
                    <td className="px-4 py-2 text-xs text-right font-semibold">{fmt(x.saldo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="px-4 py-2 text-sm font-bold">TOTAL</td>
                  <td className="px-4 py-2 text-sm text-right font-bold text-[#185FA5]">{fmt(totalSaldosTercero)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        </>
      )}

      {informe === 'balanceprueba' && (
        <>
        <div className="flex justify-end gap-2 mb-3">
          <button onClick={imprimirBalancePrueba}
            className="px-4 py-2 bg-[#185FA5] text-white text-xs font-bold rounded-lg hover:opacity-90">
            🖨️ Imprimir
          </button>
          <button onClick={exportarBalancePrueba}
            className="px-4 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90">
            ⬇ Exportar Excel
          </button>
        </div>
        <div className="card p-3 mb-4 flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500 font-semibold">Código</th>
                <th className="px-3 py-2 text-left text-gray-500 font-semibold">Cuenta</th>
                <th className="px-3 py-2 text-right text-gray-500 font-semibold">Saldo anterior</th>
                <th className="px-3 py-2 text-right text-gray-500 font-semibold">Débitos</th>
                <th className="px-3 py-2 text-right text-gray-500 font-semibold">Créditos</th>
                <th className="px-3 py-2 text-right text-gray-500 font-semibold">Saldo final</th>
              </tr>
            </thead>
            <tbody>
              {balancePrueba.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-300">Sin movimientos en el periodo</td></tr>
              ) : balancePrueba.map(r => (
                <tr key={r.codigo} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-600">{r.codigo}</td>
                  <td className="px-3 py-2">{r.nombre}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{fmt(r.saldoAnt)}</td>
                  <td className="px-3 py-2 text-right">{r.debe ? fmt(r.debe) : '—'}</td>
                  <td className="px-3 py-2 text-right">{r.haber ? fmt(r.haber) : '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(r.saldoFin)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td colSpan={3} className="px-3 py-2 text-sm font-bold">TOTALES</td>
                <td className="px-3 py-2 text-right text-sm font-bold text-[#185FA5]">{fmt(totalBP.debe)}</td>
                <td className="px-3 py-2 text-right text-sm font-bold text-[#185FA5]">{fmt(totalBP.haber)}</td>
                <td className="px-3 py-2 text-right text-sm font-bold">{Math.round(totalBP.debe - totalBP.haber) === 0 ? '✓ Cuadra' : '⚠ Descuadre'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}
    </div>
  )
}

export default Informes