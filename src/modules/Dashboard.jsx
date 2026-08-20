import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function Dashboard({ color = '#185FA5' }) {
  const [contratos, setContratos] = useState([])
  const [caja, setCaja] = useState([])
  const [terceros, setTerceros] = useState([])
  const [lineas, setLineas] = useState([])
  const [lineasContables, setLineasContables] = useState([])
  const [vista, setVista] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
            const [{ data: ct }, { data: cj }, { data: trcs }, { data: lns }, { data: asc }, { data: asl }] = await Promise.all([
        supabase.from('contratos').select('*').eq('estado', 'Activo'),
        supabase.from('caja').select('*').order('fecha', { ascending: false }),
        supabase.from('terceros').select('id, nombre'),
        supabase.from('alquiler_lineas').select('*'),
        supabase.from('asientos_contables').select('id, fecha, descripcion, documento_id'),
        supabase.from('asientos_lineas').select('*'),
      ])
      setContratos(ct || [])
      setCaja(cj || [])
      setTerceros(trcs || [])
      setLineas(lns || [])
      // Enlazar cada línea de asiento con la fecha/descripción de su asiento
      const infoAs = {}
      ;(asc || []).forEach(a => { infoAs[a.id] = a })
      const lineasCaja = (asl || []).map(l => ({
        ...l,
        fecha: infoAs[l.asiento_id]?.fecha,
        descripcion: infoAs[l.asiento_id]?.descripcion,
        documento_id: infoAs[l.asiento_id]?.documento_id,
      }))
      setLineasContables(lineasCaja)
      setLoading(false)
    }
    cargarDatos()
  }, [])

    // Abonos pagados en caja por cada contrato (factura de alquiler)
  const abonosDeContrato = c => caja
    .filter(p => p.contrato_id === c.id)
    .reduce((s, p) => s + (p.monto || 0), 0)
  const saldoContrato = c => (c.total || 0) - (c.anticipo || 0) - abonosDeContrato(c)
  const totalCobrar = contratos.reduce((sum, c) => sum + saldoContrato(c), 0)
    // SALDO REAL DE CAJA: saldo de las cuentas de caja (110505, 110510) según la contabilidad
  const esCuentaCaja = cod => cod && (cod.startsWith('1105'))
  const lineasCaja = lineasContables.filter(l => esCuentaCaja(l.cuenta_codigo))
  const saldoCaja = lineasCaja.reduce((s, l) => s + ((l.debe || 0) - (l.haber || 0)), 0)

  // Movimientos de caja del último mes (para el detalle)
  const hoyD = new Date()
  const haceUnMes = new Date(hoyD.getFullYear(), hoyD.getMonth() - 1, hoyD.getDate()).toISOString().slice(0, 10)
  const movimientosCajaMes = lineasCaja
    .filter(l => l.fecha && l.fecha >= haceUnMes)
    .map(l => ({
      fecha: l.fecha,
      descripcion: l.descripcion || '',
      documento_id: l.documento_id || '',
      ingreso: l.debe || 0,
      salida: l.haber || 0,
    }))
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  const equiposCampo = lineas.filter(l => l.estado === 'En obra').reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0)

  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')
  const nombreCliente = id => terceros.find(t => t.id === id)?.nombre || '---'
  const facturaDoc = id => contratos.find(c => c.id === id)?.id_doc || '---'

  const tarjetas = [
    { id: 'facturas', label: 'Facturas activas', valor: contratos.length, color: 'text-[#185FA5]' },
    { id: 'cobrar', label: 'Saldo por cobrar', valor: fmt(totalCobrar), color: 'text-[#27500A]' },
    { id: 'equipos', label: 'Equipos en campo', valor: equiposCampo, color: 'text-[#5B21B6]' },
        { id: 'caja', label: 'Saldo en caja', valor: fmt(saldoCaja), color: 'text-[#92400E]' },
  ]

  const titulos = {
    facturas: '📄 Facturas activas en obra',
    cobrar: '💰 Facturas con saldo por cobrar',
    equipos: '🔧 Equipos en campo',
    caja: '💳 Movimientos de caja',
  }

  if (loading) return (
    <div className="flex items-center justify-center mt-20">
      <p className="text-gray-400 text-sm">Cargando datos...</p>
    </div>
  )

  const th = "px-4 py-2 text-left text-xs text-gray-500 font-semibold"
  const td = "px-4 py-2 text-xs"

  return (
    <div className="max-w-5xl mx-auto">

      <div className="grid grid-cols-2 gap-3 mb-6 mt-2">
        {tarjetas.map(m => (
          <div key={m.id} onClick={() => setVista(m.id)}
            onMouseEnter={ev => ev.currentTarget.style.backgroundColor = color + '0d'}
            onMouseLeave={ev => ev.currentTarget.style.backgroundColor = vista === m.id ? color + '0d' : '#ffffff'}
            style={{ backgroundColor: vista === m.id ? color + '0d' : '#ffffff', ...(vista === m.id ? { boxShadow: `0 0 0 1.5px ${color}66` } : {}) }}
            className="rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{m.label}</p>
            <p className={`text-2xl font-bold ${m.color}`}>{m.valor}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-700">{titulos[vista]}</span>
        </div>

        {vista === 'facturas' && (
          contratos.length === 0 ? <div className="p-8 text-center text-gray-300 text-sm">No hay facturas activas</div> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className={th}>Factura</th><th className={th}>Cliente</th><th className={th}>Salida</th><th className={th}>Total</th><th className={th}>Estado</th>
              </tr></thead>
              <tbody>
                {contratos.map(c => (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className={`${td} font-semibold text-[#185FA5]`}>{c.id_doc || '---'}</td>
                    <td className={td}>{nombreCliente(c.cliente_id)}</td>
                    <td className={`${td} text-gray-500`}>{c.fecha_salida || '---'}</td>
                    <td className={`${td} font-semibold`}>{fmt(c.total)}</td>
                    <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-semibold">{c.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {vista === 'cobrar' && (
          (() => {
            const conSaldo = contratos.filter(c => saldoContrato(c) > 0)
            return conSaldo.length === 0 ? <div className="p-8 text-center text-gray-300 text-sm">No hay saldos pendientes</div> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className={th}>Factura</th><th className={th}>Cliente</th><th className={th}>Total</th><th className={th}>Anticipo</th><th className={th}>Saldo</th>
                </tr></thead>
                <tbody>
                  {conSaldo.map(c => (
                    <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className={`${td} font-semibold text-[#185FA5]`}>{c.id_doc || '---'}</td>
                      <td className={td}>{nombreCliente(c.cliente_id)}</td>
                      <td className={td}>{fmt(c.total)}</td>
                      <td className={`${td} text-gray-500`}>{fmt(c.anticipo)}</td>
                      <td className={`${td} font-semibold text-red-600`}>{fmt(saldoContrato(c))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })()
        )}

        {vista === 'equipos' && (
          (() => {
            const enObra = lineas.filter(l => l.estado === 'En obra')
            return enObra.length === 0 ? <div className="p-8 text-center text-gray-300 text-sm">No hay equipos en campo</div> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className={th}>Equipo</th><th className={th}>Cant.</th><th className={th}>Factura</th><th className={th}>Salida</th><th className={th}>Dev. est.</th>
                </tr></thead>
                <tbody>
                  {enObra.map(l => (
                    <tr key={l.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className={`${td} font-semibold`}>{l.nombre}</td>
                      <td className={td}>{l.cantidad}</td>
                      <td className={`${td} text-[#185FA5]`}>{facturaDoc(l.contrato_id)}</td>
                      <td className={`${td} text-gray-500`}>{l.fecha_salida || '—'}</td>
                      <td className={`${td} text-gray-500`}>{l.fecha_est_dev || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })()
        )}

        {vista === 'caja' && (
          movimientosCajaMes.length === 0 ? <div className="p-8 text-center text-gray-300 text-sm">Sin movimientos de caja en el último mes</div> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className={th}>Fecha</th><th className={th}>Documento</th><th className={th}>Concepto</th><th className={`${th} text-right`}>Ingreso</th><th className={`${th} text-right`}>Salida</th>
              </tr></thead>
              <tbody>
                {movimientosCajaMes.map((m, i) => (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className={`${td} text-gray-500`}>{m.fecha || '—'}</td>
                    <td className={`${td} text-[#185FA5]`}>{m.documento_id || '—'}</td>
                    <td className={td}>{m.descripcion || '—'}</td>
                    <td className={`${td} text-right font-semibold text-green-600`}>{m.ingreso ? fmt(m.ingreso) : ''}</td>
                    <td className={`${td} text-right font-semibold text-red-600`}>{m.salida ? fmt(m.salida) : ''}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className={`${td} font-bold`} colSpan={3}>SALDO EN CAJA</td>
                  <td className={`${td} text-right font-bold text-[#92400E]`} colSpan={2}>{fmt(saldoCaja)}</td>
                </tr>
              </tbody>
            </table>
          )
        )}
      </div>

    </div>
  )
}

export default Dashboard