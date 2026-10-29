// Genera el libro de Excel de las hojas de ruta con el MISMO formato que "HOJA DE RUTA - SEMANA 42.xlsx".
import { LOGO_B64, THEME, TPL, VML } from './hoja-template'

export type HVisit = { client: string; brand: string; machine: string; model: string; callDate: string | null; zone: string; contact: string; meet: string; job: string; warranty: boolean; credit: boolean; priority: number; amount: number | null; paidDate: string | null; visitDate: string | null }
export type HRoute = { week: number; year: number; number: number; tech: string; support: string; plate: string; departDate: string; departTime: string | null; returnDate: string | null; cash: number; workDays: number | null; visits: HVisit[] }

type Val = string | number | null | undefined
const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const serial = (iso?: string | null) => iso ? Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 864e5) : null
const frac = (t?: string | null) => t ? (+t.slice(0, 2) * 60 + +t.slice(3, 5)) / 1440 : null
const short = (n: string) => { const w = n.trim().split(/\s+/); return (w[0] + (w[1] ? ' ' + w[1][0] + '.' : '')).toUpperCase() }

type Cell = { r: string; s: number; v?: string; n?: number }
const col = (ref: string) => ref.replace(/\d+/g, '')
type TRow = { r: number; ht?: number; s?: number; cells: Cell[] }
const TROWS = TPL.rows as TRow[]
const rowOf = new Map(TROWS.map(r => [r.r, r]))
const first = rowOf.get(11)!, styleOfCol = new Map(first.cells.map(c => [col(c.r), c.s]))
const colW: Record<string, number> = { D: 22, E: 13.9, F: 20.3, G: 13, I: 8.6, J: 14, K: 19.3, L: 24.9 }

function cellXml(ref: string, s: number, val: Val): string {
  if (val === null || val === undefined || val === '') return `<c r="${ref}" s="${s}"/>`
  return typeof val === 'number' ? `<c r="${ref}" s="${s}"><v>${val}</v></c>` : `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(val)}</t></is></c>`
}

function sheetXml(r: HRoute, vs: HVisit[], from: number): string {
  const head: Record<string, Val> = { E3: r.week, G3: r.year, P3: r.number, E5: r.tech, E6: r.support || '-', E7: r.plate, G7: null, N5: serial(r.departDate), P5: frac(r.departTime), N6: serial(r.returnDate), N7: r.cash, P7: r.workDays }
  const rows = TROWS.map(row => {
    let ht = row.ht
    const k = row.r - 11, filled = k >= 0 && k < 6 && vs[k]
    const cells = row.cells.map(c => {
      const L = col(c.r)
      if (row.r < 11) return c.r in head ? cellXml(c.r, c.s, head[c.r]) : cellXml(c.r, c.s, c.v ?? c.n)
      if (k >= 0 && k < 6) {
        if (L === 'C') return cellXml(c.r, c.s, from + k + 1)
        const q = vs[k]; if (!q) return cellXml(c.r, c.s, null)
        const s = L === 'O' ? TPL.priS[q.priority] || styleOfCol.get('O')! : styleOfCol.get(L) ?? c.s
        const m: Record<string, Val> = { D: q.client, E: q.brand, F: q.machine, G: q.model, H: serial(q.callDate), I: q.zone, J: q.contact, K: q.meet, L: q.job, M: q.warranty ? 'SI' : 'NO', N: q.credit ? 'SI' : 'NO', O: q.priority, P: q.amount ?? '-', Q: q.paidDate ? serial(q.paidDate) : '-', R: serial(q.visitDate) }
        return L in m ? cellXml(c.r, s, m[L]) : cellXml(c.r, s, c.v ?? c.n)
      }
      return cellXml(c.r, c.s, c.v ?? c.n)
    }).join('')
    if (filled) { const q = vs[k]; const lines = Math.max(1, ...[[q.client, 'D'], [q.brand, 'E'], [q.machine, 'F'], [q.model, 'G'], [q.zone, 'I'], [q.contact, 'J'], [q.meet, 'K'], [q.job, 'L']].map(([t, L]) => Math.ceil(String(t).length / (colW[L] * 0.9)))); ht = Math.min(120, Math.max(31.5, 15.75 * lines)) }
    return `<row r="${row.r}"${ht ? ` ht="${ht}" customHeight="1"` : ''}${row.s ? ` s="${row.s}" customFormat="1"` : ''}>${cells}</row>`
  }).join('')
  const cols = TPL.cols.map(c => `<col min="${c.min}" max="${c.max}" width="${c.width}"${c.style ? ` style="${c.style}"` : ''} customWidth="1"/>`).join('')
  return `${H}<worksheet xmlns="${NS}" xmlns:r="${R}"><sheetPr><tabColor theme="0"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="B1:R25"/><sheetViews><sheetView zoomScaleNormal="100" workbookViewId="0"/></sheetViews><sheetFormatPr baseColWidth="10" defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows}</sheetData><mergeCells count="${TPL.merges.length}">${TPL.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1" verticalCentered="1"/>${TPL.pageMargins}<pageSetup scale="58" orientation="landscape"/>${TPL.headerFooter}<legacyDrawingHF r:id="rId1"/></worksheet>`
}

