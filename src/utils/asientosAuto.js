import { supabase } from '../supabase'
import { siguienteConsecutivo } from './consecutivo'

// Cuentas segun metodo de pago
function cuentaCaja(metodo) {
  const cuentas = {
    'Efectivo': { codigo: '1105', nombre: 'Caja General' },
    'Transferencia': { codigo: '1110', nombre: 'Bancos' },
    'Nequi': { codigo: '1110', nombre: 'Bancos' },
    'Daviplata': { codigo: '1110', nombre: 'Bancos' },
    'Cheque': { codigo: '1110', nombre: 'Bancos' },
    'Tarjeta': { codigo: '1110', nombre: 'Bancos' },
  }
  return cuentas[metodo] || { codigo: '1105', nombre: 'Caja General' }
}

// Cuenta de costo segun el tipo (auxiliares de 6120 Industrias Manufactureras)
function cuentaCosto(tipo) {
  const cuentas = {
    'Material': { codigo: '612005', nombre: 'Materia Prima' },
    'Mano de obra': { codigo: '612010', nombre: 'Mano de Obra' },
    'Transporte': { codigo: '612015', nombre: 'Costos Indirectos' },
    'Otro': { codigo: '612015', nombre: 'Costos Indirectos' },
  }
  return cuentas[tipo] || { codigo: '612015', nombre: 'Costos Indirectos' }
}

// Contrapartida segun como se pago el costo
function cuentaFuente(metodo) {
  const cuentas = {
    'Efectivo': { codigo: '1105', nombre: 'Caja General' },
    'Transferencia': { codigo: '1110', nombre: 'Bancos' },
    'Nequi': { codigo: '1110', nombre: 'Bancos' },
    'Daviplata': { codigo: '1110', nombre: 'Bancos' },
    'Credito': { codigo: '2205', nombre: 'Proveedores Nacionales' },
  }
  return cuentas[metodo] || { codigo: '1105', nombre: 'Caja General' }
}

// Asiento al crear una FACTURA DE ALQUILER
// Debito: 1305 Clientes / Credito: 4175 Alquiler de Bienes Muebles
export async function asientoFactura(factura) {
  try {
    const { data: asiento, error } = await supabase
      .from('asientos_contables')
      .insert([{
        fecha: factura.fecha_salida || new Date().toISOString().slice(0, 10),
        descripcion: 'Factura alquiler ' + (factura.id_doc || ''),
        tipo_doc: 'Factura',
        documento_id: factura.id_doc || ''
      }])
      .select()
      .single()

    if (error) { console.error('Error asiento factura:', error); return }

    await supabase.from('asientos_lineas').insert([
      {
        asiento_id: asiento.id,
        cuenta_codigo: '1305',
        cuenta_nombre: 'Clientes',
        debe: factura.total || 0,
        haber: 0,
        tercero_id: factura.cliente_id || ''
      },
      {
        asiento_id: asiento.id,
        cuenta_codigo: '4175',
        cuenta_nombre: 'Alquiler de Bienes Muebles',
        debe: 0,
        haber: factura.total || 0,
        tercero_id: factura.cliente_id || ''
      }
    ])
  } catch (e) {
    console.error('Error generando asiento factura:', e)
  }
}

// Asiento al registrar un PAGO EN CAJA
// Debito: 1105 Caja (o banco) / Credito: 1305 Clientes
export async function asientoPago(pago, clienteId) {
  try {
    const cuentaPago = cuentaCaja(pago.metodo)
    const { data: asiento, error } = await supabase
      .from('asientos_contables')
      .insert([{
        fecha: pago.fecha || new Date().toISOString().slice(0, 10),
        descripcion: (pago.concepto || 'Pago') + ' ' + (pago.id_doc || ''),
        tipo_doc: 'Recibo de Caja',
        documento_id: pago.id_doc || ''
      }])
      .select()
      .single()

    if (error) { console.error('Error asiento pago:', error); return }

    await supabase.from('asientos_lineas').insert([
      {
        asiento_id: asiento.id,
        cuenta_codigo: cuentaPago.codigo,
        cuenta_nombre: cuentaPago.nombre,
        debe: parseFloat(pago.monto) || 0,
        haber: 0,
        tercero_id: clienteId || ''
      },
      {
        asiento_id: asiento.id,
        cuenta_codigo: '1305',
        cuenta_nombre: 'Clientes',
        debe: 0,
        haber: parseFloat(pago.monto) || 0,
        tercero_id: clienteId || ''
      }
    ])
  } catch (e) {
    console.error('Error generando asiento pago:', e)
  }
}

// Asiento al aprobar una COTIZACION DE MUEBLE
// Debito: 1305 Clientes / Credito: 4120 Industrias Manufactureras
// Si hay anticipo: Debito 1105 Caja / Credito 1305 Clientes
export async function asientoMueble(cotizacion) {
  try {
    const { data: asiento, error } = await supabase
      .from('asientos_contables')
      .insert([{
        fecha: cotizacion.fecha || new Date().toISOString().slice(0, 10),
        descripcion: 'Venta mueble ' + (cotizacion.id_doc || ''),
        tipo_doc: 'Factura',
        documento_id: cotizacion.id_doc || ''
      }])
      .select()
      .single()

    if (error) { console.error('Error asiento mueble:', error); return }

    await supabase.from('asientos_lineas').insert([
      {
        asiento_id: asiento.id,
        cuenta_codigo: '1305',
        cuenta_nombre: 'Clientes',
        debe: cotizacion.total || 0,
        haber: 0,
        tercero_id: cotizacion.cliente_id || ''
      },
      {
        asiento_id: asiento.id,
        cuenta_codigo: '4120',
        cuenta_nombre: 'Industrias Manufactureras',
        debe: 0,
        haber: cotizacion.total || 0,
        tercero_id: cotizacion.cliente_id || ''
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
          cuenta_codigo: '1105',
          cuenta_nombre: 'Caja General',
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
// Debito: 612005 / 612010 / 612015 segun el tipo de costo
// Credito: 1105 Caja, 1110 Bancos o 2205 Proveedores segun como se pago
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
        documento_id: codigo
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
        tercero_id: c.proveedor_id || null
      })
      lineas.push({
        asiento_id: asiento.id,
        cuenta_codigo: cf.codigo,
        cuenta_nombre: cf.nombre,
        debe: 0,
        haber: valor,
        tercero_id: c.proveedor_id || null
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