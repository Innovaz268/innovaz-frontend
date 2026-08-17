import { supabase, empresaActiva } from '../supabase'

// Registra una acción en la auditoría del sistema.
// accion: 'creó' | 'editó' | 'eliminó' | 'pagó' | 'cambió estado' | etc.
// documentoTipo: 'Factura', 'Cotización', 'Pago', 'Orden', etc.
// documentoId: el número del documento (ej. 'FC-020')
// detalle: texto libre opcional con más contexto
export async function registrarAuditoria(accion, documentoTipo, documentoId, detalle = '') {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('auditoria').insert([{
      empresa_id: empresaActiva(),
      user_id: user?.id || null,
      user_email: user?.email || null,
      accion,
      documento_tipo: documentoTipo,
      documento_id: documentoId,
      detalle,
    }])
  } catch (e) {
    // La auditoría no debe romper la operación principal si falla
    console.error('Error al registrar auditoría:', e)
  }
}