import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const INNOVAZ_ID = '198aab8f-f37d-456c-956a-5bf273c72cf0'

function Empresas() {
  const [editandoId, setEditandoId] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [form, setForm] = useState({
    nombre: '', eslogan: '', nit: '', telefonos: '', direccion: '', logo_url: '', color: '#185FA5'
  })

  useEffect(() => { cargar() }, [])

 async function cargar() {
    const { data } = await supabase.from('empresas').select('*').order('nombre')
    setEmpresas(data || [])
  } 

  async function crearEmpresa() {
    if (!form.nombre.trim()) { setMensaje('El nombre es obligatorio'); return }
    setGuardando(true)
    setMensaje('')

    // Si estamos editando, actualizar y salir
    if (editandoId) {
      const { error: errUpd } = await supabase.from('empresas').update(form).eq('id', editandoId)
      if (errUpd) { setMensaje('Error: ' + errUpd.message); setGuardando(false); return }
      setMensaje('✓ Empresa actualizada')
      setForm({ nombre: '', eslogan: '', nit: '', telefonos: '', direccion: '', logo_url: '', color: '#185FA5' })
      setMostrarForm(false)
      setEditandoId(null)
      await cargar()
      setGuardando(false)
      return
    }

    // 1. Crear la empresa
    const { data: nueva, error } = await supabase.from('empresas').insert([form]).select().single()
    if (error) { setMensaje('Error: ' + error.message); setGuardando(false); return }

    // 2. Copiar el catálogo de cuentas base (el de INNOVAZ) a la nueva empresa
    const { data: cuentasBase } = await supabase.from('puc_cuentas').select('*').eq('empresa_id', INNOVAZ_ID)
    if (cuentasBase && cuentasBase.length > 0) {
      const copia = cuentasBase.map(c => {
        const { id, created_at, ...resto } = c
        return { ...resto, empresa_id: nueva.id }
      })
      await supabase.from('puc_cuentas').insert(copia)
    }
    // 3. Crear el tercero genérico "Cliente cotización" para esta empresa
    await supabase.from('terceros').insert([{
      nombre: 'Cliente cotización',
      clase: 'Cliente',
      empresa_id: nueva.id,
    }])

    setMensaje('✓ Empresa creada: ' + nueva.nombre + ' (con catálogo de cuentas)')
    setForm({ nombre: '', eslogan: '', nit: '', telefonos: '', direccion: '', logo_url: '', color: '#185FA5' })
    setMostrarForm(false)
    await cargar()
    setGuardando(false)
  }
  async function toggleModulo(empresa, modulo) {
    const actuales = empresa.modulos || []
    const nuevos = actuales.includes(modulo)
      ? actuales.filter(m => m !== modulo)
      : [...actuales, modulo]
    const { error } = await supabase.from('empresas').update({ modulos: nuevos }).eq('id', empresa.id)
    if (error) { setMensaje('Error: ' + error.message); return }
    await cargar()
  }
  function abrirEditar(e) {
    setEditandoId(e.id)
    setForm({
      nombre: e.nombre || '', eslogan: e.eslogan || '', nit: e.nit || '',
      telefonos: e.telefonos || '', direccion: e.direccion || '',
      logo_url: e.logo_url || '', color: e.color || '#185FA5'
    })
    setMostrarForm(true)
    setMensaje('')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 mt-2">
        <div>
          <h2 className="text-xl font-bold text-[#185FA5]">🏢 Empresas</h2>
          <p className="text-xs text-gray-400">Administración de empresas del sistema</p>
        </div>
        <button onClick={() => { setMostrarForm(!mostrarForm); setMensaje('') }}
          className="px-4 py-2 btn-empresa text-white text-xs font-bold rounded-lg hover:opacity-90">
          {mostrarForm ? 'Cancelar' : '+ Nueva empresa'}
        </button>
      </div>

      {mensaje && (
        <div className={`mb-3 p-3 rounded-lg text-sm font-semibold ${mensaje.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {mensaje}
        </div>
      )}

      {mostrarForm && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Nueva empresa</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Eslogan</label>
              <input value={form.eslogan} onChange={e => setForm({...form, eslogan: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">NIT / Cédula jurídica</label>
              <input value={form.nit} onChange={e => setForm({...form, nit: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Teléfonos</label>
              <input value={form.telefonos} onChange={e => setForm({...form, telefonos: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Dirección</label>
              <input value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">URL del logo</label>
              <input value={form.logo_url} onChange={e => setForm({...form, logo_url: e.target.value})}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Color de acento</label>
              <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})}
                className="w-full h-10 px-1 py-1 border border-gray-200 rounded-lg" />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={crearEmpresa} disabled={guardando}
              className="px-6 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
              {guardando ? 'Creando...' : 'Crear empresa'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Al crear, se le copia el catálogo de cuentas NIIF base para que arranque lista.</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Empresa</th>
              <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">NIT</th>
              <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Módulos activos</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map(e => (
              <tr key={e.id} className="border-t border-gray-50">
                <td className="px-4 py-2 font-semibold text-xs">
                  {e.nombre}
                  <button onClick={() => abrirEditar(e)} className="ml-2 text-xs text-blue-400 hover:text-blue-600 font-normal">✏️ editar</button>
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">{e.nit || '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={(e.modulos || []).includes('alquiler')}
                        onChange={() => toggleModulo(e, 'alquiler')} />
                      🔧 Alquiler
                    </label>
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={(e.modulos || []).includes('muebles')}
                        onChange={() => toggleModulo(e, 'muebles')} />
                      🪵 Muebles
                    </label>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Empresas