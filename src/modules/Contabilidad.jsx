import { useState, useEffect } from 'react'
import { supabase, empresaActiva } from '../supabase'

function Contabilidad() {
  const [vista, setVista] = useState('libro')
  const [asientos, setAsientos] = useState([])
  const [puc, setPuc] = useState([])
  const [terceros, setTerceros] = useState([])
  const [kardex, setKardex] = useState([])
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mostrarFormPuc, setMostrarFormPuc] = useState(false)
  const [mostrarFormAsiento, setMostrarFormAsiento] = useState(false)
  const [busquedaPuc, setBusquedaPuc] = useState('')

  const [formPuc, setFormPuc] = useState({
    codigo: '', nombre: '', tipo: 'ACTIVO', grupo: '', naturaleza: 'debito', nivel: 3, cuenta_padre: '', sistema: false
  })

  const [editandoAsientoId, setEditandoAsientoId] = useState(null)
  const [formAsiento, setFormAsiento] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: '',
    tipo_doc: 'Manual',
    documento_id: '',
    lineas: [
      { cuenta_codigo: '', cuenta_nombre: '', debe: 0, haber: 0, tercero_id: '' },
      { cuenta_codigo: '', cuenta_nombre: '', debe: 0, haber: 0, tercero_id: '' }
    ]
  })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: asi }, { data: pc }, { data: trcs }, { data: kdx }, { data: eqs }] = await Promise.all([
      supabase.from('asientos_contables').select('*, asientos_lineas(*)').order('fecha', { ascending: false }),
      supabase.from('puc_cuentas').select('*').order('codigo'),
      supabase.from('terceros').select('id, nombre').order('nombre'),
      supabase.from('kardex').select('*, equipos(nombre)').order('fecha', { ascending: false }),
      supabase.from('equipos').select('id, nombre, stock').order('nombre'),
    ])
    setAsientos(asi || [])
    setPuc(pc || [])
    setTerceros(trcs || [])
    setKardex(kdx || [])
    setEquipos(eqs || [])
    setLoading(false)
  }

  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')
  const nombreCliente = id => terceros.find(t => t.id === id)?.nombre || '---'

  // ── PUC ──
  async function guardarCuenta() {
    if (!formPuc.codigo || !formPuc.nombre) { setMensaje('Codigo y nombre son obligatorios'); return }
    setGuardando(true)
    const { error } = await supabase.from('puc_cuentas').upsert([{ ...formPuc, empresa_id: empresaActiva() }])
    if (error) { setMensaje('Error: ' + error.message); setGuardando(false); return }
    setMensaje('Cuenta guardada correctamente')
    setFormPuc({ codigo: '', nombre: '', tipo: 'ACTIVO', grupo: '', naturaleza: 'debito', nivel: 3, cuenta_padre: '', sistema: false })
    setMostrarFormPuc(false)
    await cargarDatos()
    setGuardando(false)
  }

  async function eliminarCuenta(codigo) {
    const cuenta = puc.find(p => p.codigo === codigo)
    if (cuenta?.sistema) { setMensaje('No se puede eliminar una cuenta del sistema'); return }
    if (!window.confirm('Eliminar esta cuenta?')) return
    await supabase.from('puc_cuentas').delete().eq('codigo', codigo)
    await cargarDatos()
  }

  const pucFiltrado = puc.filter(p =>
    p.codigo.includes(busquedaPuc) ||
    p.nombre.toLowerCase().includes(busquedaPuc.toLowerCase())
  )

  // ── ASIENTOS ──
  function agregarLinea() {
    setFormAsiento({ ...formAsiento, lineas: [...formAsiento.lineas, { cuenta_codigo: '', cuenta_nombre: '', debe: 0, haber: 0, tercero_id: '' }] })
  }

  function actualizarLinea(i, campo, valor) {
    const lineas = [...formAsiento.lineas]
    lineas[i] = { ...lineas[i], [campo]: valor }
    if (campo === 'cuenta_codigo') {
      const cuenta = puc.find(p => p.codigo === valor)
      if (cuenta) lineas[i].cuenta_nombre = cuenta.nombre
    }
    setFormAsiento({ ...formAsiento, lineas })
  }

  function eliminarLinea(i) {
    if (formAsiento.lineas.length <= 2) { setMensaje('Un asiento debe tener minimo 2 lineas'); return }
    setFormAsiento({ ...formAsiento, lineas: formAsiento.lineas.filter((_, idx) => idx !== i) })
  }

  const totalDebe = formAsiento.lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0)
  const totalHaber = formAsiento.lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0)
  const asientoBalanceado = Math.abs(totalDebe - totalHaber) < 0.01

    function abrirEditarAsiento(a) {
    setEditandoAsientoId(a.id)
    setFormAsiento({
      fecha: a.fecha || new Date().toISOString().slice(0, 10),
      descripcion: a.descripcion || '',
      tipo_doc: a.tipo_doc || 'Manual',
      documento_id: a.documento_id || '',
      lineas: (a.asientos_lineas || []).map(l => ({
        cuenta_codigo: l.cuenta_codigo || '',
        cuenta_nombre: l.cuenta_nombre || '',
        debe: l.debe || 0,
        haber: l.haber || 0,
        tercero_id: l.tercero_id || '',
      })),
    })
    setMostrarFormAsiento(true)
    setMensaje('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function guardarAsiento() {
    if (!formAsiento.descripcion) { setMensaje('La descripcion es obligatoria'); return }
    if (!asientoBalanceado) { setMensaje('El asiento no cuadra: Debe ' + fmt(totalDebe) + ' Haber ' + fmt(totalHaber)); return }
        setGuardando(true)

    if (editandoAsientoId) {
      // EDICIÓN: actualizar cabecera, borrar líneas viejas y recrear
      const { error: errUpd } = await supabase.from('asientos_contables').update({
        fecha: formAsiento.fecha,
        descripcion: formAsiento.descripcion,
        tipo_doc: formAsiento.tipo_doc,
        documento_id: formAsiento.documento_id,
      }).eq('id', editandoAsientoId)
      if (errUpd) { setMensaje('Error: ' + errUpd.message); setGuardando(false); return }
      await supabase.from('asientos_lineas').delete().eq('asiento_id', editandoAsientoId)
      const lineasEd = formAsiento.lineas.map(l => ({ ...l, asiento_id: editandoAsientoId, debe: parseFloat(l.debe) || 0, haber: parseFloat(l.haber) || 0, empresa_id: empresaActiva() }))
      const { error: errLin } = await supabase.from('asientos_lineas').insert(lineasEd)
      if (errLin) { setMensaje('Error en lineas: ' + errLin.message); setGuardando(false); return }
      setMensaje('Asiento actualizado correctamente')
    } else {
      const { data: asiento, error } = await supabase.from('asientos_contables').insert([{
        fecha: formAsiento.fecha,
        descripcion: formAsiento.descripcion,
        tipo_doc: formAsiento.tipo_doc,
        documento_id: formAsiento.documento_id,
        empresa_id: empresaActiva()
      }]).select().single()
      if (error) { setMensaje('Error: ' + error.message); setGuardando(false); return }
      const lineas = formAsiento.lineas.map(l => ({ ...l, asiento_id: asiento.id, debe: parseFloat(l.debe) || 0, haber: parseFloat(l.haber) || 0, empresa_id: empresaActiva() }))
      const { error: err2 } = await supabase.from('asientos_lineas').insert(lineas)
      if (err2) { setMensaje('Error en lineas: ' + err2.message); setGuardando(false); return }
      setMensaje('Asiento registrado correctamente')
    }
    setFormAsiento({ fecha: new Date().toISOString().slice(0, 10), descripcion: '', tipo_doc: 'Manual', documento_id: '', lineas: [{ cuenta_codigo: '', cuenta_nombre: '', debe: 0, haber: 0, tercero_id: '' }, { cuenta_codigo: '', cuenta_nombre: '', debe: 0, haber: 0, tercero_id: '' }] })
    setEditandoAsientoId(null)
    setMostrarFormAsiento(false)
    await cargarDatos()
    setGuardando(false)
  }

  async function eliminarAsiento(id) {
    if (!window.confirm('Eliminar este asiento?')) return
    await supabase.from('asientos_lineas').delete().eq('asiento_id', id)
    await supabase.from('asientos_contables').delete().eq('id', id)
    await cargarDatos()
  }

  // ── KARDEX ──
  const [formKardex, setFormKardex] = useState({ equipo_id: '', tipo: 'Entrada', cantidad: 1, fecha: new Date().toISOString().slice(0, 10), observacion: '' })
  const [mostrarFormKardex, setMostrarFormKardex] = useState(false)
  const [equipoKardex, setEquipoKardex] = useState('')

  async function guardarKardex() {
    if (!formKardex.equipo_id) { setMensaje('Seleccione un equipo'); return }
    setGuardando(true)
    const { error } = await supabase.from('kardex').insert([{ ...formKardex, empresa_id: empresaActiva() }])
    if (error) { setMensaje('Error: ' + error.message); setGuardando(false); return }
    const equipo = equipos.find(e => e.id === formKardex.equipo_id)
    if (equipo) {
      const nuevoStock = formKardex.tipo === 'Entrada'
        ? (equipo.stock || 0) + parseInt(formKardex.cantidad)
        : (equipo.stock || 0) - parseInt(formKardex.cantidad)
      await supabase.from('equipos').update({ stock: nuevoStock }).eq('id', formKardex.equipo_id)
    }
    setMensaje('Movimiento de kardex registrado')
    setFormKardex({ equipo_id: '', tipo: 'Entrada', cantidad: 1, fecha: new Date().toISOString().slice(0, 10), observacion: '' })
    setMostrarFormKardex(false)
    await cargarDatos()
    setGuardando(false)
  }

  const tipoColor = tipo => tipo === 'Entrada' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'

  return (
    <div className="max-w-5xl mx-auto">

      <div className="flex items-center justify-between mb-4 mt-2 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-[#185FA5]">Contabilidad PUC</h2>
          <p className="text-xs text-gray-400">Plan Unico de Cuentas Colombia</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['libro', 'puc', 'kardex'].map(v => (
            <button key={v} onClick={() => { setVista(v); setMensaje('') }}
              className={`px-3 py-2 text-xs font-bold rounded-lg capitalize ${vista === v ? 'bg-[#185FA5] text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
              {v === 'libro' ? 'Libro Diario' : v === 'puc' ? 'Plan de Cuentas' : 'Kardex'}
            </button>
          ))}
        </div>
      </div>

      {mensaje && (
        <div className={`mb-3 p-3 rounded-lg text-sm font-semibold ${mensaje.includes('Error') || mensaje.includes('cuadra') || mensaje.includes('minimo') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {mensaje}
        </div>
      )}

      {/* ── LIBRO DIARIO ── */}
      {vista === 'libro' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => { setMostrarFormAsiento(!mostrarFormAsiento); setMensaje('') }}
              className="px-4 py-2 btn-empresa text-white text-xs font-bold rounded-lg hover:opacity-90">
              {mostrarFormAsiento ? 'Cancelar' : '+ Nuevo Asiento'}
            </button>
          </div>

          {mostrarFormAsiento && (
            <div className="card p-4 mb-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Nuevo Asiento Contable</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha</label>
                  <input type="date" value={formAsiento.fecha} onChange={e => setFormAsiento({ ...formAsiento, fecha: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo documento</label>
                  <select value={formAsiento.tipo_doc} onChange={e => setFormAsiento({ ...formAsiento, tipo_doc: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                    <option>Manual</option>
                    <option>Factura</option>
                    <option>Recibo de Caja</option>
                    <option>Nota Debito</option>
                    <option>Nota Credito</option>
                    <option>Egreso</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">No. Documento</label>
                  <input value={formAsiento.documento_id} onChange={e => setFormAsiento({ ...formAsiento, documento_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                    placeholder="FC-001" />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Descripcion</label>
                  <input value={formAsiento.descripcion} onChange={e => setFormAsiento({ ...formAsiento, descripcion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                    placeholder="Concepto del asiento contable" />
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700">Lineas del asiento (doble entrada)</label>
                  <button onClick={agregarLinea} className="text-xs px-3 py-1 bg-[#185FA5] text-white rounded-lg">+ Linea</button>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left text-gray-500">Cuenta</th>
                      <th className="px-2 py-1 text-left text-gray-500">Tercero</th>
                      <th className="px-2 py-1 text-left text-gray-500">Debe</th>
                      <th className="px-2 py-1 text-left text-gray-500">Haber</th>
                      <th className="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formAsiento.lineas.map((linea, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-2 py-1">
                          <select value={linea.cuenta_codigo} onChange={e => actualizarLinea(i, 'cuenta_codigo', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs">
                            <option value="">Seleccionar cuenta</option>
                              {puc.filter(p => (p.nivel === 'cuenta' || p.nivel === 'auxiliar') && p.activa !== false && !puc.some(h => h.codigo !== p.codigo && h.codigo.startsWith(p.codigo))).map(p => (
                              <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.nombre}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select value={linea.tercero_id} onChange={e => actualizarLinea(i, 'tercero_id', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs">
                            <option value="">Sin tercero</option>
                            {terceros.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1"><input type="number" value={linea.debe} onChange={e => actualizarLinea(i, 'debe', e.target.value)} className="w-24 px-2 py-1 border border-gray-200 rounded text-xs" /></td>
                        <td className="px-2 py-1"><input type="number" value={linea.haber} onChange={e => actualizarLinea(i, 'haber', e.target.value)} className="w-24 px-2 py-1 border border-gray-200 rounded text-xs" /></td>
                        <td className="px-2 py-1"><button onClick={() => eliminarLinea(i)} className="text-red-400 hover:text-red-600">x</button></td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="px-2 py-1 font-bold text-xs" colSpan={2}>TOTALES</td>
                      <td className="px-2 py-1 font-bold text-xs text-[#185FA5]">{fmt(totalDebe)}</td>
                      <td className="px-2 py-1 font-bold text-xs text-[#185FA5]">{fmt(totalHaber)}</td>
                      <td className="px-2 py-1 text-xs">{asientoBalanceado ? <span className="text-green-600 font-bold">OK</span> : <span className="text-red-600 font-bold">No cuadra</span>}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <button onClick={guardarAsiento} disabled={guardando || !asientoBalanceado}
                  className="px-6 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Registrar asiento'}
                </button>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-300 text-sm">Cargando...</div>
            ) : asientos.length === 0 ? (
              <div className="p-8 text-center text-gray-300 text-sm">No hay asientos registrados</div>
            ) : asientos.map(a => (
              <div key={a.id} className="border-b border-gray-50 p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold text-gray-700">{a.fecha}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{a.tipo_doc}</span>
                    {a.documento_id && <span className="ml-1 text-xs text-gray-400">{a.documento_id}</span>}
                  </div>
                                    <div className="flex gap-2">
                  <button onClick={() => abrirEditarAsiento(a)} className="text-xs text-blue-400 hover:text-blue-600">✏️ editar</button>
                  <button onClick={() => eliminarAsiento(a.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-2">{a.descripcion}</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="text-left py-0.5">Cuenta</th>
                      <th className="text-left py-0.5">Tercero</th>
                      <th className="text-right py-0.5">Debe</th>
                      <th className="text-right py-0.5">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(a.asientos_lineas || []).map((l, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="py-0.5">{l.cuenta_codigo} - {l.cuenta_nombre}</td>
                        <td className="py-0.5 text-gray-400">{nombreCliente(l.tercero_id)}</td>
                        <td className="py-0.5 text-right font-semibold">{l.debe > 0 ? fmt(l.debe) : ''}</td>
                        <td className="py-0.5 text-right font-semibold text-gray-500">{l.haber > 0 ? fmt(l.haber) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PLAN DE CUENTAS ── */}
      {vista === 'puc' && (
        <div>
          <div className="flex gap-2 mb-3">
            <input value={busquedaPuc} onChange={e => setBusquedaPuc(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5] bg-white"
              placeholder="Buscar por codigo o nombre..." />
            <button onClick={() => { setMostrarFormPuc(!mostrarFormPuc); setMensaje('') }}
              className="px-4 py-2 btn-empresa text-white text-xs font-bold rounded-lg hover:opacity-90">
              {mostrarFormPuc ? 'Cancelar' : '+ Nueva cuenta'}
            </button>
          </div>

          {mostrarFormPuc && (
            <div className="card p-4 mb-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Nueva cuenta PUC</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Codigo</label>
                  <input value={formPuc.codigo} onChange={e => setFormPuc({ ...formPuc, codigo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                    placeholder="Ej: 110510" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre</label>
                  <input value={formPuc.nombre} onChange={e => setFormPuc({ ...formPuc, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                    placeholder="Nombre de la cuenta" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                  <select value={formPuc.tipo} onChange={e => setFormPuc({ ...formPuc, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                    <option>ACTIVO</option>
                    <option>PASIVO</option>
                    <option>PATRIMONIO</option>
                    <option>INGRESO</option>
                    <option>GASTO</option>
                    <option>COSTO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Naturaleza</label>
                  <select value={formPuc.naturaleza} onChange={e => setFormPuc({ ...formPuc, naturaleza: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                    <option value="debito">Debito</option>
                    <option value="credito">Credito</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nivel</label>
                  <select value={formPuc.nivel} onChange={e => setFormPuc({ ...formPuc, nivel: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                    <option value={1}>1 - Clase</option>
                    <option value={2}>2 - Grupo</option>
                    <option value={3}>3 - Cuenta</option>
                    <option value={4}>4 - Subcuenta</option>
                    <option value={5}>5 - Auxiliar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Cuenta padre</label>
                  <select value={formPuc.cuenta_padre} onChange={e => setFormPuc({ ...formPuc, cuenta_padre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                    <option value="">Sin cuenta padre</option>
                    {puc.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={guardarCuenta} disabled={guardando}
                  className="px-6 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Guardar cuenta'}
                </button>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Codigo</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Nombre</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Tipo</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Naturaleza</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Nivel</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pucFiltrado.map(p => (
                  <tr key={p.codigo} className={`border-t border-gray-50 hover:bg-gray-50 ${p.nivel === 1 ? 'bg-[#185FA5] bg-opacity-5' : p.nivel === 2 ? 'bg-gray-50' : ''}`}>
                    <td className="px-4 py-1.5">
                      <span className={`font-mono text-xs font-bold ${p.nivel === 1 ? 'text-[#185FA5]' : p.nivel === 2 ? 'text-[#5B21B6]' : 'text-gray-700'}`}
                        style={{ paddingLeft: `${(p.nivel - 1) * 12}px` }}>
                        {p.codigo}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-xs" style={{ paddingLeft: `${(p.nivel - 1) * 12 + 16}px` }}>{p.nombre}</td>
                    <td className="px-4 py-1.5 text-xs text-gray-500">{p.tipo}</td>
                    <td className="px-4 py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.naturaleza === 'debito' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                        {p.naturaleza}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-xs text-gray-400">{p.nivel}</td>
                    <td className="px-4 py-1.5 text-right">
                      {!p.sistema && (
                        <button onClick={() => eliminarCuenta(p.codigo)} className="text-xs text-red-400 hover:text-red-600">x</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── KARDEX ── */}
      {vista === 'kardex' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => { setMostrarFormKardex(!mostrarFormKardex); setMensaje('') }}
              className="px-4 py-2 btn-empresa text-white text-xs font-bold rounded-lg hover:opacity-90">
              {mostrarFormKardex ? 'Cancelar' : '+ Movimiento'}
            </button>
          </div>

          {mostrarFormKardex && (
            <div className="card p-4 mb-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Nuevo movimiento de inventario</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Equipo</label>
                  <select value={formKardex.equipo_id} onChange={e => setFormKardex({ ...formKardex, equipo_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                    <option value="">Seleccionar equipo</option>
                    {equipos.map(e => <option key={e.id} value={e.id}>{e.nombre} (Stock: {e.stock || 0})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                  <select value={formKardex.tipo} onChange={e => setFormKardex({ ...formKardex, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
                    <option>Entrada</option>
                    <option>Salida</option>
                    <option>Ajuste</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Cantidad</label>
                  <input type="number" value={formKardex.cantidad} onChange={e => setFormKardex({ ...formKardex, cantidad: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                    min="1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha</label>
                  <input type="date" value={formKardex.fecha} onChange={e => setFormKardex({ ...formKardex, fecha: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Observacion</label>
                  <input value={formKardex.observacion} onChange={e => setFormKardex({ ...formKardex, observacion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]"
                    placeholder="Compra, devolucion, ajuste de inventario..." />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={guardarKardex} disabled={guardando}
                  className="px-6 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Registrar movimiento'}
                </button>
              </div>
            </div>
          )}

          {/* Selector de equipo */}
          <div className="card p-4 mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Seleccione un equipo para ver su kardex</label>
            <select value={equipoKardex} onChange={e => setEquipoKardex(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#185FA5]">
              <option value="">— Todos los equipos (resumen) —</option>
              {equipos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>

          {!equipoKardex ? (
            /* Resumen: tarjetas de todos los equipos */
            <div className="grid grid-cols-3 gap-3">
              {equipos.map(e => {
                const movs = kardex.filter(k => k.equipo_id === e.id)
                return (
                  <div key={e.id} onClick={() => setEquipoKardex(e.id)}
                    className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm cursor-pointer hover:border-[#185FA5]">
                    <div className="text-xs font-bold text-gray-700">{e.nombre}</div>
                    <div className={`text-2xl font-bold mt-1 ${(e.stock || 0) > 0 ? 'text-[#27500A]' : 'text-red-600'}`}>{e.stock || 0}</div>
                    <div className="text-xs text-gray-400">unidades · {movs.length} movs</div>
                  </div>
                )
              })}
            </div>
          ) : (
            (() => {
              const eq = equipos.find(e => e.id === equipoKardex)
              const movs = kardex.filter(k => k.equipo_id === equipoKardex)
                .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
              const entradas = movs.filter(m => m.tipo === 'Entrada').reduce((s, m) => s + (parseInt(m.cantidad) || 0), 0)
              const salidas = movs.filter(m => m.tipo === 'Salida').reduce((s, m) => s + (parseInt(m.cantidad) || 0), 0)
              let saldo = 0
              return (
                <div>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="text-xs text-gray-400">Stock actual</div>
                      <div className={`text-2xl font-bold ${(eq?.stock || 0) > 0 ? 'text-[#27500A]' : (eq?.stock || 0) < 0 ? 'text-amber-600' : 'text-red-600'}`}>{eq?.stock || 0}</div>
                      {(eq?.stock || 0) < 0 && (
                        <div className="text-xs text-amber-600 mt-0.5" title="Stock negativo: hay equipo prestado de terceros en alquiler. No es un error.">🔄 prestado</div>
                      )}
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="text-xs text-gray-400">Entradas</div>
                      <div className="text-2xl font-bold text-green-600">{entradas}</div>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="text-xs text-gray-400">Salidas</div>
                      <div className="text-2xl font-bold text-red-600">{salidas}</div>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="text-xs text-gray-400">Movimientos</div>
                      <div className="text-2xl font-bold text-[#185FA5]">{movs.length}</div>
                    </div>
                  </div>

                  <div className="card overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <span className="text-sm font-bold text-gray-700">Kardex de {eq?.nombre}</span>
                    </div>
                    {movs.length === 0 ? (
                      <div className="p-8 text-center text-gray-300 text-sm">Sin movimientos registrados</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Fecha</th>
                            <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Tipo</th>
                            <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Entrada</th>
                            <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Salida</th>
                            <th className="px-4 py-2 text-right text-xs text-gray-500 font-semibold">Saldo</th>
                            <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Observación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movs.map(k => {
                            const cant = parseInt(k.cantidad) || 0
                            saldo += k.tipo === 'Entrada' ? cant : -cant
                            return (
                              <tr key={k.id} className="border-t border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-2 text-xs text-gray-500">{k.fecha}</td>
                                <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tipoColor(k.tipo)}`}>{k.tipo}</span></td>
                                <td className="px-4 py-2 text-xs text-right text-green-700">{k.tipo === 'Entrada' ? cant : ''}</td>
                                <td className="px-4 py-2 text-xs text-right text-red-700">{k.tipo === 'Salida' ? cant : ''}</td>
                                <td className="px-4 py-2 text-xs text-right font-bold">{saldo}</td>
                                <td className="px-4 py-2 text-xs text-gray-500">{k.observacion || '---'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )
            })()
          )}
        </div>
      )}
    </div>
  )
}

export default Contabilidad