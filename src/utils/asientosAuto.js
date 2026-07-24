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

// Asiento al crear una FACTURA DE ALQUILER
// Debito: 1305 Clientes
// Credito: 4175 Alquiler de Bienes Muebles
export async function asientoFactura(factura) {
  try {
    const codigo = await siguienteConsecutivo('AS')
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
// Debito: 1105 Caja General (o banco segun metodo)
// Credito: 1305 Clientes
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

// Asiento al crear COTIZACION DE MUEBLE aprobada
// Debito: 1305 Clientes
// Credito: 4120 Industrias Manufactureras
// Si hay anticipo, genera ademas un Recibo de Caja:
// Debito: 1105 Caja General / Credito: 1305 Clientes
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

    // Segundo asiento: anticipo recibido
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