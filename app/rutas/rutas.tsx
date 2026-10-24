'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Pencil, Plus, Printer, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Tech = { id: string; name: string; area: string; phone: string; active: boolean; off_from: string | null; off_to: string | null; off_reason: string }
type Veh = { id: string; name: string; plate: string; driver: string; area: string; odometer: number; km_next: number | null }
type Route = { id: string; number: number; year: number; week: number; tech_id: string | null; support: string[]; vehicle_id: string | null; depart_date: string; depart_time: string | null; return_date: string | null; cash: number; work_days: number | null; status: 'borrador' | 'confirmada' | 'cerrada'; notes: string; created_by_name: string; created_at: string }
type Req = { id: string; route_id: string | null; client: string; brand: string; machine: string; model: string; call_date: string | null; zone: string; contact: string; meeting_point: string; job: string; warranty: boolean; credit: boolean; priority: number; status: 'pendiente' | 'asignada' | 'hecha' | 'cancelada'; visit_date: string | null; amount: number | null; paid_date: string | null; notes: string; created_by_name: string; created_at: string }
type Change = { id: string; who: string; what: string; at: string }
type Draft = { tech_id: string | null; support: string[]; vehicle_id: string | null; depart_date: string; return_date: string | null }

const GREEN = '#c6ff00', AMBER = '#ff8a00', RED = '#ef4444', VIOLET = '#a78bfa'
const PRI = ['', '#ff0000', '#ffd400', '#34a853']
const PRIL = ['', 'Alta', 'Normal', 'Baja']
const FIRMAS = [['GUIDO MORENO', 'SUBGERENTE SERVICIO TEC.'], ['NICOLAS FAREL', 'JEFE DE TALLER'], ['YEYSON BASTO', 'ASIS. PROGRAM. SERV. TEC.']]
const inp = 'h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#00d2ff]'
const btn = 'h-9 rounded-lg border border-white/15 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5'
const DN = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => ymd(new Date())
const fmtD = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '—')
const end = (r: { depart_date: string; return_date: string | null }) => r.return_date || r.depart_date
const overlap = (a: Draft, b: { depart_date: string; return_date: string | null }) => a.depart_date <= end(b) && b.depart_date <= end({ depart_date: a.depart_date, return_date: a.return_date })
function isoWeek(s: string) {
  const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3)
  const f = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return { year: d.getUTCFullYear(), week: 1 + Math.round(((d.getTime() - f.getTime()) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7) }
}
function workDays(a: string, b: string) { let n = 0; for (let t = Date.parse(a); t <= Date.parse(b); t += 864e5) { const g = new Date(t).getUTCDay(); if (g !== 0 && g !== 6) n++ } return n }

function Lab({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t}</span>{children}</label>
}
function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-[#05070c]/80 backdrop-blur-sm sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#111a2a] sm:rounded-2xl">
    <div className="flex items-center justify-between border-b border-white/[0.07] p-5"><div><h2 className="text-lg font-semibold text-white">{title}</h2>{sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}</div><button onClick={onClose} aria-label="Cerrar" className="text-slate-500 hover:text-white"><X className="size-5" /></button></div>
    <div className="p-5">{children}</div></div></div>
}
const Chip = ({ c, t }: { c: string; t: string }) => <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: c + '22', color: c }}>{t}</span>

function TechForm({ t, onClose, onDone }: { t: Tech | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: t?.name ?? '', area: t?.area ?? '', phone: t?.phone ?? '', active: t?.active ?? true, from: t?.off_from ?? '', to: t?.off_to ?? '', why: t?.off_reason || 'Vacación' })
  const [err, setErr] = useState('')
  async function save() {
    if (!f.name.trim()) return setErr('Escribe el nombre.')
    if ((f.from && !f.to) || (!f.from && f.to) || (f.from && f.to < f.from)) return setErr('Revisa las fechas de ausencia.')
    const body = { name: f.name.trim(), area: f.area.trim(), phone: f.phone.trim(), active: f.active, off_from: f.from || null, off_to: f.to || null, off_reason: f.from ? f.why : '' }
    const { error } = t ? await supabase.from('rt_technicians').update(body).eq('id', t.id) : await supabase.from('rt_technicians').insert(body)
    if (error) return setErr(error.code === '23505' ? 'Ya existe un técnico con ese nombre.' : error.message)
    onDone(); onClose()
  }
  return <Modal title={t ? 'Editar técnico' : 'Agregar técnico'} onClose={onClose}><div className="grid gap-4 sm:grid-cols-2">
    <Lab t="Nombre"><input className={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Lab>
    <Lab t="Área"><input className={inp} list="areas-rt" value={f.area} onChange={e => setF({ ...f, area: e.target.value })} /></Lab>
    <datalist id="areas-rt">{['Tractores', 'Cosechadoras', 'Maq. pesadas', 'Electricidad', 'Equipos livianos', 'Otros', 'Ayudante'].map(a => <option key={a} value={a} />)}</datalist>
    <Lab t="Teléfono (opcional)"><input className={inp} inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Lab>
    <label className="flex items-center gap-2 pt-6 text-sm text-slate-300"><input type="checkbox" className="size-5" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />Activo</label>
    <Lab t="Ausente desde"><input type="date" className={inp} value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></Lab><Lab t="Hasta"><input type="date" className={inp} value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></Lab>
    <div className="sm:col-span-2"><Lab t="Motivo de la ausencia"><select className={inp} value={f.why} onChange={e => setF({ ...f, why: e.target.value })}><option className="bg-[#111a2a]">Vacación</option><option className="bg-[#111a2a]">No disponible</option></select></Lab></div>
    {err && <p className="text-xs text-red-300 sm:col-span-2">{err}</p>}
    <div className="flex justify-end gap-2 sm:col-span-2"><button onClick={onClose} className="px-3 text-xs text-slate-400">Cancelar</button><button onClick={save} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Guardar</button></div></div></Modal>
}

