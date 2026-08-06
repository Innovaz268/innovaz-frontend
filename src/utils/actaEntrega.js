// Genera e imprime un Acta de Entrega de alquiler en una ventana nueva
import { compartirDocumento } from './compartir'

const LOGO = 'https://kdfoptwfvqyexhcgllyt.supabase.co/storage/v1/object/public/publico/InnovazLogo.png'
const EMPRESA = {
  nombre: 'INNOVAZ',
  eslogan: 'Alquiler y Construcción',
  telefonos: '8784-8941 / 8908-6712',
  direccion: 'San José, Costa Rica — Desamparados, San Juan de Dios, Diagonal a cementerio',
}

const fmt = n => '₡' + Math.round(n || 0).toLocaleString('es-CR')
const fmtFecha = f => f || '—'

export function htmlActaEntrega(factura, cliente, items, firma) {   
  const filas = (items || []).map((it, i) => `
    <tr>
      <td style="border:1px solid #ccc;padding:6px;text-align:center">${i + 1}</td>
      <td style="border:1px solid #ccc;padding:6px">${it.nombre || it.equipo_id || '—'}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:center">${it.cantidad || 1}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:center">${it.dias || '—'}</td>
    </tr>`).join('')

  const html = `
  <html>
  <head>
    <meta charset="utf-8">
    <title>Acta de Entrega ${factura.id_doc || ''}</title>
    <style>
      * { font-family: Arial, sans-serif; box-sizing: border-box; }
      body { margin: 0; padding: 30px; color: #1a1a1a; }
      .header { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #185FA5; padding-bottom: 15px; }
      .header img { height: 80px; object-fit: contain; }
      .empresa { flex: 1; }
      .empresa h1 { margin: 0; color: #185FA5; font-size: 22px; }
      .empresa p { margin: 2px 0; font-size: 11px; color: #555; }
      .titulo { text-align: center; margin: 25px 0 15px; }
      .titulo h2 { margin: 0; font-size: 18px; letter-spacing: 2px; color: #333; }
      .titulo .doc { color: #185FA5; font-weight: bold; font-size: 14px; }
      .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 30px; margin: 15px 0; font-size: 13px; }
      .datos div { padding: 4px 0; border-bottom: 1px dotted #ddd; }
      .datos strong { color: #555; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
      th { background: #185FA5; color: white; padding: 8px; border: 1px solid #185FA5; }
      .condiciones { font-size: 10px; color: #666; margin: 20px 0; line-height: 1.5; }
      .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; }
      .firma { border-top: 1px solid #333; padding-top: 6px; text-align: center; font-size: 12px; }
      @media print { body { padding: 15px; } }
    </style>
  </head>
  <body>
    <div class="header">
      <img src="${LOGO}" alt="INNOVAZ">
      <div class="empresa">
        <h1>${EMPRESA.nombre}</h1>
        <p><em>${EMPRESA.eslogan}</em></p>
        <p>Tel: ${EMPRESA.telefonos}</p>
        <p>${EMPRESA.direccion}</p>
      </div>
    </div>

    <div class="titulo">
      <h2>ACTA DE ENTREGA</h2>
      <span class="doc">Documento ${factura.id_doc || '—'}</span>
    </div>

    <div class="datos">
      <div><strong>Cliente:</strong> ${cliente?.nombre || '—'}</div>
      <div><strong>Identificación:</strong> ${cliente?.nit || '—'}</div>
      <div><strong>Teléfono:</strong> ${cliente?.tel || '—'}</div>
      <div><strong>Fecha de salida:</strong> ${fmtFecha(factura.fecha_salida)}</div>
      <div><strong>Devolución estimada:</strong> ${fmtFecha(factura.fecha_est_dev)}</div>
      <div><strong>Ubicación:</strong> ${factura.ubicacion || '—'}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:40px">#</th>
          <th>Equipo</th>
          <th style="width:80px">Cantidad</th>
          <th style="width:80px">Días</th>
        </tr>
      </thead>
      <tbody>${filas || '<tr><td colspan="4" style="text-align:center;padding:10px;border:1px solid #ccc">Sin equipos</td></tr>'}</tbody>
    </table>

    <div class="condiciones">
      <strong>Condiciones:</strong> El cliente recibe los equipos en buen estado y se compromete a devolverlos en las mismas condiciones. Cualquier daño, pérdida o retraso será responsabilidad del cliente y facturado según corresponda. La devolución debe realizarse en la fecha estimada; de requerir más tiempo, deberá gestionar una refacturación.
    </div>

    <div class="firmas">
      <div class="firma">Entrega — INNOVAZ</div>
      <div class="firma">
        ${firma ? `<img src="${firma}" style="height:45px;object-fit:contain;display:block;margin:-52px auto 4px;">` : ''}
        Recibe — ${cliente?.nombre || 'Cliente'}
      </div>
    </div>

    </body>
  </html>`

  return html
}

// Imprime el acta (abre ventana de impresión)
export function imprimirActaEntrega(factura, cliente, items, firma) {
  const html = htmlActaEntrega(factura, cliente, items, firma)
  const conScript = html.replace('</body>', '<script>window.onload = function() { window.print(); }</script></body>')
  const ventana = window.open('', '_blank')
  ventana.document.write(conScript)
  ventana.document.close()
}
// Comparte el acta como PDF (WhatsApp, correo, etc.)
export function compartirActaEntrega(factura, cliente, items, firma) {
  const html = htmlActaEntrega(factura, cliente, items, firma)
  compartirDocumento(html, `Acta-${factura.id_doc || 'entrega'}`, `Acta de entrega ${factura.id_doc || ''} — INNOVAZ`)
}