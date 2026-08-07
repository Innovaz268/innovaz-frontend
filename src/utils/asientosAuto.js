import { supabase, empresaActiva } from '../supabase'
import { siguienteConsecutivo } from './consecutivo'

// Cuentas segun metodo de pago (NIIF)
function cuentaCaja(metodo) {
  const cuentas = {
    'Efectivo': { codigo: '110505', nombre: 'Caja general' },
    'Transferencia': { codigo: '1110', nombre: 'Bancos' },
    'Nequi': { codigo: '1110', nombre: 'Bancos' },
    'Daviplata': { codigo: '1110', nombre: 'Bancos' },
    'Cheque': { codigo: '1110', nombre: 'Bancos' },
    'Tarjeta': { codigo: '1110', nombre: 'Bancos' },
  }
  return cuentas[metodo] || { codigo: '110505', nombre: 'Caja general' }
}

// Cuenta de costo de produccion de muebles segun el tipo (auxiliares de 5110)
function cuentaCosto(tipo) {
  const cuentas = {
    'Material': { codigo: '511005', nombre: 'Materia prima' },
    'Mano de obra': { codigo: '511010', nombre: 'Mano de obra' },
    'Transporte': { codigo: '511015', nombre: 'Costos indirectos' },
    'Otro': { codigo: '511015', nombre: 'Costos indirectos' },
  }
  return cuentas[tipo] || { codigo: '511015', nombre: 'Costos indirectos' }
}

// Contrapartida segun como se pago el costo (NIIF)
function cuentaFuente(metodo) {
  const cuentas = {
    'Efectivo': { codigo: '110505', nombre: 'Caja general' },
    'Transferencia': { codigo: '1110', nombre: 'Bancos' },
    'Nequi': { codigo: '1110', nombre: 'Bancos' },
    'Daviplata': { codigo: '1110', nombre: 'Bancos' },
    'Credito': { codigo: '2205', nombre: 'Proveedores nacionales' },
  }
  return cuentas[metodo] || { codigo: '110505', nombre: 'Caja general' }
}

// Asiento al crear una FACTURA DE ALQUILER
// Debito: 1305 Clientes / Credito: 4105 Alquiler de equipos
export async function asientoFactura(factura) {
  try {
    const { data: asiento, error } = await supabase
      .from('asientos_contables')
      .insert([{
        fecha: factura.fecha_salida || new Date().toISOString().slice(0, 10),
        descripcion: 'Factura alquiler ' + (factura.id_doc || ''),
        tipo_doc: 'Factura',
        documento_id: factura.id_doc || '',
        empresa_id: empresaActiva()
      }])
      .select()
      .single()

    if (error) { console.error('Error asiento factura:', error); return }

    const emp = empresaActiva()
    await supabase.from('asientos_lineas').insert([
      {
        asiento_id: asiento.id,
        cuenta_codigo: '1305',
        cuenta_nombre: 'Clientes',
        debe: factura.total || 0,
        haber: 0,
        tercero_id: factura.cliente_id || '',
        empresa_id: emp
      },
      {
        asiento_id: asiento.id,
        cuenta_codigo: '4105',
        cuenta_nombre: 'Alquiler de equipos',
        debe: 0,
        haber: factura.total || 0,
        tercero_id: factura.cliente_id || '',
        empresa_id: emp
      }
    ])
  } catch (e) {
    console.error('Error generando asiento factura:', e)
  }
}

