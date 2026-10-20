import writeExcelFile from 'write-excel-file/browser'

// sheets: [{ sheet: 'Name', rows: [{col: value}] }]
export async function exportXlsx(fileName, sheets) {
  const data = sheets.map(({ sheet, rows }) => {
    const headers = rows.length ? Object.keys(rows[0]) : ['(empty)']
    return {
      sheet: sheet.slice(0, 31),
      data: [
        headers.map((h) => ({ value: h, fontWeight: 'bold' })),
        ...rows.map((r) => headers.map((h) => r[h] ?? null)),
      ],
      columns: headers.map((h) => ({ width: Math.min(40, Math.max(10, h.length + 2)) })),
    }
  })
  await writeExcelFile(data).toFile(fileName)
}

export function exportCsv(fileName, rows) {
  const headers = rows.length ? Object.keys(rows[0]) : []
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\r\n')
  // BOM so Excel opens UTF-8 names correctly
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), fileName)
}

export function download(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
