// Membrete reutilizable para documentos e informes imprimibles de INNOVAZ
const LOGO = 'https://kdfoptwfvqyexhcgllyt.supabase.co/storage/v1/object/public/publico/InnovazLogo.png'

export const EMPRESA = {
  nombre: 'INNOVAZ',
  eslogan: 'Alquiler y Construcción · Diseño y Acabados',
  telefonos: '8784-8941 / 8908-6712',
  direccion: 'San José, Costa Rica — Desamparados, San Juan de Dios, Diagonal a cementerio',
  // NIT y demás datos se agregan aquí cuando estén disponibles
}

// Devuelve el HTML del encabezado con logo y datos de la empresa.
// color: color de acento (ej. '#185FA5' para informes, '#5B21B6' para muebles)
export function membreteHTML(color = '#185FA5') {
  return `
    <div style="display:flex;align-items:center;gap:20px;border-bottom:3px solid ${color};padding-bottom:15px;">
      <img src="${LOGO}" alt="INNOVAZ" style="height:80px;object-fit:contain;">
      <div style="flex:1;">
        <h1 style="margin:0;color:${color};font-size:22px;">${EMPRESA.nombre}</h1>
        <p style="margin:2px 0;font-size:11px;color:#555;"><em>${EMPRESA.eslogan}</em></p>
        <p style="margin:2px 0;font-size:11px;color:#555;">Tel: ${EMPRESA.telefonos}</p>
        <p style="margin:2px 0;font-size:11px;color:#555;">${EMPRESA.direccion}</p>
      </div>
    </div>`
}

// Abre una ventana imprimible con el membrete + el contenido que se le pase.
// titulo: título del documento (aparece en la pestaña y como encabezado)
// contenidoHTML: el cuerpo del documento (tabla, informe, etc.)
// color: color de acento
export function imprimirConMembrete(titulo, contenidoHTML, color = '#185FA5') {
  const html = `
  <html>
  <head>
    <meta charset="utf-8">
    <title>${titulo}</title>
    <style>
      * { font-family: Arial, sans-serif; box-sizing: border-box; }
      body { margin: 0; padding: 30px; color: #1a1a1a; }
      .titulo { text-align: center; margin: 20px 0 15px; }
      .titulo h2 { margin: 0; font-size: 18px; letter-spacing: 1px; color: #333; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
      th { background: ${color}; color: white; padding: 7px; border: 1px solid ${color}; text-align: left; }
      td { border: 1px solid #ddd; padding: 6px; }
      .tot { font-weight: bold; background: #f5f5f5; }
      .der { text-align: right; }
      @media print { body { padding: 15px; } }
    </style>
  </head>
  <body>
    ${membreteHTML(color)}
    <div class="titulo"><h2>${titulo}</h2></div>
    ${contenidoHTML}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:70px;">
      <div style="border-top:1px solid #333;padding-top:6px;text-align:center;font-size:12px;">Representante</div>
      <div style="border-top:1px solid #333;padding-top:6px;text-align:center;font-size:12px;">Contador</div>
    </div>
    <script>window.onload = function() { window.print(); }</script>
  </body>
  </html>`
  const ventana = window.open('', '_blank')
  ventana.document.write(html)
  ventana.document.close()
}