function ReqForm({ q, route, clients, who, onClose, onDone }: { q: Req | null; route: Route | null; clients: string[]; who: string; onClose: () => void; onDone: (what?: string) => void }) {
  const assigned = !!(route || q?.route_id)
  const [f, setF] = useState({ client: q?.client ?? '', brand: q?.brand ?? '', machine: q?.machine ?? '', model: q?.model ?? '', call: q?.call_date ?? today(), zone: q?.zone ?? '', contact: q?.contact ?? '', meet: q?.meeting_point ?? '', job: q?.job ?? '', warranty: q?.warranty ?? false, credit: q?.credit ?? false, pri: String(q?.priority ?? 2), visit: q?.visit_date ?? route?.depart_date ?? '', amount: q?.amount != null ? String(q.amount) : '', paid: q?.paid_date ?? '', done: q?.status === 'hecha' })
  const [err, setErr] = useState('')
  const t = (k: 'client' | 'brand' | 'machine' | 'model' | 'zone' | 'contact' | 'meet') => ({ className: inp, value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) })
  async function save() {
    if (!f.client.trim()) return setErr('Escribe el cliente.')
    if (!f.job.trim()) return setErr('Escribe el trabajo solicitado.')
    const rid = route?.id ?? q?.route_id ?? null
    const body = { client: f.client.trim(), brand: f.brand.trim(), machine: f.machine.trim(), model: f.model.trim(), call_date: f.call || null, zone: f.zone.trim(), contact: f.contact.trim(), meeting_point: f.meet.trim(), job: f.job.trim(), warranty: f.warranty, credit: f.credit, priority: +f.pri, route_id: rid, status: !rid ? (q?.status === 'cancelada' ? 'cancelada' : 'pendiente') : f.done ? 'hecha' : 'asignada', visit_date: rid ? f.visit || null : null, amount: f.amount ? +f.amount : null, paid_date: f.paid || null }
    const { error } = q ? await supabase.from('rt_requests').update(body).eq('id', q.id) : await supabase.from('rt_requests').insert({ ...body, created_by_name: who })
    if (error) return setErr(error.message)
    onDone(`${q ? 'Editó' : 'Agregó'} la visita: ${body.client}`); onClose()
  }
  const sel = (k: 'warranty' | 'credit') => <select className={inp} value={f[k] ? 'si' : 'no'} onChange={e => setF({ ...f, [k]: e.target.value === 'si' })}><option value="no" className="bg-[#111a2a]">No</option><option value="si" className="bg-[#111a2a]">Sí</option></select>
  return <Modal title={q ? 'Editar solicitud' : 'Nueva solicitud'} sub={route ? `Se agrega a la ruta ${route.number}` : undefined} onClose={onClose}><div className="grid gap-4 sm:grid-cols-2">
    <div className="sm:col-span-2"><Lab t="Cliente"><input {...t('client')} list="clientes-rt" /></Lab></div><datalist id="clientes-rt">{clients.map(c => <option key={c} value={c} />)}</datalist>
    <Lab t="Marca"><input {...t('brand')} list="marcas-rt" placeholder="New Holland" /></Lab><datalist id="marcas-rt">{['New Holland', 'Develon', 'Case', 'John Deere'].map(c => <option key={c} value={c} />)}</datalist>
    <Lab t="Máquina"><input {...t('machine')} list="maq-rt" placeholder="Tractor" /></Lab><datalist id="maq-rt">{['Tractor', 'Excavadora', 'Cosechadora', 'Pulverizadora', 'Cargador'].map(c => <option key={c} value={c} />)}</datalist>
    <Lab t="Modelo"><input {...t('model')} /></Lab><Lab t="Fecha de llamada"><input type="date" className={inp} value={f.call} onChange={e => setF({ ...f, call: e.target.value })} /></Lab>
    <Lab t="Zona"><input {...t('zone')} list="zonas-rt" /></Lab><datalist id="zonas-rt">{['Norte', 'Este', 'Sur', 'Oeste'].map(c => <option key={c} value={c} />)}</datalist>
    <Lab t="Contacto (teléfono y nombre)"><input {...t('contact')} /></Lab>
    <div className="sm:col-span-2"><Lab t="Punto de encuentro"><input {...t('meet')} /></Lab></div>
    <div className="sm:col-span-2"><Lab t="Trabajo solicitado"><textarea className={inp + ' h-24 py-3'} value={f.job} onChange={e => setF({ ...f, job: e.target.value })} /></Lab></div>
    <Lab t="Garantía">{sel('warranty')}</Lab><Lab t="Crédito">{sel('credit')}</Lab>
    <div className="sm:col-span-2"><Lab t="Prioridad"><select className={inp} value={f.pri} onChange={e => setF({ ...f, pri: e.target.value })}>{[1, 2, 3].map(n => <option key={n} value={n} className="bg-[#111a2a]">{n} · {PRIL[n]}</option>)}</select></Lab></div>
    {assigned && <><Lab t="Fecha de visita"><input type="date" className={inp} value={f.visit} onChange={e => setF({ ...f, visit: e.target.value })} /></Lab><label className="flex items-center gap-2 pt-6 text-sm text-slate-300"><input type="checkbox" className="size-5" checked={f.done} onChange={e => setF({ ...f, done: e.target.checked })} />Visita hecha</label>
      <Lab t="Monto cancelado (Bs)"><input type="number" inputMode="decimal" className={inp} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Lab><Lab t="Fecha de pago"><input type="date" className={inp} value={f.paid} onChange={e => setF({ ...f, paid: e.target.value })} /></Lab></>}
    {err && <p className="text-xs text-red-300 sm:col-span-2">{err}</p>}
    <div className="flex justify-end gap-2 sm:col-span-2"><button onClick={onClose} className="px-3 text-xs text-slate-400">Cancelar</button><button onClick={save} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Guardar</button></div></div></Modal>
}

