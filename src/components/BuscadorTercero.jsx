import { useState, useEffect, useRef } from 'react'
import { supabase, empresaActiva } from '../supabase'

// Buscador de terceros reutilizable con filtro por nombre/cédula y creación rápida.
// Props:
//   value: id del tercero seleccionado
//   onChange: (id) => void  — se llama al elegir un tercero
//   terceros: lista de terceros (para no re-consultar; opcional)
//   onNuevoTercero: () => void  — opcional, si quieres recargar la lista tras crear uno
function BuscadorTercero({ value, onChange, terceros = [], onNuevoTercero }) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState(false)
  const [nuevo, setNuevo] = useState({ nombre: '', nit: '', tel: '', correo: '', dir: '' })
  const [guardando, setGuardando] = useState(false)
  const ref = useRef(null)

  // Mostrar el nombre del tercero seleccionado en el campo
  const seleccionado = terceros.find(t => t.id === value)

  useEffect(() => {
    function clickFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', clickFuera)
    return () => document.removeEventListener('mousedown', clickFuera)
  }, [])

  const filtrados = texto.trim()
    ? terceros.filter(t => {
        const q = texto.toLowerCase()
        return (t.nombre || '').toLowerCase().includes(q) || (t.nit || '').toLowerCase().includes(q)
      })
    : terceros

  function elegir(t) {
    onChange(t.id)
    setTexto('')
    setAbierto(false)
  }

  async function guardarNuevo() {
    if (!nuevo.nombre.trim()) return
    setGuardando(true)
    const { data, error } = await supabase.from('terceros')
      .insert([{ ...nuevo, empresa_id: empresaActiva() }])
      .select().single()
    setGuardando(false)
    if (error) { alert('Error: ' + error.message); return }
    if (onNuevoTercero) await onNuevoTercero()
    onChange(data.id)
    setCreando(false)
    setNuevo({ nombre: '', nit: '', tel: '', correo: '', dir: '' })
    setAbierto(false)
  }

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setAbierto(true)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer bg-white">
        {seleccionado ? (
          <span className="text-gray-800">{seleccionado.nombre} {seleccionado.nit ? `— ${seleccionado.nit}` : ''}</span>
        ) : (
          <span className="text-gray-400">— Seleccionar cliente —</span>
        )}
      </div>

      {abierto && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          <div className="p-2 sticky top-0 bg-white border-b border-gray-100">
            <input
              autoFocus
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Buscar por nombre o cédula..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>

          {!creando ? (
            <>
              {filtrados.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-400 text-center">Sin coincidencias</div>
              ) : filtrados.map(t => (
                <div key={t.id} onClick={() => elegir(t)}
                  className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                  <div className="font-semibold text-gray-800">{t.nombre}</div>
                  {t.nit && <div className="text-xs text-gray-400">{t.nit}</div>}
                </div>
              ))}
              <div onClick={() => setCreando(true)}
                className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer font-semibold border-t border-gray-100">
                + Crear tercero nuevo
              </div>
            </>
          ) : (
            <div className="p-3 space-y-2">
              <input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })}
                placeholder="Nombre *" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input value={nuevo.nit} onChange={e => setNuevo({ ...nuevo, nit: e.target.value })}
                placeholder="Cédula / NIT" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input value={nuevo.tel} onChange={e => setNuevo({ ...nuevo, tel: e.target.value })}
                placeholder="Teléfono" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input value={nuevo.correo} onChange={e => setNuevo({ ...nuevo, correo: e.target.value })}
                placeholder="Correo" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input value={nuevo.dir} onChange={e => setNuevo({ ...nuevo, dir: e.target.value })}
                placeholder="Dirección" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <div className="flex gap-2">
                <button onClick={guardarNuevo} disabled={guardando}
                  className="flex-1 px-3 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setCreando(false)}
                  className="px-3 py-2 text-gray-500 text-xs hover:text-gray-700">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default BuscadorTercero