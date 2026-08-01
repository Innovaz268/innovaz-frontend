// Genera e imprime un Acta de Entrega de Muebles en una ventana nueva
const LOGO = 'https://kdfoptwfvqyexhcgllyt.supabase.co/storage/v1/object/public/publico/InnovazLogo.png'
const EMPRESA = {
  nombre: 'INNOVAZ',
  eslogan: 'Diseño y Acabados',
  telefonos: '8784-8941 / 8908-6712',
  direccion: 'San José, Costa Rica — Desamparados, San Juan de Dios, Diagonal a cementerio',
}

const fmt = n => '₡' + Math.round(n || 0).toLocaleString('es-CR')
const fmtFecha = f => f || '—'

export function imprimirActaMuebles(orden, cliente, items, notas) {
  const filas = (items || []).map((it, i) => `
    <tr>
      <td style="border:1px solid #ccc;padding:6px;text-align:center">${i + 1}</td>
      <td style="border:1px solid #ccc;padding:6px">${it.descripcion || '—'}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:center">${it.cantidad || 1}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:center">${it.unidad || '—'}</td>
    </tr>`).join('')

  const html = `
  <html>
  <head>
    <meta charset="utf-8">
    <title>Acta de Entrega Muebles ${orden.id_doc || ''}</title>
    <style>
      * { font-family: Arial, sans-serif; box-sizing: border-box; }
      body { margin: 0; padding: 30px; color: #1a1a1a; }
      .header { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #5B21B6; padding-bottom: 15px; }
      .header img { height: 80px; object-fit: contain; }
      .empresa { flex: 1; }
      .empresa h1 { margin: 0; color: #5B21B6; font-size: 22px; }
      .empresa p { margin: 2px 0; font-size: 11px; color: #555; }
      .titulo { text-align: center; margin: 25px 0 15px; }
      .titulo h2 { margin: 0; font-size: 18px; letter-spacing: 2px; color: #333; }
      .titulo .doc { color: #5B21B6; font-weight: bold; font-size: 14px; }
      .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 30px; margin: 15px 0; font-size: 13px; }
      .datos div { padding: 4px 0; border-bottom: 1px dotted #ddd; }
      .datos strong { color: #555; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
      th { background: #5B21B6; color: white; padding: 8px; border: 1px solid #5B21B6; }
      .notas { margin: 15px 0; padding: 10px; background: #f8f8f8; border-radius: 6px; font-size: 12px; }
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
      <h2>ACTA DE ENTREGA DE MUEBLES</h2>
      <span class="doc">Orden ${orden.id_doc || '—'}</span>
    </div>

    <div class="datos">
      <div><strong>Cliente:</strong> ${cliente?.nombre || '—'}</div>
      <div><strong>Identificación:</strong> ${cliente?.nit || '—'}</div>
      <div><strong>Teléfono:</strong> ${cliente?.tel || '—'}</div>
      <div><strong>Fecha de entrega:</strong> ${fmtFecha(orden.fecha_entrega)}</div>
      <div style="grid-column:1/3"><strong>Proyecto:</strong> ${orden.descripcion || '—'}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:40px">#</th>
          <th>Descripción</th>
          <th style="width:80px">Cantidad</th>
          <th style="width:80px">Unidad</th>
        </tr>
      </thead>
      <tbody>${filas || '<tr><td colspan="4" style="text-align:center;padding:10px;border:1px solid #ccc">Sin detalle</td></tr>'}</tbody>
    </table>

    ${notas ? `<div class="notas"><strong>Notas:</strong> ${notas}</div>` : ''}

    <div class="condiciones">
      <strong>Condiciones:</strong> El cliente recibe los muebles a entera satisfacción, verificando el estado, medidas y acabados acordados. La garantía cubre defectos de fabricación según lo pactado. Cualquier observación debe registrarse en el momento de la entrega.
    </div>

    <div class="firmas">
      <div class="firma">Entrega — INNOVAZ</div>
      <div class="firma">Recibe conforme — ${cliente?.nombre || 'Cliente'}</div>
    </div>

    <script>
      window.onload = function() { window.print(); }
    </script>
  </body>
  </html>`

  const ventana = window.open('', '_blank')
  ventana.document.write(html)
  ventana.document.close()
}