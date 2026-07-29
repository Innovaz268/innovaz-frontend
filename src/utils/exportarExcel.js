import * as XLSX from 'xlsx'

// Exporta un arreglo de objetos a un archivo Excel.
// filas: arreglo de objetos (cada objeto es una fila, las llaves son las columnas)
// nombreArchivo: sin extensión (ej. 'estado-resultados')
// nombreHoja: opcional
export function exportarExcel(filas, nombreArchivo = 'informe', nombreHoja = 'Hoja1') {
  if (!filas || filas.length === 0) {
    alert('No hay datos para exportar')
    return
  }
  const hoja = XLSX.utils.json_to_sheet(filas)
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja)
  const fecha = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(libro, `${nombreArchivo}-${fecha}.xlsx`)
}