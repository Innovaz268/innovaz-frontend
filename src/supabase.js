import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Devuelve el id de la empresa activa (guardado al iniciar sesión)
export function empresaActiva() {
  return localStorage.getItem('empresa_id')
}