function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1 } return (c ^ 0xffffffff) >>> 0 }
export function zipStore(files: { name: string; data: Uint8Array }[], type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'): Blob {
  const enc = new TextEncoder(), parts: Uint8Array[] = [], cd: Uint8Array[] = []
  let off = 0
  for (const f of files) {
    const n = enc.encode(f.name), c = crc32(f.data), len = f.data.length
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, c, true); lh.setUint32(18, len, true); lh.setUint32(22, len, true); lh.setUint16(26, n.length, true)
    parts.push(new Uint8Array(lh.buffer), n, f.data)
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, c, true); ch.setUint32(20, len, true); ch.setUint32(24, len, true); ch.setUint16(28, n.length, true); ch.setUint32(42, off, true)
    cd.push(new Uint8Array(ch.buffer), n)
    off += 30 + n.length + len
  }
  const size = cd.reduce((a, x) => a + x.length, 0)
  const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true)
  return new Blob([...parts, ...cd, new Uint8Array(end.buffer)] as unknown as BlobPart[], { type })
}

export function buildHojaXlsx(routes: HRoute[]): Blob {
  const enc = new TextEncoder()
  const sheets: { name: string; xml: string }[] = []
  const used = new Set<string>()
  for (const r of routes) {
    const vs = [...r.visits].sort((a, b) => (a.visitDate ?? '9').localeCompare(b.visitDate ?? '9'))
    const parts = Math.max(1, Math.ceil(vs.length / 6))
    for (let p = 0; p < parts; p++) {
      let name = `${r.number}-${short(r.tech)}${p ? ` (${p + 1})` : ''}`.replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31)
      while (used.has(name.toLowerCase())) name = name.slice(0, 28) + '_' + sheets.length
      used.add(name.toLowerCase())
      sheets.push({ name, xml: sheetXml(r, vs.slice(p * 6, p * 6 + 6), p * 6) })
    }
  }
  const n = sheets.length
  const png = Uint8Array.from(atob(LOGO_B64), ch => ch.charCodeAt(0))
  const rels = (items: [string, string, string][]) => `${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, t, tg]) => `<Relationship Id="${id}" Type="${R}/${t}" Target="${tg}"/>`).join('')}</Relationships>`
  const files: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: enc.encode(`${H}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`) },
    { name: '_rels/.rels', data: enc.encode(rels([['rId1', 'officeDocument', 'xl/workbook.xml']])) },
    { name: 'xl/workbook.xml', data: enc.encode(`${H}<workbook xmlns="${NS}" xmlns:r="${R}"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="20000" windowHeight="11000"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(rels([...sheets.map((_, i): [string, string, string] => [`rId${i + 1}`, 'worksheet', `worksheets/sheet${i + 1}.xml`]), [`rId${n + 1}`, 'styles', 'styles.xml'], [`rId${n + 2}`, 'theme', 'theme/theme1.xml']])) },
    { name: 'xl/styles.xml', data: enc.encode(TPL.styles) },
    { name: 'xl/theme/theme1.xml', data: enc.encode(THEME) },
    { name: 'xl/media/image1.png', data: png },
  ]
  sheets.forEach((s, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(s.xml) })
    files.push({ name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`, data: enc.encode(rels([['rId1', 'vmlDrawing', `../drawings/vmlDrawing${i + 1}.vml`]])) })
    files.push({ name: `xl/drawings/vmlDrawing${i + 1}.vml`, data: enc.encode(VML) })
    files.push({ name: `xl/drawings/_rels/vmlDrawing${i + 1}.vml.rels`, data: enc.encode(rels([['rId1', 'image', '../media/image1.png']])) })
  })
  return zipStore(files)
}
