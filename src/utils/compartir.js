import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// Genera un PDF a partir de un elemento HTML y lo comparte (o descarga).
// html: string con el contenido HTML del documento
// nombreArchivo: sin extensión (ej. 'factura-FC-001')
// mensaje: texto que acompaña al compartir
export async function compartirDocumento(html, nombreArchivo = 'documento', mensaje = '') {
  // Crear un contenedor temporal fuera de pantalla con el HTML
  const contenedor = document.createElement('div')
  contenedor.style.position = 'fixed'
  contenedor.style.left = '-9999px'
  contenedor.style.top = '0'
  contenedor.style.width = '800px'
  contenedor.style.background = 'white'
  contenedor.style.padding = '30px'
  contenedor.innerHTML = html
  document.body.appendChild(contenedor)

  try {
    // Esperar a que las imágenes (logo) carguen
    const imgs = contenedor.querySelectorAll('img')
    await Promise.all([...imgs].map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res })))

    const canvas = await html2canvas(contenedor, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')

    const pdf = new jsPDF('p', 'mm', 'a4')
    const anchoPDF = 210
    const altoPDF = (canvas.height * anchoPDF) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, anchoPDF, altoPDF)

    const blob = pdf.output('blob')
    const archivo = new File([blob], `${nombreArchivo}.pdf`, { type: 'application/pdf' })

    // Intentar compartir con la hoja del dispositivo (celular)
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: nombreArchivo, text: mensaje })
    } else {
      // En computador: descargar el PDF
      pdf.save(`${nombreArchivo}.pdf`)
    }
  } catch (e) {
    console.error('Error compartiendo:', e)
    alert('No se pudo generar el documento para compartir')
  } finally {
    document.body.removeChild(contenedor)
  }
}