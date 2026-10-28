'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Camera, ClipboardCheck, FileText, Pencil, Plus, Printer, Search, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type V = { id: string; name: string; plate: string; driver: string; odometer: number; area: string; year: string; chassis: string; km_next: number | null; km_interval: number | null; insp_freq?: 'quincenal' | 'mensual' | 'manual' }
type St = 'B' | 'R' | 'M' | 'N'
type Item = { s: St; note?: string; photo?: string }
type Kind = 'inspeccion' | 'recepcion' | 'taller'
type Pri = 'A' | 'M' | 'B'
type Work = { id: string; vehicle_id: string; entry_date: string; exit_date: string | null; km: number | null; reason: string; reason_note: string; shop: string; work: string; created_by_name: string; created_at: string }
type Req = { vehicle_id: string; period: string; requested_by: string; requested_at: string }
type Obs = { id: string; vehicle_id: string; inspection_id: string; text: string; priority: Pri; photo: string | null; done: boolean; created_at: string }
type Owner = { id: string; vehicle_id: string; old_owner: string | null; new_owner: string; reason: string; date: string }
type Insp = { id: string; vehicle_id: string; kind: Kind; date: string; place: string; inspector: string; driver: string; km: number; fuel_level: number; items: Record<string, Item>; photos?: { label: string; path: string }[]; signatures?: Record<string, { name: string; img: string }>; extra: Record<string, string>; notes: string; created_at: string }
type Group = [string, string[]]

const GREEN = '#c6ff00', AMBER = '#ff8a00', CYAN = '#00d2ff', RED = '#ef4444'
const BUCKET = 'inspecciones'
const NT = ['Extintor', 'Botiquín', 'Triángulo']
const LV = ['Reserva (E)', '¼ de tanque', '½ tanque', '¾ de tanque', 'Lleno (F)']
const INSP: Group[] = [
  ['Motor', ['Nivel de aceite', 'Agua de radiador', 'Agua limpia parabrisas', 'Agua de batería', 'Nivel líquido de freno', 'Limpieza de motor', 'Correas']],
  ['Luces', ['Luz media / alta / baja', 'Luz de retro', 'Luz de freno', 'Luz de parqueo', 'Direccionales', 'Luz del tablero', 'Luz interior de cabina']],
  ['Accesorios', ['Cinturones de seguridad', 'Extintor', 'Botiquín', 'Triángulo', 'Bocina']],
  ['Vidrios y espejos', ['Parabrisas delantero', 'Parabrisas trasero', 'Vidrios de puertas', 'Espejo retrovisor', 'Espejo retrovisor izq.', 'Espejo retrovisor der.']],
  ['Carrocería', ['Chaperío / estética', 'Rayaduras en pintura', 'Abolladuras', 'Limpieza externa']],
  ['Interior', ['Asientos', 'Limpieza interna', 'Puertas', 'Chapas de puertas']],
]
const TALLER: Group[] = [
  ['Motor', ['Nivel de aceite', 'Agua de radiador', 'Agua limpia parabrisas', 'Agua de batería', 'Nivel líquido de freno', 'Limpieza de motor', 'Correas']],
  ['Luces', ['Luz media / alta / baja', 'Luz de retro', 'Luz de freno', 'Luz de parqueo', 'Direccionales', 'Luz del tablero', 'Luz interior de cabina']],
  ['Accesorios', ['Cinturones de seguridad', 'Extintor', 'Botiquín', 'Triángulo', 'Bocina', 'Parabrisas delantero', 'Parabrisas trasero', 'Vidrios de puertas', 'Espejo retrovisor', 'Espejo retrovisor izq.', 'Espejo retrovisor der.']],
  ['Chaperío', ['Rayaduras en pintura', 'Abolladuras', 'Limpieza externa', 'Asientos', 'Limpieza interna', 'Puertas', 'Chapas de puertas']],
]
const PRI: Record<Pri, { l: string; c: string }> = { A: { l: 'ALTA', c: '#ff0000' }, M: { l: 'MEDIA', c: '#ffff00' }, B: { l: 'BAJA', c: '#34a853' } }
const KN: Record<Kind, string> = { inspeccion: 'inspección', recepcion: 'recepción', taller: 'inspección de taller' }
const KEEP = '@media print{.print-root .keep-bg{background:var(--bg)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
const bg = (c: string) => ({ '--bg': c, background: c }) as React.CSSProperties
const RECEP: Group[] = [
  ['Motor', ['Nivel de aceite', 'Agua del radiador', 'Agua para parabrisas', 'Nivel de agua de batería', 'Nivel de líquido de frenos', 'Nivel líquido hidráulico de dirección', 'Caja de cambios', 'Doble tracción', 'Filtro de aire', 'Dirección', 'Correas', 'Mangueras', 'Limpieza de motor']],
  ['Luces', ['Luz media / alta / baja', 'Luz de retro', 'Luz de freno (stop)', 'Luz de emergencia / parqueo', 'Luces direccionales', 'Luz de placa trasera', 'Iluminación del tablero', 'Luz interior']],
  ['Herramientas', ['Alicate', 'Destornillador', 'Llave de ruedas', 'Gato', 'Pala', 'Linterna', 'Barra de remolque', 'Varillas para gato']],
  ['Accesorios', ['Cinturones de seguridad', 'Extintor', 'Botiquín', 'Triángulo', 'Sonorizador de retro', 'Bocina', 'Limpia parabrisas', 'Parabrisas delantero', 'Parabrisas trasero', 'Vidrio lateral der. / izq.', 'Espejo retrovisor', 'Espejo lateral der.', 'Espejo lateral izq.']],
  ['Instrumentos del tablero', ['Odómetro (velocímetro)', 'Tacómetro', 'Marcador de temperatura', 'Marcador de combustible']],
  ['Frenos', ['De pedal', 'De mano']],
  ['Llantas', ['Delanteras (der. / izq.)', 'Traseras (der. / izq.)', 'Auxilio']],
]
const SLOTS: Record<Kind, string[]> = {
  taller: ['Tablero (km)', 'Otra foto (opcional)', 'Otra foto 2 (opcional)'],
  inspeccion: ['Tablero (km y combustible)', 'Otra foto (opcional)'],
  recepcion: ['Frente', 'Lateral izquierdo', 'Lateral derecho', 'Trasera', 'Tablero (km y combustible)', 'Daño u otro (opcional)', 'Daño u otro 2 (opcional)'],
}
const TITLE: Record<Kind, string> = { inspeccion: 'Inspección de vehículo', recepcion: 'Recepción de vehículo', taller: 'Inspección de taller' }
const COL: Record<St, string> = { B: 'border-[#c6ff00] bg-[#c6ff00]/15 text-[#c6ff00]', R: 'border-[#ff8a00] bg-[#ff8a00]/15 text-[#ffae47]', M: 'border-red-500 bg-red-500/15 text-red-300', N: 'border-slate-400 bg-slate-400/15 text-slate-300' }
const inp = 'h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#00d2ff]'

const plain = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/-/g, '')
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const REASONS = ['Mantenimiento programado', 'Falla o reparación', 'Pendiente de inspección', 'Otro']
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dayDiff = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 864e5))
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
const fmtD = (s: string) => s.slice(0, 10).split('-').reverse().join('/')
const period = (d: string = today()) => `${d.slice(0, 7)}-${+d.slice(8, 10) <= 15 ? 'Q1' : 'Q2'}`
const periodLabel = (p: string) => `${p.endsWith('Q1') ? '1ª' : '2ª'} quincena de ${MES[+p.slice(5, 7) - 1]} ${p.slice(0, 4)} (${p.endsWith('Q1') ? 'del 1 al 15' : 'del 16 al fin de mes'})`
const itemPaths = (i: Insp) => [...(i.photos ?? []).map(p => p.path), ...Object.values(i.items).map(x => x.photo).filter(Boolean) as string[]]

async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('No se pudo procesar la foto'))), 'image/jpeg', 0.72))
}

function Lab({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t}</span>{children}</label>
}