function RouteSheet({ r, techs, veh, visits, onBack }: { r: Route; techs: Tech[]; veh?: Veh; visits: Req[]; onBack: () => void }) {
  const nm = (id?: string | null) => techs.find(t => t.id === id)?.name ?? '—'
  const cell = 'border border-gray-400 px-1 py-0.5 align-top'
  const rows = [...visits].sort((a, b) => (a.visit_date ?? '9').localeCompare(b.visit_date ?? '9'))
  return <div><style>{'@media print{@page{size:landscape;margin:10mm}.keep-bg{background:var(--bg)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}'}</style>
    <div className="no-print mb-4 flex items-center gap-2"><button onClick={onBack} className="mr-auto flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft className="size-4" />Volver</button><button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Printer className="size-4" />Imprimir / PDF</button></div>
    <div className="overflow-x-auto rounded-lg bg-white p-5 text-[11px] text-black">
      <div className="mb-3 flex items-end justify-between border-b-2 border-black pb-2"><p className="text-lg font-bold tracking-[0.15em]">CIAGRO SRL</p><h1 className="text-base font-bold uppercase">Ruta de trabajo</h1><p className="text-sm">Semana <b>{r.week}</b> · Año <b>{r.year}</b> · Nº <b>{r.number}</b></p></div>
      <div className="grid gap-x-6 sm:grid-cols-2">{[['Técnico asignado', nm(r.tech_id)], ['Técnico de apoyo', r.support.length ? r.support.map(nm).join(' - ') : '-'], ['Vehículo (placa)', veh ? `${veh.plate} · ${veh.name}` : '—'], ['Salida (fecha / hora)', `${fmtD(r.depart_date)} ${r.depart_time ? r.depart_time.slice(0, 5) : ''}`], ['Retorno estimado', fmtD(r.return_date)], ['Efectivo asignado (Bs)', `${r.cash.toLocaleString('es-BO')} · ${r.work_days ?? '-'} días laborales`]].map(([a, b]) => <div key={a} className="flex gap-2 border-b border-gray-300 py-1"><span className="w-40 shrink-0 font-semibold">{a}</span><span>{b}</span></div>)}</div>
      <p className="mb-1 mt-3 text-[10px]">Prioridad: 1 = Alta / 2 = Normal / 3 = Baja</p>
      <table className="w-full min-w-[900px] border-collapse"><thead><tr className="bg-gray-200">{['Nº', 'Cliente', 'Marca', 'Máquina', 'Modelo', 'F. llamada', 'Zona', 'Contacto', 'Punto de encuentro', 'Trabajo solicitado', 'Garantía', 'Crédito', 'Prior.', 'Monto Bs', 'F. pago', 'F. visita'].map(h => <th key={h} className={cell + ' text-left'}>{h}</th>)}</tr></thead>
        <tbody>{Array.from({ length: Math.max(6, rows.length) }, (_, i) => { const v = rows[i]; return <tr key={i}><td className={cell}>{i + 1}</td>{v ? <><td className={cell}>{v.client}</td><td className={cell}>{v.brand}</td><td className={cell}>{v.machine}</td><td className={cell}>{v.model}</td><td className={cell}>{fmtD(v.call_date)}</td><td className={cell}>{v.zone}</td><td className={cell}>{v.contact}</td><td className={cell}>{v.meeting_point}</td><td className={cell + ' whitespace-pre-wrap'}>{v.job}</td><td className={cell}>{v.warranty ? 'SI' : 'NO'}</td><td className={cell}>{v.credit ? 'SI' : 'NO'}</td><td className={cell + ' keep-bg text-center font-bold'} style={{ '--bg': PRI[v.priority], background: PRI[v.priority] } as React.CSSProperties}>{v.priority}</td><td className={cell}>{v.amount != null ? v.amount.toLocaleString('es-BO') : '-'}</td><td className={cell}>{v.paid_date ? fmtD(v.paid_date) : '-'}</td><td className={cell}>{fmtD(v.visit_date)}</td></> : Array.from({ length: 15 }, (_, k) => <td key={k} className={cell}>&nbsp;</td>)}</tr> })}</tbody></table>
      <div className="mt-12 grid grid-cols-3 gap-10 text-center">{FIRMAS.map(([n, c]) => <div key={n} className="border-t border-black pt-1"><b>{n}</b><br /><span className="text-[10px]">{c}</span></div>)}</div>
      {r.notes && <p className="mt-3"><b>Observaciones:</b> {r.notes}</p>}
    </div></div>
}