// Asiento al registrar un PAGO EN CAJA
// Debito: 110505 Caja (o banco) / Credito: 1305 Clientes
export async function asientoPago(pago, clienteId) {
  try {
    const cuentaPago = cuentaCaja(pago.metodo)
    const { data: asiento, error } = await supabase
      .from('asientos_contables')
      .insert([{
        fecha: pago.fecha || new Date().toISOString().slice(0, 10),
        descripcion: (pago.concepto || 'Pago') + ' ' + (pago.id_doc || ''),
        tipo_doc: 'Recibo de Caja',
        documento_id: pago.id_doc || '',
        empresa_id: empresaActiva()
      }])
      .select()
      .single()

    if (error) { console.error('Error asiento pago:', error); return }

    const emp = empresaActiva()
    await supabase.from('asientos_lineas').insert([
      {
        asiento_id: asiento.id,
        cuenta_codigo: cuentaPago.codigo,
        cuenta_nombre: cuentaPago.nombre,
        debe: parseFloat(pago.monto) || 0,
        haber: 0,
        tercero_id: clienteId || '',
        empresa_id: emp
      },
      {
        asiento_id: asiento.id,
        cuenta_codigo: '1305',
        cuenta_nombre: 'Clientes',
        debe: 0,
        haber: parseFloat(pago.monto) || 0,
        tercero_id: clienteId || '',
        empresa_id: emp
      }
    ])
  } catch (e) {
    console.error('Error generando asiento pago:', e)
  }
}

// Asiento al aprobar una COTIZACION DE MUEBLE
// Debito: 1305 Clientes / Credito: 4110 Fabricacion y venta de muebles
// Si hay anticipo: Debito 110505 Caja / Credito 1305 Clientes
export async function asientoMueble(cotizacion) {
  try {
    const { data: asiento, error } = await supabase
      .from('asientos_contables')
      .insert([{
        fecha: cotizacion.fecha || new Date().toISOString().slice(0, 10),
        descripcion: 'Venta mueble ' + (cotizacion.id_doc || ''),
        tipo_doc: 'Factura',
        documento_id: cotizacion.id_doc || '',
        empresa_id: empresaActiva()
      }])
      .select()
      .single()

    if (error) { console.error('Error asiento mueble:', error); return }

    const emp = empresaActiva()
    await supabase.from('asientos_lineas').insert([
      {
        asiento_id: asiento.id,
        cuenta_codigo: '1305',
        cuenta_nombre: 'Clientes',
        debe: cotizacion.total || 0,
        haber: 0,
        tercero_id: cotizacion.cliente_id || '',
        empresa_id: emp
      },
      {
        asiento_id: asiento.id,
        cuenta_codigo: '4110',
        cuenta_nombre: 'Fabricación y venta de muebles',
        debe: 0,
        haber: cotizacion.total || 0,
        tercero_id: cotizacion.cliente_id || '',
        empresa_id: emp
      }
    ])

    const anticipo = parseFloat(cotizacion.anticipo) || 0
    if (anticipo > 0) {
      const codigoRC = await siguienteConsecutivo('RC')
      const { data: asientoAnt, error: errAnt } = await supabase
        .from('asientos_contables')
        .insert([{
          fecha: cotizacion.fecha || new Date().toISOString().slice(0, 10),
          descripcion: 'Anticipo mueble ' + (cotizacion.id_doc || ''),
          tipo_doc: 'Recibo de Caja',
          documento_id: codigoRC
        }])
        .select()
        .single()

      if (errAnt) { console.error('Error asiento anticipo:', errAnt); return }

      await supabase.from('asientos_lineas').insert([
        {
          asiento_id: asientoAnt.id,
          cuenta_codigo: '110505',
          cuenta_nombre: 'Caja general',
          debe: anticipo,
          haber: 0,
          tercero_id: cotizacion.cliente_id || ''
        },
        {
          asiento_id: asientoAnt.id,
          cuenta_codigo: '1305',
          cuenta_nombre: 'Clientes',
          debe: 0,
          haber: anticipo,
          tercero_id: cotizacion.cliente_id || ''
        }
      ])
    }
  } catch (e) {
    console.error('Error generando asiento mueble:', e)
  }
}