function Gauge({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  const col = [RED, AMBER, '#ffc400', '#9be000', GREEN]
  return <div><div className="flex gap-1.5">{['E', '¼', '½', '¾', 'F'].map((l, i) => <button type="button" key={l} onClick={() => onChange(i)} className="flex-1 rounded-lg border border-white/10 py-3 text-xs font-bold text-slate-400" style={value !== null && i <= value ? { background: col[value], color: '#0b0f17', borderColor: col[value] } : undefined}>{l}</button>)}</div><p className="mt-1.5 text-[11px] text-slate-500">{value === null ? 'Toca el nivel que marca el tablero' : LV[value]}</p></div>
}

function PhotoBtn({ label, p, onPick, req }: { label: string; p?: { url: string }; onPick: (f: File) => void; req?: boolean }) {
  return <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-2.5 text-xs text-slate-300 hover:border-[#00d2ff]">
    {p ? <img src={p.url} alt={label} className="size-14 rounded-lg object-cover" /> : <span className="grid size-14 place-items-center rounded-lg bg-white/[0.05] text-slate-500"><Camera className="size-5" /></span>}
    <span>{label}{req && <b className="text-red-400"> *</b>}</span>
    <input type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} />
  </label>
}

function SigPad({ onChange }: { onChange: (d: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const on = useRef(false)
  const pos = (e: React.PointerEvent) => { const c = ref.current!, r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height] }
  const cx = () => { const c = ref.current!.getContext('2d')!; c.lineWidth = 3; c.lineCap = 'round'; c.strokeStyle = '#000'; return c }
  return <div><canvas ref={ref} width={600} height={200} className="h-28 w-full touch-none rounded-xl bg-white"
    onPointerDown={e => { on.current = true; const [x, y] = pos(e), c = cx(); c.beginPath(); c.moveTo(x, y); e.currentTarget.setPointerCapture(e.pointerId) }}
    onPointerMove={e => { if (!on.current) return; const [x, y] = pos(e), c = cx(); c.lineTo(x, y); c.stroke() }}
    onPointerUp={() => { on.current = false; onChange(ref.current!.toDataURL('image/png')) }} />
    <button type="button" onClick={() => { ref.current!.getContext('2d')!.clearRect(0, 0, 600, 200); onChange('') }} className="mt-1 text-[11px] text-slate-500 hover:text-white">Borrar firma</button></div>
}

function Form({ v, kind, who, onClose, onDone }: { v: V; kind: Kind; who: string; onClose: () => void; onDone: (id: string) => void }) {
  const groups = kind === 'inspeccion' ? INSP : kind === 'taller' ? TALLER : RECEP
  const all = groups.flatMap(g => g[1])
  const [h, setH] = useState({ date: today(), place: 'CIAGRO', km: '', driver: v.driver, tipo: 'Camioneta', pasajeros: '', interno: '', responsable: v.driver, notes: '' })
  const [lvl, setLvl] = useState<number | null>(null)
  const [items, setItems] = useState<Record<string, Item>>({})
  const [ph, setPh] = useState<Record<string, { blob: Blob; url: string }>>({})
  const [sig, setSig] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [obs, setObs] = useState<{ id: number; text: string; p: Pri }[]>([])
  const [hand, setHand] = useState(false)
  const [rcv, setRcv] = useState('')
  const [dlv, setDlv] = useState(v.driver)
  const p = (k: keyof typeof h, type = 'text') => ({ type, value: h[k], className: inp, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setH({ ...h, [k]: e.target.value }) })
  const setS = (k: string, s: St) => setItems(o => ({ ...o, [k]: { ...o[k], s } }))
  const pick = async (key: string, f: File) => { try { const blob = await shrink(f); setPh(o => ({ ...o, [key]: { blob, url: URL.createObjectURL(blob) } })) } catch (e) { setErr((e as Error).message) } }
  const answered = all.filter(k => items[k]?.s).length

  async function save() {
    setErr('')
    const miss = all.find(k => !items[k]?.s)
    const bad = all.find(k => items[k]?.s === 'M' && (!items[k].note?.trim() || !ph['item:' + k]))
    const slot = SLOTS[kind].find(l => !l.includes('opcional') && !ph[l])
    if (isNaN(parseFloat(h.km))) return setErr('Ingresa el kilometraje actual.')
    if (kind !== 'taller' && lvl === null) return setErr('Marca el nivel de combustible.')
    if (miss) return setErr(`Falta responder: ${miss}`)
    if (bad) return setErr(`"${bad}" está en Malo: agrega la descripción y una foto.`)
    if (slot) return setErr(`Falta la foto: ${slot}`)
    if (kind === 'recepcion' && (!h.responsable.trim() || !sig.control || !sig.resp)) return setErr('Faltan los nombres o las dos firmas.')
    if (kind === 'inspeccion' && hand && (!rcv.trim() || !dlv.trim() || !sig.control || !sig.resp)) return setErr('Para la entrega faltan los nombres o las dos firmas.')
    setBusy(true)
    try {
      const up = async (key: string) => { const path = `${v.id}/${crypto.randomUUID()}.jpg`; const { error } = await supabase.storage.from(BUCKET).upload(path, ph[key].blob, { contentType: 'image/jpeg' }); if (error) throw error; return path }
      const payload: Record<string, Item> = {}
      for (const k of all) { const it = items[k]; payload[k] = { s: it.s, ...(it.note?.trim() ? { note: it.note.trim() } : {}), ...(ph['item:' + k] ? { photo: await up('item:' + k) } : {}) } }
      const photos: { label: string; path: string }[] = []
      for (const l of SLOTS[kind]) if (ph[l]) photos.push({ label: l, path: await up(l) })
      const signatures = kind === 'recepcion' ? { control: { name: who, img: sig.control }, resp: { name: h.responsable.trim(), img: sig.resp } } : kind === 'inspeccion' && hand ? { control: { name: dlv.trim(), img: sig.control }, resp: { name: rcv.trim(), img: sig.resp } } : {}
      const extra = kind === 'recepcion' ? { tipo: h.tipo, pasajeros: h.pasajeros, interno: h.interno } : kind === 'taller' ? { km_next: String(v.km_next ?? '') } : kind === 'inspeccion' && hand ? { entrega: '1', entrega_de: dlv.trim(), entrega_a: rcv.trim() } : {}
      const { data, error } = await supabase.from('inspections').insert({ vehicle_id: v.id, kind, date: h.date, place: h.place.trim(), inspector: who, driver: h.driver.trim(), km: parseFloat(h.km), fuel_level: kind === 'taller' ? null : lvl, items: payload, photos, signatures, extra, notes: h.notes.trim() }).select('id').single()
      if (error) throw error
      const rows: Record<string, unknown>[] = []
      for (const o of obs) if (o.text.trim()) rows.push({ vehicle_id: v.id, inspection_id: data.id, text: o.text.trim(), priority: o.p, photo: ph['obs:' + o.id] ? await up('obs:' + o.id) : null })
      if (rows.length) { const r = await supabase.from('insp_observations').insert(rows); if (r.error) throw r.error }
      onDone(data.id)
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return <div className="no-print mx-auto max-w-3xl">
    <button onClick={onClose} className="mb-4 flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft className="size-4" />Volver</button>
    <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: kind === 'inspeccion' ? GREEN : CYAN }}>{kind === 'inspeccion' ? 'Cada 15 días' : kind === 'taller' ? 'En taller / mantenimiento' : 'Cuando sea necesario'}</p>
    <h2 className="mt-1 text-2xl font-semibold text-white">{TITLE[kind]}</h2>
    <p className="mt-1 text-sm text-slate-400">{v.name} · <span className="font-mono text-white">{v.plate}</span>{v.area && ` · ${v.area}`}</p>
    <div className="frost-card mt-6 grid gap-4 p-5 sm:grid-cols-2">
      <Lab t="Fecha"><input {...p('date', 'date')} /></Lab><Lab t="Lugar"><input {...p('place')} placeholder="Ej. Oficina central" /></Lab>
      <Lab t="Conductor / responsable"><input {...p('driver')} /></Lab><Lab t="Kilometraje actual"><input {...p('km', 'number')} inputMode="numeric" placeholder={String(v.odometer)} /></Lab>
      {kind === 'recepcion' && <><Lab t="Tipo de vehículo"><select {...p('tipo')} className={inp}>{['Camioneta', 'Vagoneta', 'Auto', 'Otro'].map(t => <option key={t} className="bg-[#111a2a]">{t}</option>)}</select></Lab><Lab t="N° de pasajeros"><input {...p('pasajeros', 'number')} /></Lab><Lab t="N° de interno"><input {...p('interno')} /></Lab><Lab t="Responsable del vehículo (nombre completo)"><input {...p('responsable')} /></Lab></>}
      {kind !== 'taller' ? <div className="sm:col-span-2"><Lab t="Nivel de combustible"><Gauge value={lvl} onChange={setLvl} /></Lab></div> : <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs text-slate-300 sm:col-span-2">{v.name}{v.year && ` · ${v.year}`}{v.chassis && ` · Chasis ${v.chassis}`}<br />{v.km_next != null ? `Próximo mantenimiento: ${v.km_next.toLocaleString('es-BO')} km · faltan ${(v.km_next - (parseFloat(h.km) || v.odometer)).toLocaleString('es-BO')} km` : 'Sin kilometraje de próximo mantenimiento (se define al editar el vehículo)'}</div>}
    </div>
    <div className="mt-6 flex items-center justify-between"><p className="text-xs text-slate-500">{answered} de {all.length} puntos</p><button type="button" onClick={() => setItems(o => Object.fromEntries(all.map(k => [k, o[k] ?? { s: 'B' as St }])))} className="text-xs text-[#c6ff00] hover:underline">Marcar lo pendiente como Bueno</button></div>
    {groups.map(([g, ks]) => <div key={g} className="frost-card mt-3 p-5"><h3 className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{g}</h3>
      {ks.map(k => { const it = items[k]; const opts: St[] = kind === 'recepcion' || NT.includes(k) ? ['B', 'R', 'M', 'N'] : ['B', 'R', 'M']
        return <div key={k} className="border-b border-white/[0.06] py-3 last:border-0"><div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-200">{k}</span><div className="flex shrink-0 gap-1">{opts.map(o => <button type="button" key={o} onClick={() => setS(k, o)} className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-bold ${it?.s === o ? COL[o] : 'border-white/10 text-slate-500'}`}>{o === 'N' ? 'N/T' : o}</button>)}</div></div>
          {(it?.s === 'R' || it?.s === 'M') && <div className="mt-2 grid gap-2 sm:grid-cols-2"><input className={inp} placeholder={it.s === 'M' ? 'Describe la falla *' : 'Nota (opcional)'} value={it.note ?? ''} onChange={e => setItems(o => ({ ...o, [k]: { ...o[k], note: e.target.value } }))} /><PhotoBtn label={it.s === 'M' ? 'Foto de la falla' : 'Foto (opcional)'} req={it.s === 'M'} p={ph['item:' + k]} onPick={f => pick('item:' + k, f)} /></div>}</div> })}</div>)}
    <div className="frost-card mt-3 p-5"><h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Fotos de la camioneta</h3><div className="grid gap-2 sm:grid-cols-2">{SLOTS[kind].map(l => <PhotoBtn key={l} label={l.replace(' (opcional)', '')} req={!l.includes('opcional')} p={ph[l]} onPick={f => pick(l, f)} />)}</div></div>
    <div className="frost-card mt-3 p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Observaciones con prioridad</h3><button type="button" onClick={() => setObs(a => [...a, { id: Date.now() + Math.random(), text: '', p: 'M' }])} className="text-xs text-[#c6ff00] hover:underline">+ Agregar observación</button></div>
      {!obs.length && <p className="text-xs text-slate-600">Sin observaciones.</p>}
      {obs.map(o => <div key={o.id} className="mb-3 rounded-xl border border-white/[0.07] p-3"><div className="flex gap-1.5">{(['A', 'M', 'B'] as Pri[]).map(k => <button type="button" key={k} onClick={() => setObs(a => a.map(x => x.id === o.id ? { ...x, p: k } : x))} className="flex-1 rounded-lg border py-2 text-[11px] font-bold" style={o.p === k ? { background: PRI[k].c, color: k === 'M' ? '#000' : '#fff', borderColor: PRI[k].c } : { borderColor: 'rgba(255,255,255,.1)', color: '#94a3b8' }}>{PRI[k].l}</button>)}<button type="button" onClick={() => setObs(a => a.filter(x => x.id !== o.id))} aria-label="Quitar" className="px-2 text-slate-500 hover:text-red-400"><Trash2 className="size-4" /></button></div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2"><input className={inp} placeholder="Ej. Compuerta trasera en mal estado" value={o.text} onChange={e => setObs(a => a.map(x => x.id === o.id ? { ...x, text: e.target.value } : x))} /><PhotoBtn label="Foto (opcional)" p={ph['obs:' + o.id]} onPick={f => pick('obs:' + o.id, f)} /></div></div>)}</div>
    {kind === 'inspeccion' && <div className="frost-card mt-3 p-5"><label className="flex items-start gap-3 text-sm text-slate-200"><input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={hand} onChange={e => setHand(e.target.checked)} /><span>Esta inspección es para <b className="text-white">entregar la camioneta a otra persona</b> (lleva las firmas de quien entrega y quien recibe)</span></label>
      {hand && <div className="mt-4 grid gap-5 sm:grid-cols-2"><div><Lab t="Quien entrega"><input className={inp} value={dlv} onChange={e => setDlv(e.target.value)} /></Lab><p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Firma</p><SigPad onChange={d => setSig(o => ({ ...o, control: d }))} /></div><div><Lab t="Quien recibe"><input className={inp} value={rcv} onChange={e => setRcv(e.target.value)} placeholder="Nombre completo" /></Lab><p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Firma</p><SigPad onChange={d => setSig(o => ({ ...o, resp: d }))} /></div></div>}</div>}
    {kind === 'recepcion' && <div className="frost-card mt-3 grid gap-5 p-5 sm:grid-cols-2"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Firma · Responsable del control (Dpto. Servicios)</p><p className="mb-2 text-xs text-slate-300">{who}</p><SigPad onChange={d => setSig(o => ({ ...o, control: d }))} /></div><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Firma · Responsable del vehículo</p><p className="mb-2 text-xs text-slate-300">{h.responsable || '—'}</p><SigPad onChange={d => setSig(o => ({ ...o, resp: d }))} /></div></div>}
    {err && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
    <button disabled={busy} onClick={save} className="mt-5 h-12 w-full rounded-xl text-sm font-bold text-[#0b0f17] disabled:opacity-60" style={{ background: GREEN }}>{busy ? 'Guardando y subiendo fotos…' : 'Guardar ' + KN[kind]}</button>
  </div>
}

function SignModal({ i, v, onClose, onDone }: { i: Insp; v?: V; onClose: () => void; onDone: () => void }) {
  const [dlv, setDlv] = useState(v?.driver ?? i.driver ?? '')
  const [rcv, setRcv] = useState('')
  const [sig, setSig] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  async function save() {
    if (!dlv.trim() || !rcv.trim() || !sig.control || !sig.resp) return setErr('Faltan los nombres o las dos firmas.')
    const { data, error } = await supabase.from('inspections').update({ signatures: { control: { name: dlv.trim(), img: sig.control }, resp: { name: rcv.trim(), img: sig.resp } }, extra: { ...(i.extra ?? {}), entrega: '1', entrega_de: dlv.trim(), entrega_a: rcv.trim() } }).eq('id', i.id).select('id')
    if (error) return setErr(error.message)
    if (!data?.length) return setErr('No se pudo agregar: esta inspección ya tiene firmas o no tienes permiso.')
    onDone(); onClose()
  }
  return <div className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-[#05070c]/80 backdrop-blur-sm sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#111a2a] sm:rounded-2xl">
    <div className="flex items-center justify-between border-b border-white/[0.07] p-5"><div><h2 className="text-lg font-semibold text-white">Firmas de entrega</h2><p className="mt-1 text-xs text-slate-500">{v?.plate} · se agregan a esta inspección</p></div><button onClick={onClose} aria-label="Cerrar" className="text-slate-500 hover:text-white"><X className="size-5" /></button></div>
    <div className="flex flex-col gap-5 p-5">
      <div><Lab t="Quien entrega"><input className={inp} value={dlv} onChange={e => setDlv(e.target.value)} /></Lab><p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Firma</p><SigPad onChange={d => setSig(o => ({ ...o, control: d }))} /></div>
      <div><Lab t="Quien recibe"><input className={inp} value={rcv} onChange={e => setRcv(e.target.value)} placeholder="Nombre completo" /></Lab><p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Firma</p><SigPad onChange={d => setSig(o => ({ ...o, resp: d }))} /></div>
      {err && <p className="text-xs text-red-300">{err}</p>}
      <p className="text-[11px] text-slate-500">Las firmas se pueden agregar una sola vez; después la inspección queda cerrada.</p>
      <div className="flex justify-end gap-2"><button onClick={onClose} className="px-3 text-xs text-slate-400">Cancelar</button><button onClick={save} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Guardar firmas</button></div>
    </div></div></div>
}

function EditInsp({ i, onClose, onDone }: { i: Insp; onClose: () => void; onDone: () => void }) {
  const groups = i.kind === 'inspeccion' ? INSP : i.kind === 'taller' ? TALLER : RECEP
  const hand = !!i.extra?.entrega
  const [h, setH] = useState({ date: i.date, place: i.place ?? '', driver: i.driver ?? '', km: String(i.km ?? ''), notes: i.notes ?? '' })
  const [lvl, setLvl] = useState<number | null>(i.fuel_level ?? null)
  const [items, setItems] = useState<Record<string, Item>>({ ...(i.items ?? {}) })
  const [dlv, setDlv] = useState(i.extra?.entrega_de ?? '')
  const [rcv, setRcv] = useState(i.extra?.entrega_a ?? '')
  const [err, setErr] = useState('')
  async function save() {
    const km = parseFloat(h.km)
    if (isNaN(km)) return setErr('Ingresa el kilometraje.')
    const body: Record<string, unknown> = { date: h.date, place: h.place.trim(), driver: h.driver.trim(), km, notes: h.notes.trim(), items, fuel_level: i.fuel_level == null ? null : lvl }
    if (hand) {
      body.extra = { ...i.extra, entrega_de: dlv.trim(), entrega_a: rcv.trim() }
      if (i.signatures) body.signatures = { ...i.signatures, control: { ...i.signatures.control, name: dlv.trim() }, resp: { ...i.signatures.resp, name: rcv.trim() } }
    }
    const { data, error } = await supabase.from('inspections').update(body).eq('id', i.id).select('id')
    if (error) return setErr(error.message)
    if (!data?.length) return setErr('No se pudo guardar: solo el administrador puede editar una inspección.')
    onDone(); onClose()
  }
  return <div className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-[#05070c]/80 backdrop-blur-sm sm:items-center sm:p-6"><div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#111a2a] sm:rounded-2xl">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#111a2a] p-5"><div><h2 className="text-lg font-semibold text-white">Editar inspección</h2><p className="mt-1 text-xs text-slate-500">Corrige lo que haga falta. Las fotos y las firmas dibujadas no cambian.</p></div><button onClick={onClose} aria-label="Cerrar" className="text-slate-500 hover:text-white"><X className="size-5" /></button></div>
    <div className="p-5">
      <div className="grid gap-4 sm:grid-cols-2"><Lab t="Fecha"><input type="date" className={inp} value={h.date} onChange={e => setH({ ...h, date: e.target.value })} /></Lab><Lab t="Lugar"><input className={inp} value={h.place} onChange={e => setH({ ...h, place: e.target.value })} /></Lab><Lab t="Conductor / responsable"><input className={inp} value={h.driver} onChange={e => setH({ ...h, driver: e.target.value })} /></Lab><Lab t="Kilometraje"><input type="number" className={inp} value={h.km} onChange={e => setH({ ...h, km: e.target.value })} /></Lab>
        {hand && <><Lab t="Quien entrega"><input className={inp} value={dlv} onChange={e => setDlv(e.target.value)} /></Lab><Lab t="Quien recibe"><input className={inp} value={rcv} onChange={e => setRcv(e.target.value)} /></Lab></>}
        {i.fuel_level != null && <div className="sm:col-span-2"><Lab t="Nivel de combustible"><Gauge value={lvl} onChange={setLvl} /></Lab></div>}</div>
      {groups.map(([g, ks]) => <div key={g} className="mt-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{g}</p>{ks.map(k => { const it = items[k]; const opts: St[] = i.kind === 'recepcion' || NT.includes(k) ? ['B', 'R', 'M', 'N'] : ['B', 'R', 'M']
        return <div key={k} className="border-b border-white/[0.06] py-2.5"><div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-200">{k}</span><div className="flex shrink-0 gap-1">{opts.map(o => <button type="button" key={o} onClick={() => setItems(p => ({ ...p, [k]: { ...p[k], s: o } }))} className={`h-8 min-w-8 rounded-lg border px-2 text-xs font-bold ${it?.s === o ? COL[o] : 'border-white/10 text-slate-500'}`}>{o === 'N' ? 'N/T' : o}</button>)}</div></div>
          {(it?.s === 'R' || it?.s === 'M') && <input className={inp + ' mt-2'} placeholder="Nota" value={it.note ?? ''} onChange={e => setItems(p => ({ ...p, [k]: { ...p[k], note: e.target.value } }))} />}</div> })}</div>)}
      <div className="mt-5"><Lab t="Observaciones"><textarea className={inp + ' h-20 py-3'} value={h.notes} onChange={e => setH({ ...h, notes: e.target.value })} /></Lab></div>
      {err && <p className="mt-4 text-xs text-red-300">{err}</p>}
      <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="px-3 text-xs text-slate-400">Cancelar</button><button onClick={save} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Guardar cambios</button></div>
    </div></div></div>
}

function Report({ i, v, onBack, onDelete, onNext, nextLabel, onSigned }: { i: Insp; v?: V; onBack: () => void; onDelete?: () => void; onNext?: () => void; nextLabel?: string; onSigned?: () => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [obs, setObs] = useState<Obs[]>([])
  const [sg, setSg] = useState(false)
  const [ed, setEd] = useState(false)
  const groups = i.kind === 'inspeccion' ? INSP : i.kind === 'taller' ? TALLER : RECEP
  useEffect(() => { (async () => { const { data: ob } = await supabase.from('insp_observations').select('*').eq('inspection_id', i.id); const list = ((ob ?? []) as Obs[]).sort((x, y) => 'AMB'.indexOf(x.priority) - 'AMB'.indexOf(y.priority)); setObs(list); const ps = [...itemPaths(i), ...(list.map(o => o.photo).filter(Boolean) as string[])]; if (ps.length) { const { data } = await supabase.storage.from(BUCKET).createSignedUrls(ps, 3600); if (data) setUrls(Object.fromEntries(data.map(d => [d.path ?? '', d.signedUrl]))) } })() }, [i])
  const row = (a: string, b?: string) => <div className="flex gap-2 border-b border-gray-300 py-1"><span className="w-40 shrink-0 font-semibold">{a}</span><span>{b || '—'}</span></div>
  return <div>
    <div className="no-print mb-4 flex flex-wrap items-center gap-2"><button onClick={onBack} className="mr-auto flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft className="size-4" />Volver</button>
      {onDelete && onSigned && <button onClick={() => setEd(true)} className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-xs font-semibold text-slate-200 hover:bg-white/5"><Pencil className="size-4" />Editar inspección</button>}
      {i.kind === 'inspeccion' && !i.extra?.entrega && onSigned && <button onClick={() => setSg(true)} className="flex h-10 items-center rounded-xl border border-white/15 px-3 text-xs font-semibold text-slate-200 hover:bg-white/5">Agregar firmas de entrega</button>}
      {onNext && <button onClick={onNext} className="flex h-10 items-center rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>{nextLabel}</button>}
      {onDelete && <button onClick={onDelete} className="flex h-10 items-center gap-1.5 rounded-xl border border-red-500/30 px-3 text-xs text-red-300"><Trash2 className="size-4" />Eliminar</button>}
      <button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Printer className="size-4" />Imprimir / PDF</button></div>
    {sg && <SignModal i={i} v={v} onClose={() => setSg(false)} onDone={() => onSigned?.()} />}
    {ed && <EditInsp i={i} onClose={() => setEd(false)} onDone={() => onSigned?.()} />}
    <div className="mx-auto max-w-4xl rounded-lg bg-white p-6 text-[12px] text-black sm:p-10">
      <div className="mb-4 flex items-end justify-between border-b-2 border-black pb-3"><div><p className="text-lg font-bold tracking-[0.15em]">CIAGRO SRL</p></div><h1 className="text-right text-base font-bold uppercase">Check list de {KN[i.kind]} de vehículo{i.extra?.entrega ? ' · ENTREGA' : ''}</h1></div>
      <div className="grid gap-x-6 sm:grid-cols-2">{row('Fecha', fmtD(i.date))}{row('Lugar', i.place)}{row('Placa', v?.plate)}{row('Vehículo', v?.name)}{row('Conductor', i.driver)}{row('Kilometraje', i.km?.toLocaleString('es-BO') + ' km')}{i.fuel_level != null && row('Combustible', LV[i.fuel_level])}{row('Inspector', i.inspector)}{i.extra?.entrega && <>{row('Entrega de', i.extra.entrega_de)}{row('Entrega a', i.extra.entrega_a)}</>}{i.kind === 'taller' && <>{row('Marca', v?.name)}{row('Modelo (año)', v?.year)}{row('Chasis', v?.chassis)}{row('Km próx. mantenimiento', i.extra.km_next ? Number(i.extra.km_next).toLocaleString('es-BO') + ' km' : '')}{row('Km faltantes', i.extra.km_next ? (Number(i.extra.km_next) - i.km).toLocaleString('es-BO') + ' km' : '')}</>}
        {i.kind === 'recepcion' && <>{row('Tipo de vehículo', i.extra.tipo)}{row('N° de pasajeros', i.extra.pasajeros)}{row('N° de interno', i.extra.interno)}{row('Área', v?.area)}</>}</div>
      <p className="mt-3 text-[10px]">B = Bueno · R = Regular · M = Malo · N/T = No tiene</p>
      <div className="mt-2 grid gap-x-6 sm:grid-cols-2">{groups.map(([g, ks]) => <table key={g} className="break-inside-avoid mb-3 w-full border-collapse"><thead><tr className="bg-gray-200"><th className="border border-gray-400 px-1 text-left">{g}</th>{['B', 'R', 'M', 'N/T'].map(c => <th key={c} className="w-7 border border-gray-400">{c}</th>)}</tr></thead>
        <tbody>{ks.map(k => { const it = i.items[k]; return <tr key={k}><td className="border border-gray-400 px-1">{k}{it?.note && <i className="block text-[10px] text-gray-600">{it.note}</i>}</td>{['B', 'R', 'M', 'N'].map(c => <td key={c} className="border border-gray-400 text-center font-bold">{it?.s === c ? 'X' : ''}</td>)}</tr> })}</tbody></table>)}</div>
      <div className="break-inside-avoid mt-3"><style>{KEEP}</style>
        <div className="grid gap-4 sm:grid-cols-[1fr_130px]"><table className="w-full border-collapse"><thead><tr className="bg-gray-200"><th className="w-20 border border-gray-400">PRIORIDAD</th><th className="border border-gray-400 px-1 text-left">OBSERVACIONES</th></tr></thead>
          <tbody>{obs.map(o => <tr key={o.id}><td className="keep-bg border border-gray-400" style={bg(PRI[o.priority].c)} /><td className="border border-gray-400 px-1 py-0.5">{o.text}{o.done && <i className="text-gray-500"> (resuelta)</i>}{o.photo && urls[o.photo] && <img src={urls[o.photo]} alt="" className="mt-1 h-16 rounded" />}</td></tr>)}{!obs.length && <tr><td className="border border-gray-400">&nbsp;</td><td className="border border-gray-400 px-1 text-gray-500">Sin observaciones</td></tr>}</tbody></table>
          <table className="h-fit border-collapse"><thead><tr><th colSpan={2} className="border border-gray-400 bg-gray-200">PRIORIDADES</th></tr></thead><tbody>{(['A', 'M', 'B'] as Pri[]).map(k => <tr key={k}><td className="keep-bg h-5 w-8 border border-gray-400" style={bg(PRI[k].c)} /><td className="border border-gray-400 px-1">{PRI[k].l}</td></tr>)}</tbody></table></div>
        {i.notes && <p className="mt-2"><b>Observaciones:</b> {i.notes}</p>}</div>
      {!!i.photos?.length && <div className="break-inside-avoid mt-4"><p className="mb-2 font-semibold">Registro fotográfico</p><div className="grid grid-cols-3 gap-2">{i.photos.map(f => <figure key={f.path}><img src={urls[f.path]} alt={f.label} className="aspect-[4/3] w-full rounded object-cover" /><figcaption className="text-[10px]">{f.label}</figcaption></figure>)}</div></div>}
      {Object.entries(i.items).some(([, x]) => x.photo) && <div className="break-inside-avoid mt-4"><p className="mb-2 font-semibold">Fotos de fallas</p><div className="grid grid-cols-3 gap-2">{Object.entries(i.items).filter(([, x]) => x.photo).map(([k, x]) => <figure key={k}><img src={urls[x.photo!]} alt={k} className="aspect-[4/3] w-full rounded object-cover" /><figcaption className="text-[10px]">{k}: {x.note}</figcaption></figure>)}</div></div>}
      {(i.kind === 'recepcion' || i.extra?.entrega) && i.signatures && <div className="break-inside-avoid mt-8 grid grid-cols-2 gap-10 text-center">{(i.extra?.entrega ? [['control', 'Quien entrega'], ['resp', 'Quien recibe']] : [['control', 'Responsable del control · Dpto. Servicios'], ['resp', 'Responsable del vehículo']]).map(([k, t]) => <div key={k}>{i.signatures![k]?.img && <img src={i.signatures![k].img} alt="Firma" className="mx-auto h-16" />}<div className="border-t border-black pt-1 font-semibold">{i.signatures![k]?.name}</div><div className="text-[10px]">{t}</div></div>)}</div>}
      <p className="mt-6 text-right text-[9px] text-gray-500">Registrado el {new Date(i.created_at).toLocaleString('es-BO')} · CIAGRO SRL</p>
    </div></div>
}

function Matrix({ vs, ins, onBack }: { vs: V[]; ins: Insp[]; onBack: () => void }) {
  const cols = vs.map(v => ({ v, i: ins.find(x => x.vehicle_id === v.id && x.kind === 'inspeccion') })).filter(c => c.i)
  return <div><style>{'@media print{@page{size:landscape}}'}</style><p className="print-only hidden mb-3 text-lg font-bold tracking-[0.15em]">CIAGRO SRL</p>
    <div className="no-print mb-4 flex items-center gap-2"><button onClick={onBack} className="mr-auto flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft className="size-4" />Volver</button><button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Printer className="size-4" />Imprimir / PDF</button></div>
    <div className="overflow-x-auto rounded-lg bg-white p-6 text-[11px] text-black"><h1 className="mb-1 text-base font-bold uppercase">Informe general de inspecciones</h1><p className="mb-3 text-[10px]">Última inspección de cada vehículo · B Bueno · R Regular · M Malo · N/T No tiene</p>
      {!cols.length ? <p>Aún no hay inspecciones.</p> : <table className="w-full border-collapse"><thead><tr className="bg-gray-200"><th className="border border-gray-400 px-1 text-left">Punto</th>{cols.map(c => <th key={c.v.id} className="border border-gray-400 px-1">{c.v.plate}</th>)}</tr></thead>
        <tbody>{[['Fecha', (c: typeof cols[0]) => fmtD(c.i!.date)], ['Conductor', (c: typeof cols[0]) => c.i!.driver], ['Km', (c: typeof cols[0]) => String(c.i!.km)], ['Combustible', (c: typeof cols[0]) => ['E', '¼', '½', '¾', 'F'][c.i!.fuel_level]]].map(([l, f]) => <tr key={l as string}><td className="border border-gray-400 px-1 font-semibold">{l as string}</td>{cols.map(c => <td key={c.v.id} className="border border-gray-400 px-1 text-center">{(f as (c: typeof cols[0]) => string)(c)}</td>)}</tr>)}
          {INSP.map(([g, ks]) => [<tr key={g} className="bg-gray-100"><td colSpan={cols.length + 1} className="border border-gray-400 px-1 font-bold">{g}</td></tr>, ...ks.map(k => <tr key={k}><td className="border border-gray-400 px-1">{k}</td>{cols.map(c => <td key={c.v.id} className="border border-gray-400 text-center font-bold">{c.i!.items[k]?.s === 'N' ? 'N/T' : c.i!.items[k]?.s ?? ''}</td>)}</tr>)])}</tbody></table>}</div></div>
}

function VehForm({ v, onClose, onDone }: { v: V | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: v?.name ?? '', plate: v?.plate ?? '', year: v?.year ?? '', chassis: v?.chassis ?? '', area: v?.area ?? '', driver: v?.driver ?? '', odometer: String(v?.odometer ?? ''), km_next: v?.km_next != null ? String(v.km_next) : '', km_interval: String(v?.km_interval ?? 8000), freq: (v?.insp_freq ?? 'quincenal') as 'quincenal' | 'mensual' | 'manual' })
  const [err, setErr] = useState('')
  const t = (k: keyof typeof f, type = 'text') => ({ type, value: f[k], className: inp, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) })
  async function save() {
    if (!f.name.trim() || !f.plate.trim()) return setErr('Marca y placa son obligatorias.')
    const body = { name: f.name.trim(), plate: f.plate.trim().toUpperCase(), year: f.year.trim(), chassis: f.chassis.trim(), area: f.area.trim(), driver: f.driver.trim() || 'Sin asignar', odometer: +f.odometer || 0, km_next: f.km_next ? +f.km_next : null, km_interval: +f.km_interval || 8000, insp_freq: f.freq }
    const { error } = v ? await supabase.from('insp_vehicles').update(body).eq('id', v.id) : await supabase.from('insp_vehicles').insert(body)
    if (error) return setErr(error.code === '23505' ? 'Ya existe un vehículo con esa placa.' : error.message)
    onDone(); onClose()
  }
  async function del() {
    if (!v || !confirm(`¿Eliminar ${v.name} (${v.plate})? Se borrará todo su historial de inspecciones.`)) return
    const { error } = await supabase.from('insp_vehicles').delete().eq('id', v.id)
    error ? setErr(error.message) : (onDone(), onClose())
  }
  return <div className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-[#05070c]/80 backdrop-blur-sm sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#111a2a] sm:rounded-2xl">
    <div className="flex items-center justify-between border-b border-white/[0.07] p-5"><h2 className="text-lg font-semibold text-white">{v ? 'Editar vehículo' : 'Agregar vehículo'}</h2><button onClick={onClose} aria-label="Cerrar" className="text-slate-500 hover:text-white"><X className="size-5" /></button></div>
    <div className="grid gap-4 p-5 sm:grid-cols-2"><Lab t="Marca / modelo"><input {...t('name')} placeholder="Mitsubishi Triton" /></Lab><Lab t="Placa"><input {...t('plate')} placeholder="0000-ABC" /></Lab><Lab t="Año (modelo)"><input {...t('year')} placeholder="2019" /></Lab><Lab t="Chasis"><input {...t('chassis')} /></Lab>
      <Lab t="Área"><input {...t('area')} list="areas" placeholder="Maquinaria" /></Lab><datalist id="areas"><option value="Maquinaria" /><option value="Insumos" /><option value="Comercio" /></datalist><Lab t="Dueño / conductor"><input {...t('driver')} /></Lab>
      <Lab t="Kilometraje actual"><input {...t('odometer', 'number')} /></Lab><Lab t="Km del próximo mantenimiento"><input {...t('km_next', 'number')} /></Lab><Lab t="Cada cuántos km (mantenimiento)"><input {...t('km_interval', 'number')} /></Lab><Lab t="Frecuencia de inspección"><select className={inp} value={f.freq} onChange={e => setF({ ...f, freq: e.target.value as typeof f.freq })}><option value="quincenal" className="bg-[#111a2a]">Cada 15 días</option><option value="mensual" className="bg-[#111a2a]">Cada mes</option><option value="manual" className="bg-[#111a2a]">Sin recordatorio (solo cuando se pida)</option></select></Lab>
      {err && <p className="text-xs text-red-300 sm:col-span-2">{err}</p>}
      <div className="flex items-center justify-between gap-2 sm:col-span-2">{v ? <button onClick={del} className="text-xs text-red-300 hover:underline">Eliminar</button> : <span />}<div className="flex gap-2"><button onClick={onClose} className="px-3 text-xs text-slate-400">Cancelar</button><button onClick={save} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Guardar</button></div></div></div></div></div>
}

function OwnerModal({ v, onClose, onDone }: { v: V; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(today())
  const [why, setWhy] = useState('')
  const [err, setErr] = useState('')
  async function save() {
    if (!name.trim()) return setErr('Escribe el nombre del nuevo dueño.')
    const u = await supabase.from('insp_vehicles').update({ driver: name.trim() }).eq('id', v.id)
    if (u.error) return setErr(u.error.message)
    const r = await supabase.from('insp_owner_log').insert({ vehicle_id: v.id, old_owner: v.driver, new_owner: name.trim(), reason: why.trim(), date })
    if (r.error) return setErr(r.error.message)
    onDone(); onClose()
  }
  return <div className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-[#05070c]/80 backdrop-blur-sm sm:items-center sm:p-6"><div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#111a2a] sm:rounded-2xl">
    <div className="flex items-center justify-between border-b border-white/[0.07] p-5"><div><h2 className="text-lg font-semibold text-white">Cambiar de dueño</h2><p className="mt-1 text-xs text-slate-500">{v.name} · {v.plate} · hoy: {v.driver}</p></div><button onClick={onClose} aria-label="Cerrar" className="text-slate-500 hover:text-white"><X className="size-5" /></button></div>
    <div className="flex flex-col gap-4 p-5"><Lab t="Nuevo dueño"><input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo" /></Lab><Lab t="Fecha del cambio"><input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} /></Lab><Lab t="Motivo (opcional)"><input className={inp} value={why} onChange={e => setWhy(e.target.value)} placeholder="Ej. el anterior dueño se retiró" /></Lab>
      {err && <p className="text-xs text-red-300">{err}</p>}<div className="flex justify-end gap-2"><button onClick={onClose} className="px-3 text-xs text-slate-400">Cancelar</button><button onClick={save} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Guardar cambio</button></div></div></div></div>
}

function MantModal({ v, onClose, onDone }: { v: V; onClose: () => void; onDone: () => void }) {
  const [next, setNext] = useState(v.km_next != null ? String(v.km_next) : '')
  const [every, setEvery] = useState(String(v.km_interval ?? 8000))
  const [err, setErr] = useState('')
  async function save(n: number | null) {
    const { error } = await supabase.from('insp_vehicles').update({ km_next: n, km_interval: +every || 8000 }).eq('id', v.id)
    error ? setErr(error.message) : (onDone(), onClose())
  }
  const done = () => { const e = +every || 8000; if (confirm(`¿Registrar mantenimiento realizado a ${v.odometer.toLocaleString('es-BO')} km? El próximo será a los ${(v.odometer + e).toLocaleString('es-BO')} km.`)) save(v.odometer + e) }
  return <div className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-[#05070c]/80 backdrop-blur-sm sm:items-center sm:p-6"><div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#111a2a] sm:rounded-2xl">
    <div className="flex items-center justify-between border-b border-white/[0.07] p-5"><div><h2 className="text-lg font-semibold text-white">Mantenimiento</h2><p className="mt-1 text-xs text-slate-500">{v.name} · {v.plate} · {v.odometer.toLocaleString('es-BO')} km actuales</p></div><button onClick={onClose} aria-label="Cerrar" className="text-slate-500 hover:text-white"><X className="size-5" /></button></div>
    <div className="flex flex-col gap-4 p-5"><Lab t="Km del próximo mantenimiento"><input type="number" className={inp} value={next} onChange={e => setNext(e.target.value)} /></Lab><Lab t="Se repite cada (km)"><input type="number" className={inp} value={every} onChange={e => setEvery(e.target.value)} /></Lab>
      {err && <p className="text-xs text-red-300">{err}</p>}
      <button onClick={done} className="h-10 rounded-xl border border-[#c6ff00]/40 bg-[#c6ff00]/10 text-xs font-semibold text-[#c6ff00]">Mantenimiento realizado ahora (reinicia el contador)</button>
      <div className="flex justify-end gap-2"><button onClick={onClose} className="px-3 text-xs text-slate-400">Cancelar</button><button onClick={() => save(next ? +next : null)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Guardar</button></div></div></div></div>
}

function Panel({ obs, vs, area, who, onBack, onDone, vehicleId, embedded }: { obs: Obs[]; vs: V[]; area: string; who: string; onBack: () => void; onDone: () => void; vehicleId?: string; embedded?: boolean }) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const list = obs.filter(o => { const v = vs.find(x => x.id === o.vehicle_id); return v && (!area || v.area === area) && (!vehicleId || o.vehicle_id === vehicleId) }).sort((a, b) => 'AMB'.indexOf(a.priority) - 'AMB'.indexOf(b.priority) || b.created_at.localeCompare(a.created_at))
  useEffect(() => { const ps = obs.map(o => o.photo).filter(Boolean) as string[]; if (ps.length) supabase.storage.from(BUCKET).createSignedUrls(ps, 3600).then(({ data }) => data && setUrls(Object.fromEntries(data.map(d => [d.path ?? '', d.signedUrl])))) }, [obs])
  async function setPri(o: Obs, k: Pri) {
    if (k === o.priority) return
    const { error } = await supabase.from('insp_observations').update({ priority: k }).eq('id', o.id)
    error ? alert(error.message) : onDone()
  }
  async function done(o: Obs) {
    if (!confirm('¿Marcar esta observación como resuelta?')) return
    const { error } = await supabase.from('insp_observations').update({ done: true, done_at: new Date().toISOString(), done_by: who }).eq('id', o.id)
    error ? alert(error.message) : onDone()
  }
  return <div><style>{KEEP}</style>
    {!embedded && <p className="print-only hidden mb-3 text-lg font-bold tracking-[0.15em]">CIAGRO SRL</p>}
    {!embedded && <div className="no-print mb-4 flex items-center gap-2"><button onClick={onBack} className="mr-auto flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft className="size-4" />Volver</button><button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Printer className="size-4" />Imprimir / PDF</button></div>}
    {embedded ? <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Pendientes de esta camioneta</h3> : <h2 className="text-2xl font-semibold text-white">Pendientes por prioridad{area && ` · ${area}`}</h2>}
    <div className="mt-4 grid grid-cols-3 gap-3">{(['A', 'M', 'B'] as Pri[]).map(k => <div key={k} className="keep-bg rounded-xl p-4 text-center" style={{ ...bg(PRI[k].c), color: k === 'M' ? '#000' : '#fff' }}><p className="text-3xl font-bold">{list.filter(o => o.priority === k).length}</p><p className="text-[11px] font-bold tracking-widest">{PRI[k].l}</p></div>)}</div>
    <div className="mt-5 flex flex-col gap-2">{list.map(o => { const v = vs.find(x => x.id === o.vehicle_id)!
      return <div key={o.id} className="frost-card flex gap-3 overflow-hidden"><div className="keep-bg w-3 shrink-0" style={bg(PRI[o.priority].c)} /><div className="flex flex-1 flex-wrap items-center gap-3 py-3 pr-4"><div className="min-w-0 flex-1"><p className="text-sm text-white">{o.text}</p><p className="mt-1 text-[11px] text-slate-500"><b className="font-mono text-slate-300">{v.plate}</b> · {v.name} · {v.driver}{v.area && ` · ${v.area}`} · {o.created_at.slice(0, 10).split('-').reverse().join('/')}</p>{o.photo && urls[o.photo] && <img src={urls[o.photo]} alt="" className="mt-2 h-20 rounded-lg" />}</div><div className="no-print flex items-center gap-1.5" title="Cambiar prioridad">{(['A', 'M', 'B'] as Pri[]).map(k => <button key={k} onClick={() => setPri(o, k)} aria-label={`Prioridad ${PRI[k].l}`} className="size-6 rounded-full border-2" style={{ background: PRI[k].c, borderColor: o.priority === k ? '#fff' : 'transparent', opacity: o.priority === k ? 1 : 0.35 }} />)}</div><button onClick={() => done(o)} className="no-print h-9 rounded-lg border border-white/15 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5">Resuelto</button></div></div> })}
      {!list.length && <p className="frost-card p-8 text-center text-sm text-slate-500">No hay observaciones pendientes.</p>}</div></div>
}

function WorkEdit({ w, closing, onClose, onDone }: { w: Work; closing?: boolean; onClose: () => void; onDone: () => void }) {
  const [exit, setExit] = useState(w.exit_date ?? (closing ? today() : ''))
  const [work, setWork] = useState(w.work)
  const [shop, setShop] = useState(w.shop)
  const [note, setNote] = useState(w.reason_note)
  const [err, setErr] = useState('')
  async function save() {
    if (exit && exit < w.entry_date) return setErr('La salida no puede ser antes del ingreso.')
    const { error } = await supabase.from('insp_workshop').update({ exit_date: exit || null, work: work.trim(), shop: shop.trim(), reason_note: note.trim() }).eq('id', w.id)
    error ? setErr(error.message) : (onDone(), onClose())
  }
  return <div className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-[#05070c]/80 backdrop-blur-sm sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#111a2a] sm:rounded-2xl">
    <div className="flex items-center justify-between border-b border-white/[0.07] p-5"><div><h2 className="text-lg font-semibold text-white">Salida y trabajos</h2><p className="mt-1 text-xs text-slate-500">Ingreso: {fmtD(w.entry_date)} · {w.reason}</p></div><button onClick={onClose} aria-label="Cerrar" className="text-slate-500 hover:text-white"><X className="size-5" /></button></div>
    <div className="flex flex-col gap-4 p-5"><Lab t="Fecha de salida (vacío = sigue en taller)"><input type="date" className={inp} value={exit} onChange={e => setExit(e.target.value)} /></Lab><Lab t="Trabajos realizados"><textarea className={inp + ' h-28 py-3'} value={work} onChange={e => setWork(e.target.value)} placeholder="Ej. Cambio de aceite y filtros, revisión de frenos" /></Lab><Lab t="Taller / mecánico"><input className={inp} value={shop} onChange={e => setShop(e.target.value)} /></Lab><Lab t="Detalle del motivo"><input className={inp} value={note} onChange={e => setNote(e.target.value)} /></Lab>
      {err && <p className="text-xs text-red-300">{err}</p>}<div className="flex justify-end gap-2"><button onClick={onClose} className="px-3 text-xs text-slate-400">Cancelar</button><button onClick={save} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Guardar</button></div></div></div></div>
}

function WorkForm({ v, who, obs, onClose, onDone }: { v: V; who: string; obs: Obs[]; onClose: () => void; onDone: (id: string) => void }) {
  const [f, setF] = useState({ entry: today(), exit: '', km: '', reason: REASONS[0], note: '', shop: '', work: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const pend = obs.filter(o => o.vehicle_id === v.id)
  async function save() {
    if (!f.entry) return setErr('Ingresa la fecha de ingreso.')
    if (isNaN(parseFloat(f.km))) return setErr('Ingresa el kilometraje de ingreso.')
    if (f.exit && f.exit < f.entry) return setErr('La salida no puede ser antes del ingreso.')
    setBusy(true)
    const { data, error } = await supabase.from('insp_workshop').insert({ vehicle_id: v.id, entry_date: f.entry, exit_date: f.exit || null, km: parseFloat(f.km), reason: f.reason, reason_note: f.note.trim(), shop: f.shop.trim(), work: f.work.trim(), created_by_name: who }).select('id').single()
    if (error) { setErr(error.message); setBusy(false); return }
    onDone(data.id)
  }
  return <div className="no-print mx-auto max-w-2xl">
    <button onClick={onClose} className="mb-4 flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft className="size-4" />Volver</button>
    <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: AMBER }}>Taller</p>
    <h2 className="mt-1 text-2xl font-semibold text-white">Ingreso a taller</h2>
    <p className="mt-1 text-sm text-slate-400">{v.name} · <span className="font-mono text-white">{v.plate}</span> · {v.driver}</p>
    <div className="frost-card mt-6 grid gap-4 p-5 sm:grid-cols-2">
      <Lab t="Fecha de ingreso"><input type="date" className={inp} value={f.entry} onChange={e => setF({ ...f, entry: e.target.value })} /></Lab><Lab t="Kilometraje de ingreso"><input type="number" inputMode="numeric" className={inp} value={f.km} onChange={e => setF({ ...f, km: e.target.value })} placeholder={String(v.odometer)} /></Lab>
      <Lab t="Motivo"><select className={inp} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })}>{REASONS.map(r => <option key={r} className="bg-[#111a2a]">{r}</option>)}</select></Lab><Lab t="Taller / mecánico"><input className={inp} value={f.shop} onChange={e => setF({ ...f, shop: e.target.value })} /></Lab>
      <div className="sm:col-span-2"><Lab t="Detalle del motivo"><input className={inp} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Ej. ruido en el tren delantero" /></Lab></div>
      <div className="sm:col-span-2"><Lab t="Trabajos realizados (se puede completar después)"><textarea className={inp + ' h-24 py-3'} value={f.work} onChange={e => setF({ ...f, work: e.target.value })} /></Lab></div>
      <Lab t="Fecha de salida (si ya salió)"><input type="date" className={inp} value={f.exit} onChange={e => setF({ ...f, exit: e.target.value })} /></Lab></div>
    {!!pend.length && <div className="frost-card mt-3 p-5"><h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Pendientes de esta camioneta</h3>{pend.map(o => <p key={o.id} className="flex items-center gap-2 py-1 text-sm text-slate-200"><span className="size-3 shrink-0 rounded-full" style={{ background: PRI[o.priority].c }} />{o.text}</p>)}</div>}
    {err && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
    <button disabled={busy} onClick={save} className="mt-5 h-12 w-full rounded-xl text-sm font-bold text-[#0b0f17] disabled:opacity-60" style={{ background: AMBER }}>{busy ? 'Guardando…' : 'Guardar ingreso a taller'}</button>
  </div>
}

function WorkReport({ w, v, onBack, onChanged, onDelete }: { w: Work; v?: V; onBack: () => void; onChanged: () => void; onDelete?: () => void }) {
  const [ed, setEd] = useState(false)
  const days = dayDiff(w.entry_date, w.exit_date ?? today())
  const row = (a: string, b?: string | null) => <div className="flex gap-2 border-b border-gray-300 py-1"><span className="w-40 shrink-0 font-semibold">{a}</span><span>{b || '—'}</span></div>
  return <div>
    <div className="no-print mb-4 flex flex-wrap items-center gap-2"><button onClick={onBack} className="mr-auto flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft className="size-4" />Volver</button>
      <button onClick={() => setEd(true)} className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-xs font-semibold text-slate-200"><Pencil className="size-4" />Editar / registrar salida</button>
      {onDelete && <button onClick={onDelete} className="flex h-10 items-center gap-1.5 rounded-xl border border-red-500/30 px-3 text-xs text-red-300"><Trash2 className="size-4" />Eliminar</button>}
      <button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Printer className="size-4" />Imprimir / PDF</button></div>
    <div className="mx-auto max-w-3xl rounded-lg bg-white p-6 text-[12px] text-black sm:p-10">
      <div className="mb-4 flex items-end justify-between border-b-2 border-black pb-3"><p className="text-lg font-bold tracking-[0.15em]">CIAGRO SRL</p><h1 className="text-right text-base font-bold uppercase">Orden de taller</h1></div>
      <div className="grid gap-x-6 sm:grid-cols-2">{row('Placa', v?.plate)}{row('Vehículo', v?.name)}{row('Dueño / conductor', v?.driver)}{row('Área', v?.area)}{row('Fecha de ingreso', fmtD(w.entry_date))}{row('Fecha de salida', w.exit_date ? fmtD(w.exit_date) : 'Aún en taller')}{row('Km de ingreso', w.km != null ? w.km.toLocaleString('es-BO') + ' km' : '')}{row('Días en taller', `${days} día${days === 1 ? '' : 's'}${w.exit_date ? '' : ' (hasta hoy)'}`)}{row('Motivo', w.reason)}{row('Detalle', w.reason_note)}{row('Taller / mecánico', w.shop)}{row('Registrado por', w.created_by_name)}</div>
      <div className="mt-4 break-inside-avoid"><p className="mb-1 font-semibold">Trabajos realizados</p><p className="min-h-24 whitespace-pre-wrap border border-gray-400 p-2">{w.work}</p></div>
      <div className="mt-12 grid grid-cols-2 gap-10 text-center break-inside-avoid"><div className="border-t border-black pt-1">Responsable del vehículo</div><div className="border-t border-black pt-1">Encargado de taller</div></div>
      <p className="mt-6 text-right text-[9px] text-gray-500">Registrado el {new Date(w.created_at).toLocaleString('es-BO')} · CIAGRO SRL</p>
    </div>
    {ed && <WorkEdit w={w} onClose={() => setEd(false)} onDone={onChanged} />}
  </div>
}

function Menu({ items }: { items: [string, () => void][] }) {
  const [open, setOpen] = useState(false)
  return <div className="relative"><button onClick={() => setOpen(o => !o)} aria-label="Más opciones" className="grid size-10 place-items-center rounded-xl border border-white/10 text-lg leading-none text-slate-300 hover:bg-white/5">⋯</button>
    {open && <><div className="fixed inset-0 z-10" onClick={() => setOpen(false)} /><div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#111a2a] shadow-xl">{items.map(([l, f]) => <button key={l} onClick={() => { setOpen(false); f() }} className="block w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/5">{l}</button>)}</div></>}</div>
}

function Hoy({ vs, ins, reqs, obs, wk, who, otherOverdue, onReload, openRep, onStart, openPend }: { vs: V[]; ins: Insp[]; reqs: Req[]; obs: Obs[]; wk: Work[]; who: string; otherOverdue: number; onReload: () => void; openRep: (id: string) => void; onStart: (v: V, k: Kind) => void; openPend: () => void }) {
  const [f, setF] = useState<'todas' | 'falta' | 'pedida' | 'hecha'>('todas')
  const [q, setQ] = useState('')
  const cur = period()
  const quin = vs.filter(v => (v.insp_freq ?? 'quincenal') === 'quincenal')
  const ord = { falta: 0, pedida: 1, hecha: 2 }
  const all = quin.map(v => { const last = ins.find(x => x.vehicle_id === v.id && x.kind === 'inspeccion'); const r = reqs.find(x => x.vehicle_id === v.id && x.period === cur); const st: 'hecha' | 'pedida' | 'falta' = last && period(last.date) === cur ? 'hecha' : r ? 'pedida' : 'falta'; return { v, last, r, st } }).sort((a, b) => ord[a.st] - ord[b.st] || a.v.plate.localeCompare(b.v.plate))
  const n = (k: string) => all.filter(r => r.st === k).length
  const words = plain(q).split(/\s+/).filter(Boolean)
  const rows = all.filter(r => (f === 'todas' || r.st === f) && (!words.length || words.every(w => plain(`${r.v.plate} ${r.v.driver} ${r.v.name} ${r.v.area}`).includes(w))))
  const reds = obs.filter(o => o.priority === 'A' && vs.some(v => v.id === o.vehicle_id)).length
  const inShop = wk.filter(w => !w.exit_date && vs.some(v => v.id === w.vehicle_id)).length
  const mant = vs.filter(v => v.km_next != null && v.km_next - v.odometer <= 1000).length
  const alerts = [reds && `${reds} pendiente${reds === 1 ? '' : 's'} en rojo`, inShop && `${inShop} en taller`, mant && `${mant} con mantenimiento cerca`, otherOverdue && `${otherOverdue} con inspección vencida`].filter((x): x is string => !!x)
  async function toggle(v: V, has: boolean) {
    const r = has ? await supabase.from('insp_requests').delete().eq('vehicle_id', v.id).eq('period', cur) : await supabase.from('insp_requests').insert({ vehicle_id: v.id, period: cur, requested_by: who })
    r.error ? alert(r.error.message) : onReload()
  }
  return <div>
    <h3 className="text-lg font-semibold text-white">Por inspeccionar</h3><p className="mt-0.5 text-xs text-slate-500">{periodLabel(cur)}</p>
    {alerts.length > 0 && <button onClick={openPend} className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-left text-xs text-red-200"><span>{alerts.join(' · ')}</span><span className="shrink-0 text-red-300">Ver →</span></button>}
    <div className="my-3 grid grid-cols-3 gap-2">{([['falta', 'Faltan', RED], ['pedida', 'Pedidas', AMBER], ['hecha', 'Hechas', GREEN]] as const).map(([k, l, c]) => <button key={k} onClick={() => setF(f === k ? 'todas' : k)} className="frost-card p-3 text-left" style={f === k ? { borderColor: c } : undefined}><p className="text-[11px] text-slate-400">{l}</p><p className="text-2xl font-medium" style={{ color: c }}>{n(k)}</p></button>)}</div>
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-500" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar placa o responsable…" className={inp} style={{ paddingLeft: 40 }} /></div>
    <div className="mt-3 flex flex-col gap-2">{rows.map(({ v, last, r, st }) => <div key={v.id} className={`frost-card flex flex-wrap items-center justify-between gap-3 p-3.5 ${st === 'hecha' ? 'opacity-60' : ''}`}>
      <div className="min-w-0"><p className="text-sm text-white"><b className="font-mono">{v.plate}</b> · {v.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{v.driver}{v.area && ` · ${v.area}`}{st === 'pedida' && r && <span style={{ color: AMBER }}> · pedida el {fmtD(r.requested_at)}</span>}{st === 'hecha' && <span style={{ color: GREEN }}> · hecha</span>}</p></div>
      <div className="flex items-center gap-3">{st === 'hecha' ? (last && <button onClick={() => openRep(last.id)} className="text-xs text-slate-400 underline hover:text-white">Ver informe</button>) : <><button onClick={() => toggle(v, !!r)} className="text-xs text-slate-400 underline hover:text-white">{r ? 'Quitar pedido' : 'Ya la pedí'}</button><button onClick={() => onStart(v, 'inspeccion')} className="h-9 rounded-lg px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Inspeccionar</button></>}</div></div>)}
      {!rows.length && <p className="frost-card p-6 text-center text-sm text-slate-500">No hay camionetas con ese filtro.</p>}</div>
    {vs.length > quin.length && <p className="mt-3 text-center text-[11px] text-slate-600">No incluye {vs.length - quin.length} camioneta(s) con inspección mensual o sin recordatorio. Están en Camionetas.</p>}
  </div>
}

function VehPicker({ vs, onPick }: { vs: V[]; onPick: (v: V) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const words = plain(q).split(/\s+/).filter(Boolean)
  const list = vs.filter(v => !words.length || words.every(w => plain(`${v.plate} ${v.name} ${v.driver} ${v.area}`).includes(w)))
  return <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-500" />
    <input value={q} onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="+ Nuevo ingreso a taller: buscar por placa o responsable…" className={inp} style={{ paddingLeft: 40, paddingRight: 40 }} />
    {q && <button type="button" aria-label="Borrar" onMouseDown={e => e.preventDefault()} onClick={() => setQ('')} className="absolute right-2 top-2.5 grid size-7 place-items-center rounded-full bg-white/10 text-base leading-none text-slate-200">×</button>}
    {open && <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-white/10 bg-[#111a2a] shadow-xl">{list.map(v => <button type="button" key={v.id} onMouseDown={e => e.preventDefault()} onClick={() => { setQ(''); setOpen(false); onPick(v) }} className="block w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-white/5"><b className="font-mono text-white">{v.plate}</b> · {v.name}<span className="block text-[11px] text-slate-500">{v.driver}{v.area && ` · ${v.area}`}</span></button>)}{!list.length && <p className="px-4 py-3 text-sm text-slate-500">Sin resultados</p>}</div>}</div>
}

function TallerTab({ vs, wk, openWork, onNew, onReload }: { vs: V[]; wk: Work[]; openWork: (id: string) => void; onNew: (v: V) => void; onReload: () => void }) {
  const [month, setMonth] = useState(today().slice(0, 7))
  const [wt, setWt] = useState<'mes' | '0' | '1' | '2' | '3' | 'act'>('mes')
  const [ex, setEx] = useState<Work | null>(null)
  const vOf = (id: string) => vs.find(x => x.id === id)
  const mine = wk.filter(w => vOf(w.vehicle_id))
  const t0 = new Date(today() + 'T00:00:00'), s0 = new Date(t0), e0 = new Date(t0)
  s0.setDate(t0.getDate() - ((t0.getDay() + 6) % 7)); e0.setDate(s0.getDate() + 6)
  const inMonth = mine.filter(w => w.entry_date.slice(0, 7) === month)
  const list = wt === 'act' ? mine.filter(w => w.entry_date >= ymd(s0) && w.entry_date <= ymd(e0)) : wt === 'mes' ? inMonth : inMonth.filter(w => Math.min(3, Math.floor((+w.entry_date.slice(8, 10) - 1) / 7)) === +wt)
  const btn = 'h-8 rounded-lg border border-white/15 px-3 text-[11px] font-semibold text-slate-300 hover:bg-white/5'
  const mlabel = `${MES[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`
  return <div>
    <div className="grid grid-cols-2 gap-2"><div className="frost-card p-3"><p className="text-[11px] text-slate-400">En taller ahora</p><p className="text-2xl font-medium" style={{ color: AMBER }}>{mine.filter(w => !w.exit_date).length}</p></div><div className="frost-card p-3"><p className="text-[11px] text-slate-400">Ingresos del mes</p><p className="text-2xl font-medium" style={{ color: CYAN }}>{inMonth.length}</p></div></div>
    <div className="mt-3"><VehPicker vs={vs} onPick={onNew} /></div>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-3"><h3 className="text-lg font-semibold text-white">Ingresos a taller</h3><input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 outline-none" /></div>
    <div className="mt-3 flex flex-wrap gap-2">{([['mes', 'Mes'], ['0', 'Semana 1'], ['1', 'Semana 2'], ['2', 'Semana 3'], ['3', 'Semana 4'], ['act', 'Actual']] as const).map(([k, l]) => <button key={k} onClick={() => setWt(k)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${wt === k ? 'border-[#ff8a00] bg-[#ff8a00]/10 text-[#ffae47]' : 'border-white/10 text-slate-400 hover:text-white'}`}>{l}</button>)}</div>
    <p className="mt-2 text-[11px] text-slate-500">{wt === 'act' ? `Semana actual: del ${fmtD(ymd(s0))} al ${fmtD(ymd(e0))}` : wt === 'mes' ? mlabel : `Semana ${+wt + 1} de ${mlabel}: días ${['1 al 7', '8 al 14', '15 al 21', '22 al fin de mes'][+wt]}`}</p>
    <div className="mt-3 flex flex-col gap-2">{list.map(w => { const v = vOf(w.vehicle_id)!; const open = !w.exit_date; const d = dayDiff(w.entry_date, w.exit_date ?? today())
      return <div key={w.id} className="frost-card flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="text-sm text-white"><b className="font-mono">{v.plate}</b> · {v.name} <span className="text-slate-500">· {v.driver}{v.area && ` · ${v.area}`}</span></p><p className="mt-1 text-[11px] text-slate-500">Ingreso {fmtD(w.entry_date)} · {w.reason}{w.exit_date && ` · salida ${fmtD(w.exit_date)}`}</p></div>
        <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={open ? { background: AMBER + '22', color: '#ffae47' } : { background: GREEN + '22', color: GREEN }}>{open ? 'En taller' : 'Entregada'} · {d} día{d === 1 ? '' : 's'}</span>
        {open && <button onClick={() => setEx(w)} className={btn}>Registrar salida</button>}<button onClick={() => openWork(w.id)} className={btn}>Informe</button></div> })}
      {!list.length && <p className="frost-card p-6 text-center text-sm text-slate-500">No hay ingresos a taller en este período.</p>}</div>

    
    {ex && <WorkEdit w={ex} closing onClose={() => setEx(null)} onDone={onReload} />}
  </div>
}

export default function Inspections({ isAdmin, who }: { isAdmin: boolean; who: string }) {
  const [vs, setVs] = useState<V[]>([])
  const [ins, setIns] = useState<Insp[]>([])
  const [obs, setObs] = useState<Obs[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [wk, setWk] = useState<Work[]>([])
  const [reqs, setReqs] = useState<Req[]>([])
  const [tab, setTab] = useState<'hoy' | 'veh' | 'taller' | 'inf'>('hoy')
  const [wfull, setWfull] = useState<Work | null>(null)
  const [scr, setScr] = useState<'list' | 'form' | 'hist' | 'rep' | 'matrix' | 'pend' | 'wform' | 'work'>('list')
  const [cur, setCur] = useState<V | null>(null)
  const [kind, setKind] = useState<Kind>('inspeccion')
  const [full, setFull] = useState<Insp | null>(null)
  const [vm, setVm] = useState<V | 'new' | null>(null)
  const [own, setOwn] = useState<V | null>(null)
  const [mt, setMt] = useState<V | null>(null)
  const [area, setArea] = useState('')
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [a, b, c, d, e, f] = await Promise.all([supabase.from('insp_vehicles').select('*').order('name'), supabase.from('inspections').select('id,vehicle_id,kind,date,place,inspector,driver,km,fuel_level,items,extra,notes,created_at').order('date', { ascending: false }).order('created_at', { ascending: false }), supabase.from('insp_observations').select('*').eq('done', false), supabase.from('insp_owner_log').select('*').order('date', { ascending: false }), supabase.from('insp_workshop').select('*').order('entry_date', { ascending: false }), supabase.from('insp_requests').select('*')])
    const er = a.error || b.error || c.error || d.error || e.error || f.error
    if (er) return setErr(er.message)
    setVs((a.data ?? []).map(r => ({ ...r, odometer: +r.odometer, km_next: r.km_next == null ? null : +r.km_next, km_interval: r.km_interval == null ? null : +r.km_interval })) as V[]); setIns((b.data ?? []) as Insp[]); setObs((c.data ?? []) as Obs[]); setOwners((d.data ?? []) as Owner[]); setWk((e.data ?? []).map(r => ({ ...r, km: r.km == null ? null : +r.km })) as Work[]); setReqs((f.data ?? []) as Req[]); setErr('')
  }, [])
  useEffect(() => { load() }, [load])

  async function openRep(id: string) {
    const { data, error } = await supabase.from('inspections').select('*').eq('id', id).single()
    if (error) return alert(error.message)
    setFull(data as Insp); setScr('rep')
  }
  async function openWorkId(id: string) {
    const { data, error } = await supabase.from('insp_workshop').select('*').eq('id', id).single()
    if (error) return alert(error.message)
    setWfull({ ...data, km: data.km == null ? null : +data.km } as Work); setScr('work')
  }
  async function delWork(w: Work) {
    if (!confirm('¿Eliminar esta visita a taller?')) return
    const { error } = await supabase.from('insp_workshop').delete().eq('id', w.id)
    if (error) return alert(error.message)
    setScr('list'); load()
  }
  async function delInsp(i: Insp) {
    if (!confirm('¿Eliminar este registro y sus fotos?')) return
    const { error } = await supabase.from('inspections').delete().eq('id', i.id)
    if (error) return alert(error.message)
    const ps = itemPaths(i); if (ps.length) await supabase.storage.from(BUCKET).remove(ps)
    setScr('list'); load()
  }
  const status = (id: string) => {
    const l = ins.find(x => x.vehicle_id === id && x.kind === 'inspeccion')
    const fr = vs.find(x => x.id === id)?.insp_freq ?? 'quincenal'
    const d = l ? Math.floor((Date.parse(today()) - Date.parse(l.date)) / 864e5) : null
    const t = d === null ? '' : d === 0 ? 'hoy' : `hace ${d} día${d === 1 ? '' : 's'}`
    if (fr === 'manual') return { c: '#64748b', t: l ? `Sin recordatorio · última ${t}` : 'Sin recordatorio', l }
    if (d === null) return { c: RED, t: 'Sin inspección', l }
    const lim = fr === 'mensual' ? 30 : 15, soon = fr === 'mensual' ? 25 : 12, tag = fr === 'mensual' ? ' · mensual' : ''
    return d > lim ? { c: RED, t: `Vencida · ${t}${tag}`, l } : d >= soon ? { c: AMBER, t: `Vence pronto · ${t}${tag}`, l } : { c: GREEN, t: `Al día · ${t}${tag}`, l }
  }
  const vOf = (id: string) => vs.find(x => x.id === id)
  const start = (v: V, k: Kind) => { setCur(v); setKind(k); setScr('form') }
  const areas = [...new Set(vs.map(v => v.area).filter(Boolean))].sort()
  const words = plain(q).split(/\s+/).filter(Boolean)
  const shown = vs.filter(v => (!area || v.area === area) && (!words.length || words.every(w => plain(`${v.plate} ${v.driver} ${v.name} ${v.area}`).includes(w))))
  const openAll = obs.filter(o => vs.some(v => v.id === o.vehicle_id))
  const cp = period()
  const nextV = (excl?: string) => vs.filter(v => v.id !== excl && (v.insp_freq ?? 'quincenal') === 'quincenal' && !ins.some(x => x.vehicle_id === v.id && x.kind === 'inspeccion' && period(x.date) === cp)).sort((a, b) => Number(reqs.some(r => r.vehicle_id === b.id && r.period === cp)) - Number(reqs.some(r => r.vehicle_id === a.id && r.period === cp)) || a.plate.localeCompare(b.plate))[0]
  const nv = scr === 'rep' && full?.kind === 'inspeccion' ? nextV(full.vehicle_id) : undefined
  const otherOverdue = vs.filter(v => (v.insp_freq ?? 'quincenal') !== 'quincenal' && status(v.id).c === RED).length

  if (scr === 'form' && cur) return <Form v={cur} kind={kind} who={who} onClose={() => setScr('list')} onDone={id => { load(); openRep(id) }} />
  if (scr === 'rep' && full) return <Report i={full} v={vOf(full.vehicle_id)} onBack={() => setScr(cur ? 'hist' : 'list')} onDelete={isAdmin ? () => delInsp(full) : undefined} onNext={nv ? () => start(nv, 'inspeccion') : undefined} nextLabel={nv ? `Siguiente: ${nv.plate} →` : undefined} onSigned={() => openRep(full.id)} />
  if (scr === 'wform' && cur) return <WorkForm v={cur} who={who} obs={obs} onClose={() => setScr('list')} onDone={id => { load(); openWorkId(id) }} />
  if (scr === 'work' && wfull) return <WorkReport w={wfull} v={vOf(wfull.vehicle_id)} onBack={() => setScr(cur ? 'hist' : 'list')} onChanged={() => { load(); openWorkId(wfull.id) }} onDelete={isAdmin ? () => delWork(wfull) : undefined} />
  if (scr === 'matrix') return <Matrix vs={vs} ins={ins} onBack={() => setScr('list')} />
  if (scr === 'pend') return <Panel obs={obs} vs={vs} area="" who={who} onBack={() => setScr('list')} onDone={load} />
  if (scr === 'hist' && cur) return <div className="no-print"><button onClick={() => { setCur(null); setScr('list') }} className="mb-4 flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft className="size-4" />Volver</button>
    <h2 className="text-2xl font-semibold text-white">Historial · {cur.name} <span className="font-mono text-base text-slate-400">{cur.plate}</span></h2>
    <p className="mt-1 text-xs text-slate-500">{cur.driver}{cur.area && ` · ${cur.area}`}{cur.km_next != null && ` · Próximo mantenimiento a los ${cur.km_next.toLocaleString('es-BO')} km (cada ${(cur.km_interval ?? 8000).toLocaleString('es-BO')} km)`}</p>
    <div className="mt-5"><Panel obs={obs} vs={vs} area="" vehicleId={cur.id} who={who} embedded onBack={() => {}} onDone={load} /></div>
    {wk.some(w => w.vehicle_id === cur.id) && <div className="frost-card mt-5 p-4"><h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Visitas a taller</h3>{wk.filter(w => w.vehicle_id === cur.id).map(w => <button key={w.id} onClick={() => openWorkId(w.id)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-xs text-slate-300 hover:text-white"><span><b className="text-white">{fmtD(w.entry_date)}</b> · {w.reason}</span><span className={w.exit_date ? 'text-[#c6ff00]' : 'text-amber-300'}>{w.exit_date ? `salida ${fmtD(w.exit_date)}` : 'en taller'}</span></button>)}</div>}
    {owners.some(o => o.vehicle_id === cur.id) && <div className="frost-card mt-5 p-4"><h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Historial de dueños</h3>{owners.filter(o => o.vehicle_id === cur.id).map(o => <p key={o.id} className="py-1 text-xs text-slate-300"><b className="text-white">{fmtD(o.date)}</b> · {o.old_owner ?? '—'} → <b className="text-white">{o.new_owner}</b>{o.reason && <span className="text-slate-500"> · {o.reason}</span>}</p>)}</div>}
    <div className="frost-card mt-5 divide-y divide-white/[0.06]">{ins.filter(x => x.vehicle_id === cur.id).map(x => { const m = Object.values(x.items).filter((i: Item) => i.s === 'M').length; const r = Object.values(x.items).filter((i: Item) => i.s === 'R').length; const pn = obs.filter(o => o.inspection_id === x.id).length
      return <button key={x.id} onClick={() => openRep(x.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm hover:bg-white/[0.03]"><span><b className="text-white">{fmtD(x.date)}</b> · <span className="capitalize">{KN[x.kind]}</span><span className="block text-xs text-slate-500">{x.inspector} · {(x.km ?? 0).toLocaleString('es-BO')} km</span></span><span className="flex items-center gap-3 text-xs">{m > 0 && <span className="text-red-300">{m} en Malo</span>}{r > 0 && <span className="text-amber-300">{r} en Regular</span>}{pn > 0 && <span className="text-yellow-200">{pn} pendiente{pn === 1 ? '' : 's'}</span>}{m + r + pn === 0 && <span className="text-[#c6ff00]">Sin fallas</span>}<FileText className="size-4 text-slate-500" /></span></button> })}
      {!ins.some(x => x.vehicle_id === cur.id) && <p className="p-8 text-center text-sm text-slate-600">Sin registros todavía.</p>}</div></div>

  const tabs = [['hoy', 'Hoy'], ['veh', 'Camionetas'], ['taller', 'Taller'], ['inf', 'Informes']] as const
  return <div className="no-print">
    <div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c6ff00]">Flota</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Inspecciones</h2></div>
    {err && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">No se pudo cargar: {err}. ¿Ya ejecutaste los archivos .sql en Supabase?</p>}
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-white/[0.08]">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap border-b-2 px-4 pb-3 text-sm font-semibold ${tab === k ? 'border-[#c6ff00] text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{l}</button>)}</div>

    {tab === 'hoy' && <Hoy vs={vs} ins={ins} reqs={reqs} obs={obs} wk={wk} who={who} otherOverdue={otherOverdue} onReload={load} openRep={id => { setCur(null); openRep(id) }} onStart={(v, k) => start(v, k)} openPend={() => setScr('pend')} />}

    {tab === 'veh' && <div>
      <div className="mb-3 flex items-center gap-2"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-500" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por placa, responsable o marca…" className={inp} style={{ paddingLeft: 40 }} /></div>{isAdmin && <button onClick={() => setVm('new')} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Plus className="size-4" />Agregar</button>}</div>
      {!!areas.length && <div className="mb-4 flex flex-wrap gap-2">{['', ...areas].map(a => <button key={a || 'todas'} onClick={() => setArea(a)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${area === a ? 'border-[#c6ff00] bg-[#c6ff00]/10 text-[#c6ff00]' : 'border-white/10 text-slate-400 hover:text-white'}`}>{a || 'Todas'}</button>)}</div>}
      {!shown.length && !err && <p className="frost-card p-8 text-center text-sm text-slate-500">{q || area ? 'Sin resultados con ese filtro.' : <>No hay vehículos. {isAdmin ? 'Agrega el primero.' : 'Pide a un administrador que los registre.'}</>}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.map(v => { const s = status(v.id); const mo = obs.filter(o => o.vehicle_id === v.id)
        const left = v.km_next != null ? v.km_next - v.odometer : null; const mc = left == null ? '' : left <= 1000 ? RED : AMBER
        const items: [string, () => void][] = [['Ingreso a taller', () => { setCur(v); setScr('wform') }], ['Recepción', () => start(v, 'recepcion')], ['Historial e informes', () => { setCur(v); setScr('hist') }], ...(isAdmin ? ([['Cambiar dueño', () => setOwn(v)], ['Mantenimiento', () => setMt(v)], ['Editar vehículo', () => setVm(v)]] as [string, () => void][]) : [])]
        return <div key={v.id} className="frost-card p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm text-white"><b className="font-mono">{v.plate}</b> · {v.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{v.driver}{v.area && ` · ${v.area}`}</p></div><div className="flex shrink-0 gap-1">{(['A', 'M', 'B'] as Pri[]).map(k => { const c = mo.filter(o => o.priority === k).length; return c > 0 && <span key={k} className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: PRI[k].c, color: k === 'M' ? '#000' : '#fff' }}>{c}</span> })}</div></div>
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold" style={{ color: s.c }}><span className="size-2 rounded-full" style={{ background: s.c }} />{s.t}</p>
          {left != null && left <= 2000 && <p className="mt-1 text-[11px]" style={{ color: mc }}>Mantenimiento: {left > 0 ? `faltan ${left.toLocaleString('es-BO')} km` : `pasado por ${Math.abs(left).toLocaleString('es-BO')} km`}</p>}
          <div className="mt-3 flex gap-2"><button onClick={() => start(v, 'inspeccion')} className="h-10 flex-1 rounded-xl text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Inspeccionar</button><Menu items={items} /></div></div> })}</div>
    </div>}

    {tab === 'taller' && <TallerTab vs={vs} wk={wk} openWork={id => { setCur(null); openWorkId(id) }} onNew={v => { setCur(v); setScr('wform') }} onReload={load} />}

    {tab === 'inf' && <div className="flex flex-col gap-3">
      <button onClick={() => setScr('pend')} className="frost-card flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 text-left hover:border-white/20"><span className="text-sm font-semibold text-white">Pendientes por prioridad</span>{(['A', 'M', 'B'] as Pri[]).map(k => <span key={k} className="flex items-center gap-2 text-sm text-slate-300"><span className="size-3 rounded-full" style={{ background: PRI[k].c }} /><b className="text-white">{openAll.filter(o => o.priority === k).length}</b></span>)}<span className="ml-auto text-xs text-slate-500">Ver →</span></button>
      <button onClick={() => setScr('matrix')} className="frost-card px-5 py-4 text-left text-sm font-semibold text-white hover:border-white/20">Informe general de inspecciones<span className="float-right text-xs font-normal text-slate-500">Ver e imprimir →</span></button>
      <h3 className="mt-3 text-sm font-semibold text-white">Últimas inspecciones</h3>
      <div className="frost-card divide-y divide-white/[0.06]">{ins.slice(0, 15).map(x => { const v = vOf(x.vehicle_id); return <button key={x.id} onClick={() => { setCur(null); openRep(x.id) }} className="flex w-full items-center justify-between gap-3 p-3.5 text-left text-sm hover:bg-white/[0.03]"><span><b className="font-mono text-white">{v?.plate ?? '—'}</b> · <span className="capitalize">{KN[x.kind]}</span><span className="block text-xs text-slate-500">{fmtD(x.date)} · {x.inspector}</span></span><FileText className="size-4 text-slate-500" /></button> })}{!ins.length && <p className="p-6 text-center text-sm text-slate-600">Aún no hay inspecciones.</p>}</div>
    </div>}

    {vm && <VehForm v={vm === 'new' ? null : vm} onClose={() => setVm(null)} onDone={load} />}
    {own && <OwnerModal v={own} onClose={() => setOwn(null)} onDone={load} />}
    {mt && <MantModal v={mt} onClose={() => setMt(null)} onDone={load} />}
  </div>
}