export default function Rutas({ isAdmin, who }: { isAdmin: boolean; who: string }) {
  const [techs, setTechs] = useState<Tech[]>([])
  const [vehs, setVehs] = useState<Veh[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [reqs, setReqs] = useState<Req[]>([])
  const [shops, setShops] = useState<string[]>([])
  const [reds, setReds] = useState<string[]>([])
  const [tab, setTab] = useState<'semana' | 'rutas' | 'solicitudes' | 'tecnicos'>('semana')
  const [scr, setScr] = useState<'main' | 'detail' | 'sheet' | 'rform'>('main')
  const [rid, setRid] = useState<string | null>(null)
  const [tm, setTm] = useState<Tech | 'new' | null>(null)
  const [rq, setRq] = useState<{ q: Req | null; route: Route | null } | null>(null)
  const [rfilter, setRfilter] = useState<'abiertas' | 'cerradas' | 'todas'>('abiertas')
  const [qfilter, setQfilter] = useState<'pendiente' | 'todas'>('pendiente')
  const [off, setOff] = useState(0)
  const [hist, setHist] = useState<Change[]>([])
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [a, b, c, d, e, f] = await Promise.all([
      supabase.from('rt_technicians').select('*').order('name'),
      supabase.from('insp_vehicles').select('id,name,plate,driver,area,odometer,km_next').order('plate'),
      supabase.from('rt_routes').select('*').order('number', { ascending: false }),
      supabase.from('rt_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('insp_workshop').select('vehicle_id').is('exit_date', null),
      supabase.from('insp_observations').select('vehicle_id').eq('done', false).eq('priority', 'A'),
    ])
    const er = a.error || b.error || c.error || d.error
    if (er) return setErr(er.message)
    setTechs((a.data ?? []) as Tech[])
    setVehs((b.data ?? []).map(r => ({ ...r, odometer: +r.odometer, km_next: r.km_next == null ? null : +r.km_next })) as Veh[])
    setRoutes((c.data ?? []).map(r => ({ ...r, cash: +(r.cash ?? 0), support: r.support ?? [] })) as Route[])
    setReqs((d.data ?? []).map(r => ({ ...r, amount: r.amount == null ? null : +r.amount })) as Req[])
    setShops((e.data ?? []).map(r => r.vehicle_id)); setReds((f.data ?? []).map(r => r.vehicle_id)); setErr('')
  }, [])
  useEffect(() => { load() }, [load])
  const [deep, setDeep] = useState<string | null>(null)
  useEffect(() => { setDeep(new URLSearchParams(window.location.search).get('ruta')) }, [])
  useEffect(() => { if (deep && routes.some(r => r.id === deep)) { setRid(deep); setScr('detail'); setDeep(null) } }, [deep, routes])
  useEffect(() => { if (rid && scr === 'detail') supabase.from('rt_changes').select('id,who,what,at').eq('route_id', rid).order('at', { ascending: false }).then(({ data }) => setHist((data ?? []) as Change[])) }, [rid, scr, routes, reqs])

  const tName = (id?: string | null) => techs.find(t => t.id === id)?.name ?? '—'
  const vOf = (id?: string | null) => vehs.find(v => v.id === id)
  const route = routes.find(r => r.id === rid) ?? null
  const log = (id: string, what: string) => supabase.from('rt_changes').insert({ route_id: id, who, what })
  const open = (id: string) => { setRid(id); setScr('detail') }

  function techState(t: Tech, d = today()) {
    if (!t.active) return { l: 'Inactivo', c: '#64748b' }
    if (t.off_from && t.off_to && d >= t.off_from && d <= t.off_to) return { l: t.off_reason || 'No disponible', c: VIOLET }
    const act = routes.filter(r => r.status === 'confirmada' && [r.tech_id, ...r.support].includes(t.id))
    if (act.some(r => r.depart_date <= d && d <= end(r))) return { l: 'Ocupado', c: RED }
    if (act.some(r => r.depart_date > d)) return { l: 'Asignado', c: AMBER }
    return { l: 'Disponible', c: GREEN }
  }
  function vehState(v: Veh, d = today()) {
    if (shops.includes(v.id)) return { l: 'En taller', c: AMBER }
    const act = routes.filter(r => r.status === 'confirmada' && r.vehicle_id === v.id)
    if (act.some(r => r.depart_date <= d && d <= end(r))) return { l: 'En ruta', c: RED }
    if (act.some(r => r.depart_date > d)) return { l: 'Asignada', c: AMBER }
    return { l: 'Disponible', c: GREEN }
  }
  function warn(r: Draft, selfId: string | null) {
    const w: string[] = []
    const busy = routes.filter(x => x.id !== selfId && x.status !== 'cerrada' && overlap(r, x))
    for (const id of [r.tech_id, ...r.support].filter(Boolean) as string[]) {
      const t = techs.find(x => x.id === id); if (!t) continue
      if (t.off_from && t.off_to && t.off_from <= end(r) && r.depart_date <= t.off_to) w.push(`${t.name} tiene ${(t.off_reason || 'no disponible').toLowerCase()} del ${fmtD(t.off_from)} al ${fmtD(t.off_to)}.`)
      const o = busy.find(x => [x.tech_id, ...x.support].includes(id)); if (o) w.push(`${t.name} ya está en la ruta ${o.number} (${fmtD(o.depart_date)} al ${fmtD(end(o))}).`)
    }
    const v = vOf(r.vehicle_id)
    if (v) {
      const o = busy.find(x => x.vehicle_id === v.id); if (o) w.push(`La camioneta ${v.plate} ya está en la ruta ${o.number}.`)
      if (shops.includes(v.id)) w.push(`La camioneta ${v.plate} está en taller.`)
      const n = reds.filter(x => x === v.id).length; if (n) w.push(`${v.plate} tiene ${n} pendiente${n === 1 ? '' : 's'} en rojo (prioridad alta).`)
      if (v.km_next != null && v.km_next - v.odometer <= 1000) w.push(`${v.plate}: mantenimiento próximo (${(v.km_next - v.odometer).toLocaleString('es-BO')} km).`)
    }
    return w
  }
  const Warn = ({ list }: { list: string[] }) => list.length ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">{list.map((w, i) => <p key={i} className="py-0.5">⚠ {w}</p>)}</div> : null

  function RouteForm({ r }: { r: Route | null }) {
    const [d, setD] = useState({ tech_id: r?.tech_id ?? '', support: r?.support ?? [] as string[], vehicle_id: r?.vehicle_id ?? '', depart_date: r?.depart_date ?? today(), depart_time: r?.depart_time?.slice(0, 5) ?? '', return_date: r?.return_date ?? '', cash: String(r?.cash ?? ''), days: r?.work_days != null ? String(r.work_days) : '', notes: r?.notes ?? '' })
    const [e, setE] = useState('')
    const auto = d.return_date && d.return_date >= d.depart_date ? workDays(d.depart_date, d.return_date) : null
    const ws = warn({ tech_id: d.tech_id || null, support: d.support, vehicle_id: d.vehicle_id || null, depart_date: d.depart_date, return_date: d.return_date || null }, r?.id ?? null)
    const act = techs.filter(t => t.active)
    async function save() {
      if (!d.tech_id || !d.vehicle_id || !d.depart_date) return setE('Elige el técnico, la camioneta y la fecha de salida.')
      if (d.return_date && d.return_date < d.depart_date) return setE('El retorno no puede ser antes de la salida.')
      const iw = isoWeek(d.depart_date)
      const body = { tech_id: d.tech_id, support: d.support.filter(x => x !== d.tech_id), vehicle_id: d.vehicle_id, depart_date: d.depart_date, depart_time: d.depart_time || null, return_date: d.return_date || null, cash: +d.cash || 0, work_days: d.days ? +d.days : auto, notes: d.notes.trim(), year: iw.year, week: iw.week }
      if (r) {
        const { error } = await supabase.from('rt_routes').update(body).eq('id', r.id)
        if (error) return setE(error.message)
        const ch: string[] = []
        if (r.tech_id !== body.tech_id) ch.push(`Técnico: ${tName(r.tech_id)} → ${tName(body.tech_id)}`)
        if (r.support.join() !== body.support.join()) ch.push(`Apoyo: ${r.support.map(tName).join(', ') || '-'} → ${body.support.map(tName).join(', ') || '-'}`)
        if (r.vehicle_id !== body.vehicle_id) ch.push(`Camioneta: ${vOf(r.vehicle_id)?.plate ?? '-'} → ${vOf(body.vehicle_id)?.plate ?? '-'}`)
        if (r.depart_date !== body.depart_date || (r.depart_time ?? '').slice(0, 5) !== (body.depart_time ?? '')) ch.push(`Salida: ${fmtD(r.depart_date)} → ${fmtD(body.depart_date)} ${body.depart_time ?? ''}`)
        if ((r.return_date ?? '') !== (body.return_date ?? '')) ch.push(`Retorno: ${fmtD(r.return_date)} → ${fmtD(body.return_date)}`)
        if (r.cash !== body.cash) ch.push(`Efectivo: ${r.cash} → ${body.cash} Bs`)
        if (ch.length) await log(r.id, ch.join(' · '))
        await load(); open(r.id)
      } else {
        const { data, error } = await supabase.from('rt_routes').insert({ ...body, created_by_name: who }).select('id').single()
        if (error) return setE(error.message)
        await log(data.id, 'Creó la ruta'); await load(); open(data.id)
      }
    }
    const toggleSup = (id: string) => setD({ ...d, support: d.support.includes(id) ? d.support.filter(x => x !== id) : [...d.support, id] })
    return <div className="no-print mx-auto max-w-2xl">
      <button onClick={() => (r ? open(r.id) : setScr('main'))} className="mb-4 flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft className="size-4" />Volver</button>
      <h2 className="text-2xl font-semibold text-white">{r ? `Editar ruta ${r.number}` : 'Nueva ruta'}</h2>
      <div className="frost-card mt-5 grid gap-4 p-5 sm:grid-cols-2">
        <Lab t="Técnico asignado"><select className={inp} value={d.tech_id} onChange={x => setD({ ...d, tech_id: x.target.value })}><option value="" className="bg-[#111a2a]">Elegir…</option>{act.map(t => { const s = techState(t, d.depart_date); return <option key={t.id} value={t.id} className="bg-[#111a2a]">{t.name} · {s.l}</option> })}</select></Lab>
        <Lab t="Camioneta"><select className={inp} value={d.vehicle_id} onChange={x => setD({ ...d, vehicle_id: x.target.value })}><option value="" className="bg-[#111a2a]">Elegir…</option>{[...vehs].sort((a, b) => Number(b.area === 'Servicio') - Number(a.area === 'Servicio') || a.plate.localeCompare(b.plate)).map(v => <option key={v.id} value={v.id} className="bg-[#111a2a]">{v.plate} · {v.name} · {vehState(v, d.depart_date).l}</option>)}</select></Lab>
        <div className="sm:col-span-2"><Lab t="Técnicos de apoyo"><div className="flex flex-wrap gap-2">{act.filter(t => t.id !== d.tech_id).map(t => <button type="button" key={t.id} onClick={() => toggleSup(t.id)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${d.support.includes(t.id) ? 'border-[#c6ff00] bg-[#c6ff00]/10 text-[#c6ff00]' : 'border-white/10 text-slate-400'}`}>{t.name}</button>)}</div></Lab></div>
        <Lab t="Fecha de salida"><input type="date" className={inp} value={d.depart_date} onChange={x => setD({ ...d, depart_date: x.target.value })} /></Lab><Lab t="Hora de salida"><input type="time" className={inp} value={d.depart_time} onChange={x => setD({ ...d, depart_time: x.target.value })} /></Lab>
        <Lab t="Retorno estimado"><input type="date" className={inp} value={d.return_date} onChange={x => setD({ ...d, return_date: x.target.value })} /></Lab><Lab t={`Días laborales${auto != null ? ` (calculado: ${auto})` : ''}`}><input type="number" className={inp} value={d.days} placeholder={auto != null ? String(auto) : ''} onChange={x => setD({ ...d, days: x.target.value })} /></Lab>
        <Lab t="Efectivo asignado (Bs)"><input type="number" inputMode="decimal" className={inp} value={d.cash} onChange={x => setD({ ...d, cash: x.target.value })} /></Lab><Lab t="Observaciones"><input className={inp} value={d.notes} onChange={x => setD({ ...d, notes: x.target.value })} /></Lab>
        {iwInfo(d.depart_date)}</div>
      <div className="mt-4"><Warn list={ws} /></div>
      {e && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{e}</p>}
      <button onClick={save} className="mt-5 h-12 w-full rounded-xl text-sm font-bold text-[#0b0f17]" style={{ background: GREEN }}>{r ? 'Guardar cambios' : 'Crear ruta'}</button>
    </div>
  }
  const iwInfo = (d: string) => { const w = isoWeek(d); return <p className="text-xs text-slate-500 sm:col-span-2">Semana {w.week} del {w.year}. El número de ruta se asigna solo al crear.</p> }

  async function setStatus(r: Route, st: Route['status'], what: string) {
    if (st === 'cerrada') {
      const open = reqs.filter(q => q.route_id === r.id && q.status === 'asignada')
      if (!confirm(open.length ? `Hay ${open.length} visita(s) sin marcar como hechas: volverán a pendientes. ¿Cerrar la ruta?` : '¿Cerrar la ruta?')) return
      if (open.length) await supabase.from('rt_requests').update({ route_id: null, status: 'pendiente', visit_date: null }).eq('route_id', r.id).eq('status', 'asignada')
    }
    const { error } = await supabase.from('rt_routes').update({ status: st }).eq('id', r.id)
    if (error) return alert(error.message)
    await log(r.id, what); load()
  }
  async function delRoute(r: Route) {
    if (!confirm(`¿Eliminar la ruta ${r.number}? Las visitas asignadas vuelven a pendientes.`)) return
    await supabase.from('rt_requests').update({ route_id: null, status: 'pendiente', visit_date: null }).eq('route_id', r.id).in('status', ['asignada'])
    const { error } = await supabase.from('rt_routes').delete().eq('id', r.id)
    if (error) return alert(error.message)
    setScr('main'); setRid(null); load()
  }
  async function attach(r: Route, q: Req, date: string) {
    const { error } = await supabase.from('rt_requests').update({ route_id: r.id, status: 'asignada', visit_date: date || r.depart_date }).eq('id', q.id)
    if (error) return alert(error.message)
    await log(r.id, `Agregó la visita: ${q.client}`); load()
  }
  async function detach(r: Route, q: Req) {
    if (!confirm(`¿Quitar "${q.client}" de la ruta? Vuelve a pendientes.`)) return
    const { error } = await supabase.from('rt_requests').update({ route_id: null, status: 'pendiente', visit_date: null }).eq('id', q.id)
    if (error) return alert(error.message)
    await log(r.id, `Quitó la visita: ${q.client}`); load()
  }
  async function toggleDone(r: Route, q: Req) {
    const { error } = await supabase.from('rt_requests').update({ status: q.status === 'hecha' ? 'asignada' : 'hecha' }).eq('id', q.id)
    if (error) return alert(error.message)
    await log(r.id, `${q.status === 'hecha' ? 'Desmarcó' : 'Marcó como hecha'} la visita: ${q.client}`); load()
  }

  const clients: string[] = Array.from(new Set<string>(reqs.map(q => q.client))).sort()
  const modals = <>{tm && <TechForm t={tm === 'new' ? null : tm} onClose={() => setTm(null)} onDone={load} />}{rq && <ReqForm q={rq.q} route={rq.route} clients={clients} who={who} onClose={() => setRq(null)} onDone={w => { if (rq.route && w) log(rq.route.id, w); load() }} />}</>

  if (scr === 'rform') return <>{RouteForm({ r: route && rid ? route : null })}</>
  if (scr === 'sheet' && route) return <RouteSheet r={route} techs={techs} veh={vOf(route.vehicle_id)} visits={reqs.filter(q => q.route_id === route.id && q.status !== 'cancelada')} onBack={() => setScr('detail')} />
  if (scr === 'detail' && route) {
    const visits = reqs.filter(q => q.route_id === route.id).sort((a, b) => (a.visit_date ?? '').localeCompare(b.visit_date ?? ''))
    const pend = reqs.filter(q => q.status === 'pendiente')
    const st = { borrador: ['Borrador', '#94a3b8'], confirmada: ['Confirmada', GREEN], cerrada: ['Cerrada', '#64748b'] }[route.status]
    return <div className="no-print mx-auto max-w-3xl">
      <button onClick={() => { setScr('main'); setRid(null) }} className="mb-4 flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft className="size-4" />Volver</button>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Semana {route.week} · {route.year}</p><h2 className="mt-1 text-2xl font-semibold text-white">Ruta {route.number}</h2></div><Chip c={st[1]} t={st[0]} /></div>
      <div className="frost-card mt-4 grid gap-x-6 gap-y-2 p-5 text-sm sm:grid-cols-2">{[['Técnico', tName(route.tech_id)], ['Apoyo', route.support.map(tName).join(', ') || '—'], ['Camioneta', vOf(route.vehicle_id) ? `${vOf(route.vehicle_id)!.plate} · ${vOf(route.vehicle_id)!.name}` : '—'], ['Salida', `${fmtD(route.depart_date)} ${route.depart_time?.slice(0, 5) ?? ''}`], ['Retorno', fmtD(route.return_date)], ['Efectivo', `${route.cash.toLocaleString('es-BO')} Bs · ${route.work_days ?? '—'} días`]].map(([a, b]) => <p key={a}><span className="text-slate-500">{a}: </span><span className="text-white">{b}</span></p>)}</div>
      {route.status !== 'cerrada' && <div className="mt-3"><Warn list={warn(route, route.id)} /></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        {route.status === 'borrador' && <button onClick={() => setStatus(route, 'confirmada', 'Confirmó la ruta')} className="h-10 rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Confirmar ruta</button>}
        {route.status === 'confirmada' && <><button onClick={() => setStatus(route, 'cerrada', 'Cerró la ruta')} className="h-10 rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Cerrar ruta (volvió)</button><button onClick={() => setStatus(route, 'borrador', 'Volvió la ruta a borrador')} className={btn}>Volver a borrador</button></>}
        {route.status === 'cerrada' && isAdmin && <button onClick={() => setStatus(route, 'confirmada', 'Reabrió la ruta')} className={btn}>Reabrir</button>}
        {route.status !== 'cerrada' && <button onClick={() => setScr('rform')} className={btn}><Pencil className="mr-1 inline size-3.5" />Editar</button>}
        <button onClick={() => setScr('sheet')} className={btn}><Printer className="mr-1 inline size-3.5" />Ver hoja / imprimir</button>
        {isAdmin && <button onClick={() => delRoute(route)} className="h-9 rounded-lg border border-red-500/30 px-3 text-xs text-red-300"><Trash2 className="mr-1 inline size-3.5" />Eliminar</button>}
      </div>
      <div className="mt-8 flex items-center justify-between"><h3 className="text-lg font-semibold text-white">Visitas ({visits.length})</h3>{route.status !== 'cerrada' && <button onClick={() => setRq({ q: null, route })} className="flex items-center gap-1.5 text-xs text-[#c6ff00]"><Plus className="size-4" />Nueva visita</button>}</div>
      <div className="mt-3 flex flex-col gap-2">{visits.map(q => <div key={q.id} className="frost-card flex gap-3 overflow-hidden"><div className="w-2.5 shrink-0" style={{ background: PRI[q.priority] }} /><div className="min-w-0 flex-1 py-3 pr-3"><p className="text-sm text-white">{q.client} <span className="text-slate-500">· {[q.brand, q.machine, q.model].filter(Boolean).join(' ')}</span></p><p className="mt-1 whitespace-pre-wrap text-xs text-slate-300">{q.job}</p><p className="mt-1 text-[11px] text-slate-500">Visita {fmtD(q.visit_date)} · {q.zone}{q.meeting_point && ` · ${q.meeting_point}`}{q.contact && ` · ${q.contact}`}</p><div className="mt-2 flex flex-wrap items-center gap-2">{q.warranty && <Chip c={AMBER} t="Garantía" />}{q.credit && <Chip c={VIOLET} t="Crédito" />}{q.status === 'hecha' && <Chip c={GREEN} t="Hecha" />}{q.amount != null && <Chip c="#00d2ff" t={`${q.amount.toLocaleString('es-BO')} Bs`} />}</div></div>
        {route.status !== 'cerrada' && <div className="flex shrink-0 flex-col gap-1.5 p-3"><button onClick={() => toggleDone(route, q)} className={btn}>{q.status === 'hecha' ? 'Deshacer' : 'Hecha'}</button><button onClick={() => setRq({ q, route })} className={btn}>Editar</button><button onClick={() => detach(route, q)} className={btn}>Quitar</button></div>}</div>)}
        {!visits.length && <p className="frost-card p-6 text-center text-sm text-slate-500">Esta ruta todavía no tiene visitas.</p>}</div>
      {route.status !== 'cerrada' && pend.length > 0 && <AttachRow route={route} pend={pend} onAttach={attach} />}
      <h3 className="mt-8 text-sm font-semibold text-white">Historial de cambios</h3>
      <div className="mt-2 divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] text-xs text-slate-300">{hist.map(h => <p key={h.id} className="p-3"><span className="text-slate-500">{new Date(h.at).toLocaleString('es-BO')} · {h.who}</span><br />{h.what}</p>)}{!hist.length && <p className="p-3 text-slate-600">Sin cambios registrados.</p>}</div>
      {modals}
    </div>
  }

  const days = Array.from({ length: 7 }, (_, i) => { const b = new Date(today() + 'T00:00:00'); b.setDate(b.getDate() - ((b.getDay() + 6) % 7) + off * 7 + i); return ymd(b) })
  const actTechs = techs.filter(t => t.active)
  const list = routes.filter(r => (rfilter === 'todas' ? true : rfilter === 'abiertas' ? r.status !== 'cerrada' : r.status === 'cerrada'))
  const ql = reqs.filter(q => (qfilter === 'todas' ? true : q.status === 'pendiente')).sort((a, b) => a.priority - b.priority || (a.call_date ?? '').localeCompare(b.call_date ?? ''))
  const tabBtn = (k: typeof tab, l: string) => <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap border-b-2 px-4 pb-3 text-sm font-semibold ${tab === k ? 'border-[#c6ff00] text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{l}</button>
  return <div className="no-print">
    <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c6ff00]">Servicio técnico</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Rutas de servicio</h2></div>
      <button onClick={() => { setRid(null); setScr('rform') }} className="flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Plus className="size-4" />Nueva ruta</button></div>
    {err && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">No se pudo cargar: {err}. ¿Ya ejecutaste rutas.sql en Supabase?</p>}
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-white/[0.08]">{tabBtn('semana', 'Semana')}{tabBtn('rutas', 'Rutas')}{tabBtn('solicitudes', `Solicitudes (${reqs.filter(q => q.status === 'pendiente').length})`)}{tabBtn('tecnicos', 'Técnicos')}</div>

    {tab === 'semana' && <div>
      <div className="mb-3 flex items-center justify-between gap-2"><button onClick={() => setOff(off - 1)} className={btn}>← Anterior</button><p className="text-sm font-semibold text-white">Semana {isoWeek(days[0]).week} · {fmtD(days[0])} al {fmtD(days[6])}</p><button onClick={() => setOff(off + 1)} className={btn}>Siguiente →</button></div>
      {off !== 0 && <button onClick={() => setOff(0)} className="mb-3 text-xs text-[#c6ff00] underline">Ir a esta semana</button>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{days.map((d, i) => { const rs = routes.filter(r => r.depart_date <= d && d <= end(r)); const vs = reqs.filter(q => q.visit_date === d && q.status !== 'cancelada' && q.route_id)
        return <div key={d} className={`frost-card p-4 ${d === today() ? 'border-[#c6ff00]/50' : ''}`}><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{DN[i]} {fmtD(d).slice(0, 5)} {d === today() && <span className="text-[#c6ff00]">· hoy</span>}</p>
          {rs.map(r => <button key={r.id} onClick={() => open(r.id)} className="mb-1.5 block w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.06]"><b className="text-white">Ruta {r.number}</b> · {tName(r.tech_id)} · <span className="font-mono">{vOf(r.vehicle_id)?.plate ?? '—'}</span>{r.status === 'borrador' && <span className="ml-1 text-slate-500">(borrador)</span>}</button>)}
          {vs.map(q => <p key={q.id} className="py-0.5 text-[11px] text-slate-400"><span className="mr-1 inline-block size-2 rounded-full" style={{ background: PRI[q.priority] }} />{q.client} · {q.zone}</p>)}
          {!rs.length && !vs.length && <p className="text-xs text-slate-600">Sin salidas</p>}</div> })}</div>
      <h3 className="mt-8 text-sm font-semibold text-white">Técnicos hoy</h3><div className="mt-2 flex flex-wrap gap-2">{actTechs.map(t => { const s = techState(t); return <span key={t.id} className="rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: s.c + '66', color: s.c }}>{t.name} · {s.l}</span> })}</div>
      <h3 className="mt-6 text-sm font-semibold text-white">Camionetas fuera de servicio hoy</h3><div className="mt-2 flex flex-wrap gap-2">{vehs.map(v => ({ v, s: vehState(v) })).filter(x => x.s.l !== 'Disponible').map(({ v, s }) => <span key={v.id} className="rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: s.c + '66', color: s.c }}>{v.plate} · {s.l}</span>)}{!vehs.some(v => vehState(v).l !== 'Disponible') && <span className="text-xs text-slate-500">Todas disponibles.</span>}</div>
    </div>}

    {tab === 'rutas' && <div><div className="mb-3 flex gap-2">{(['abiertas', 'cerradas', 'todas'] as const).map(k => <button key={k} onClick={() => setRfilter(k)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${rfilter === k ? 'border-[#c6ff00] bg-[#c6ff00]/10 text-[#c6ff00]' : 'border-white/10 text-slate-400'}`}>{k}</button>)}</div>
      <div className="flex flex-col gap-2">{list.map(r => <button key={r.id} onClick={() => open(r.id)} className="frost-card flex flex-wrap items-center gap-3 p-4 text-left hover:border-white/20"><div className="min-w-0 flex-1"><p className="text-sm text-white"><b>Ruta {r.number}</b> · {tName(r.tech_id)}{r.support.length > 0 && <span className="text-slate-500"> + {r.support.length} apoyo</span>}</p><p className="mt-1 text-[11px] text-slate-500">{vOf(r.vehicle_id)?.plate ?? '—'} · {fmtD(r.depart_date)} al {fmtD(r.return_date)} · Semana {r.week} · {reqs.filter(q => q.route_id === r.id).length} visitas</p></div><Chip c={r.status === 'confirmada' ? GREEN : r.status === 'borrador' ? '#94a3b8' : '#64748b'} t={r.status} /></button>)}
        {!list.length && <p className="frost-card p-8 text-center text-sm text-slate-500">No hay rutas aquí.</p>}</div></div>}

    {tab === 'solicitudes' && <div><div className="mb-3 flex items-center justify-between gap-2"><div className="flex gap-2">{(['pendiente', 'todas'] as const).map(k => <button key={k} onClick={() => setQfilter(k)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${qfilter === k ? 'border-[#c6ff00] bg-[#c6ff00]/10 text-[#c6ff00]' : 'border-white/10 text-slate-400'}`}>{k === 'pendiente' ? 'Pendientes' : 'Todas'}</button>)}</div><button onClick={() => setRq({ q: null, route: null })} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Plus className="size-4" />Nueva solicitud</button></div>
      <div className="flex flex-col gap-2">{ql.map(q => { const days = q.call_date ? Math.max(0, Math.round((Date.parse(today()) - Date.parse(q.call_date)) / 864e5)) : null; const r = routes.find(x => x.id === q.route_id)
        return <div key={q.id} className="frost-card flex gap-3 overflow-hidden"><div className="w-2.5 shrink-0" style={{ background: PRI[q.priority] }} /><div className="min-w-0 flex-1 py-3"><p className="text-sm text-white">{q.client} <span className="text-slate-500">· {[q.brand, q.machine, q.model].filter(Boolean).join(' ')}</span></p><p className="mt-1 whitespace-pre-wrap text-xs text-slate-300">{q.job}</p><p className="mt-1 text-[11px] text-slate-500">{q.zone}{days != null && ` · llamó hace ${days} día${days === 1 ? '' : 's'}`}{r && ` · ruta ${r.number}`} · {q.status}</p><div className="mt-2 flex gap-2">{q.warranty && <Chip c={AMBER} t="Garantía" />}{q.credit && <Chip c={VIOLET} t="Crédito" />}</div></div>
          <div className="flex shrink-0 flex-col gap-1.5 p-3"><button onClick={() => setRq({ q, route: null })} className={btn}>Editar</button>{q.status === 'pendiente' && <button onClick={async () => { const { error } = await supabase.from('rt_requests').update({ status: 'cancelada' }).eq('id', q.id); error ? alert(error.message) : load() }} className={btn}>Cancelar</button>}{q.status === 'cancelada' && <button onClick={async () => { const { error } = await supabase.from('rt_requests').update({ status: 'pendiente' }).eq('id', q.id); error ? alert(error.message) : load() }} className={btn}>Reactivar</button>}</div></div> })}
        {!ql.length && <p className="frost-card p-8 text-center text-sm text-slate-500">No hay solicitudes.</p>}</div></div>}

    {tab === 'tecnicos' && <div><div className="mb-3 flex justify-end"><button onClick={() => setTm('new')} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Plus className="size-4" />Agregar técnico</button></div>
      <div className="flex flex-col gap-2">{techs.map(t => { const s = techState(t); return <div key={t.id} className="frost-card flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="text-sm text-white">{t.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{t.area || 'Sin área'}{t.phone && ` · ${t.phone}`}{t.off_from && ` · ausente ${fmtD(t.off_from)} al ${fmtD(t.off_to)}`}</p></div><Chip c={s.c} t={s.l} /><button onClick={() => setTm(t)} className={btn}>Editar</button></div> })}</div></div>}
    {modals}
  </div>
}

function AttachRow({ route, pend, onAttach }: { route: Route; pend: Req[]; onAttach: (r: Route, q: Req, date: string) => void }) {
  const [id, setId] = useState('')
  const [date, setDate] = useState(route.depart_date)
  const q = pend.find(x => x.id === id)
  return <div className="frost-card mt-3 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"><Lab t="Agregar una solicitud pendiente"><select className={inp} value={id} onChange={e => setId(e.target.value)}><option value="" className="bg-[#111a2a]">Elegir…</option>{pend.map(x => <option key={x.id} value={x.id} className="bg-[#111a2a]">{['', 'ALTA', 'NORMAL', 'BAJA'][x.priority]} · {x.client} · {x.job.slice(0, 40)}</option>)}</select></Lab><Lab t="Fecha de visita"><input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} /></Lab><button disabled={!q} onClick={() => { if (q) { onAttach(route, q, date); setId('') } }} className="h-11 rounded-xl px-4 text-xs font-bold text-[#0b0f17] disabled:opacity-40" style={{ background: GREEN }}>Agregar</button></div>
}
