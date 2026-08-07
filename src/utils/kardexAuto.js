import { supabase, empresaActiva } from '../supabase'

// Registra un movimiento en el kardex y actualiza el stock del equipo.
// tipo: 'Entrada' (compra, devolución) suma stock; 'Salida' (alquiler) resta.
export async function moverKardex({ equipo_id, tipo, cantidad, contrato_id = null, observacion = '' }) {
  try {
    const cant = parseInt(cantidad) || 0
    if (!equipo_id || cant <= 0) return { ok: false, msg: 'Datos de kardex incompletos' }

    const { error } = await supabase.from('kardex').insert([{
      equipo_id,
      tipo,
      cantidad: cant,
      fecha: new Date().toISOString().slice(0, 10),
      contrato_id,
      observacion,
      empresa_id: empresaActiva()
    }])
    if (error) { console.error('Error kardex:', error); return { ok: false, msg: error.message } }

    // Actualizar stock del equipo
    const { data: eq } = await supabase.from('equipos').select('stock').eq('id', equipo_id).single()
    if (eq) {
      const nuevoStock = tipo === 'Entrada'
        ? (eq.stock || 0) + cant
        : (eq.stock || 0) - cant
      await supabase.from('equipos').update({ stock: nuevoStock }).eq('id', equipo_id)
    }

    return { ok: true }
  } catch (e) {
    console.error('Error moviendo kardex:', e)
    return { ok: false, msg: 'Error inesperado' }
  }
}