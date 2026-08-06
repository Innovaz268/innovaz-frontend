import { useRef, useState, useEffect } from 'react'

// Panel de firma táctil reutilizable.
// onGuardar(dataURL): recibe la firma como imagen base64 (PNG)
// onCancelar(): cierra sin firmar
function PanelFirma({ titulo = 'Firma del cliente', onGuardar, onCancelar }) {
  const canvasRef = useRef(null)
  const [dibujando, setDibujando] = useState(false)
  const [vacio, setVacio] = useState(true)
  const [firmandoOrden, setFirmandoOrden] = useState(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1a1a1a'
  }, [])

  // Obtener coordenadas del evento (mouse o touch)
  const coords = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    }
  }

  const iniciar = (e) => {
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = coords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setDibujando(true)
    setVacio(false)
  }

  const mover = (e) => {
    if (!dibujando) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = coords(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const terminar = () => setDibujando(false)

  const limpiar = () => {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setVacio(true)
  }

  const guardar = () => {
    if (vacio) { alert('Por favor firme antes de guardar'); return }
    const dataURL = canvasRef.current.toDataURL('image/png')
    onGuardar(dataURL)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg p-4 max-w-md w-full">
        <h3 className="text-sm font-bold text-gray-700 mb-2">{titulo}</h3>
        <p className="text-xs text-gray-400 mb-2">Firme con el dedo o el mouse en el recuadro</p>
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className="border-2 border-gray-300 rounded-lg w-full touch-none bg-gray-50"
          onMouseDown={iniciar}
          onMouseMove={mover}
          onMouseUp={terminar}
          onMouseLeave={terminar}
          onTouchStart={iniciar}
          onTouchMove={mover}
          onTouchEnd={terminar}
        />
        <div className="flex justify-between gap-2 mt-3">
          <button onClick={limpiar}
            className="px-4 py-2 border border-gray-200 text-gray-500 text-xs font-semibold rounded-lg hover:bg-gray-50">
            Limpiar
          </button>
          <div className="flex gap-2">
            <button onClick={onCancelar}
              className="px-4 py-2 border border-gray-200 text-gray-500 text-xs font-semibold rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={guardar}
              className="px-5 py-2 bg-[#27500A] text-white text-xs font-bold rounded-lg hover:opacity-90">
              ✓ Guardar firma
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PanelFirma