// Asiento con los COSTOS ACUMULADOS de una orden de mueble
// Debito: 511005 / 511010 / 511015 segun el tipo de costo
// Credito: 110505 Caja, 1110 Bancos o 2205 Proveedores segun como se pago
export async function asientoCostosMueble(orden, costosOrden) {
  try {
    const total = costosOrden.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0)
    if (total <= 0) return { ok: false, msg: 'La orden no tiene costos registrados' }

    const codigo = await siguienteConsecutivo('CO')
    const { data: asiento, error } = await supabase
      .from('asientos_contables')
      .insert([{
        fecha: new Date().toISOString().slice(0, 10),
        descripcion: 'Costos orden mueble ' + codigo,
        tipo_doc: 'Comprobante de Costos',
        documento_id: codigo,
        empresa_id: empresaActiva()
      }])
      .select()
      .single()

    if (error) { console.error('Error asiento costos:', error); return { ok: false, msg: error.message } }

    const lineas = []
    costosOrden.forEach(c => {
      const cc = cuentaCosto(c.tipo)
      const cf = cuentaFuente(c.metodo_pago)
      const valor = parseFloat(c.valor) || 0
      lineas.push({
        asiento_id: asiento.id,
        cuenta_codigo: cc.codigo,
        cuenta_nombre: cc.nombre,
        debe: valor,
        haber: 0,
        tercero_id: c.proveedor_id || null,
        empresa_id: empresaActiva()
      })
      lineas.push({
        asiento_id: asiento.id,
        cuenta_codigo: cf.codigo,
        cuenta_nombre: cf.nombre,
        debe: 0,
        haber: valor,
        tercero_id: c.proveedor_id || null,
        empresa_id: empresaActiva()
      })
    })

    const { error: errLineas } = await supabase.from('asientos_lineas').insert(lineas)
    if (errLineas) { console.error('Error lineas costos:', errLineas); return { ok: false, msg: errLineas.message } }

    return { ok: true, msg: 'Asiento de costos generado: ' + codigo, codigo, total }
  } catch (e) {
    console.error('Error generando asiento de costos:', e)
    return { ok: false, msg: 'Error inesperado' }
  }
}
// Asiento al COMPRAR un equipo (NIIF)
// Debito: 1516 Maquinaria y equipo de alquiler
// Credito: segun forma de pago (contado/transferencia/credito/aporte socio)
export async function asientoCompraEquipo(equipo, formaPago, terceroId = null) {
  try {
    const costo = parseFloat(equipo.costo_compra) || 0
    const cantidad = parseInt(equipo.stock) || 1
    const total = costo * cantidad
    if (total <= 0) return { ok: false, msg: 'El equipo no tiene costo de compra' }

    const fuentes = {
      'Contado': { codigo: '110505', nombre: 'Caja general' },
      'Transferencia': { codigo: '1110', nombre: 'Bancos' },
      'Credito': { codigo: '2205', nombre: 'Proveedores nacionales' },
      'Aporte': { codigo: '2610', nombre: 'Cuentas por pagar a socios' },
    }
    const fuente = fuentes[formaPago] || fuentes['Contado']

    const codigo = await siguienteConsecutivo('CE')
    const { data: asiento, error } = await supabase
      .from('asientos_contables')
      .insert([{
        fecha: new Date().toISOString().slice(0, 10),
        descripcion: 'Compra equipo ' + (equipo.nombre || ''),
        tipo_doc: 'Comprobante de Compra',
        documento_id: codigo,
        empresa_id: empresaActiva()
      }])
      .select()
      .single()

    if (error) { console.error('Error asiento compra:', error); return { ok: false, msg: error.message } }

    const emp = empresaActiva()
    await supabase.from('asientos_lineas').insert([
      {
        asiento_id: asiento.id,
        cuenta_codigo: '1516',
        cuenta_nombre: 'Maquinaria y equipo de alquiler',
        debe: total,
        haber: 0,
        tercero_id: terceroId,
        empresa_id: emp
      },
      {
        asiento_id: asiento.id,
        cuenta_codigo: fuente.codigo,
        cuenta_nombre: fuente.nombre,
        debe: 0,
        haber: total,
        tercero_id: terceroId,
        empresa_id: emp
      }
    ])

    return { ok: true, msg: 'Asiento de compra generado: ' + codigo, codigo, total }
  } catch (e) {
    console.error('Error generando asiento de compra:', e)
    return { ok: false, msg: 'Error inesperado' }
  }
}