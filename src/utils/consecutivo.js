import { supabase } from '../supabase'
 
export async function siguienteConsecutivo(prefijo) {
  const { data, error } = await supabase
    .from('consecutivos')
    .select('ultimo')
    .eq('prefijo', prefijo)
    .single()
 
  if (error) return prefijo + '-001'
 
  const siguiente = (data.ultimo || 0) + 1
 
  await supabase
    .from('consecutivos')
    .update({ ultimo: siguiente })
    .eq('prefijo', prefijo)
 
  return prefijo + '-' + String(siguiente).padStart(3, '0')
}
