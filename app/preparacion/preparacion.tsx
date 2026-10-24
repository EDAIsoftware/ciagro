'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Area = 'tractores' | 'implementos'
type St = 'por_hacer' | 'en_proceso' | 'finalizado'
type Unit = { id: string; area: Area; brand: string; model: string; serial: string; client: string; arrival_date: string; promised_date: string | null; status: St; started_at: string | null; finished_at: string | null; owner_name: string; notes: string }
type Issue = { id: string; unit_id: string; text: string; resolved: boolean; by_name: string; created_at: string }

const GREEN = '#c6ff00', AMBER = '#ff8a00', RED = '#ef4444', CYAN = '#00d2ff'
const ST: Record<St, { l: string; c: string }> = { por_hacer: { l: 'Por hacer', c: '#94a3b8' }, en_proceso: { l: 'En proceso', c: GREEN }, finalizado: { l: 'Finalizado', c: CYAN } }
const AREA: Record<Area, string> = { tractores: 'Tractores', implementos: 'Implementos' }
const inp = 'h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#00d2ff]'
const btn = 'h-9 rounded-lg border border-white/15 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5'
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const fmtD = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '—')
const dayDiff = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 864e5))
const stPatch = (u: Unit, st: St) => ({ status: st, started_at: st === 'por_hacer' ? null : u.started_at ?? today(), finished_at: st === 'finalizado' ? today() : null })

function Lab({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t}</span>{children}</label>
}

function UnitModal({ u, area, issues, who, isAdmin, onClose, onDone }: { u: Unit | null; area: Area; issues: Issue[]; who: string; isAdmin: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ brand: u?.brand ?? '', model: u?.model ?? '', serial: u?.serial ?? '', client: u?.client ?? '', arrival: u?.arrival_date ?? today(), promised: u?.promised_date ?? '', owner: u?.owner_name ?? who, notes: u?.notes ?? '' })
  const [st, setSt] = useState<St>(u?.status ?? 'por_hacer')
  const [prob, setProb] = useState('')
  const [err, setErr] = useState('')
  const t = (k: 'brand' | 'model' | 'serial' | 'client' | 'owner') => ({ className: inp, value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) })
  async function save() {
    if (!f.model.trim()) return setErr('Escribe el modelo.')
    const body = { brand: f.brand.trim(), model: f.model.trim(), serial: f.serial.trim(), client: f.client.trim(), arrival_date: f.arrival || today(), promised_date: f.promised || null, owner_name: f.owner.trim(), notes: f.notes.trim() }
    const { error } = u ? await supabase.from('pr_units').update({ ...body, ...(st !== u.status ? stPatch(u, st) : {}) }).eq('id', u.id) : await supabase.from('pr_units').insert({ ...body, area, created_by_name: who })
    if (error) return setErr(error.message)
    onDone(); onClose()
  }
  async function addIssue() {
    if (!u || !prob.trim()) return
    const { error } = await supabase.from('pr_issues').insert({ unit_id: u.id, text: prob.trim(), by_name: who })
    if (error) return setErr(error.message)
    setProb(''); onDone()
  }
  async function toggle(i: Issue) {
    const { error } = await supabase.from('pr_issues').update({ resolved: !i.resolved, resolved_at: i.resolved ? null : new Date().toISOString() }).eq('id', i.id)
    error ? setErr(error.message) : onDone()
  }
  async function del() {
    if (!u || !confirm(`¿Eliminar ${u.model}? Se borra también su historial de problemas.`)) return
    const { error } = await supabase.from('pr_units').delete().eq('id', u.id)
    error ? setErr(error.message) : (onDone(), onClose())
  }
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#05070c]/80 backdrop-blur-sm sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#111a2a] sm:rounded-2xl">
    <div className="flex items-center justify-between border-b border-white/[0.07] p-5"><div><h2 className="text-lg font-semibold text-white">{u ? u.model : `Nuevo ${area === 'tractores' ? 'tractor' : 'implemento'}`}</h2>{u && <p className="mt-1 text-xs text-slate-500">{AREA[u.area]}</p>}</div><button onClick={onClose} aria-label="Cerrar" className="text-slate-500 hover:text-white"><X className="size-5" /></button></div>
    <div className="grid gap-4 p-5 sm:grid-cols-2">
      {u && <div className="sm:col-span-2"><Lab t="Estado"><div className="grid grid-cols-3 gap-2">{(Object.keys(ST) as St[]).map(k => <button key={k} onClick={() => setSt(k)} className="h-11 rounded-xl border text-xs font-bold" style={st === k ? { background: ST[k].c, color: '#0b0f17', borderColor: ST[k].c } : { borderColor: 'rgba(255,255,255,.12)', color: '#94a3b8' }}>{ST[k].l}</button>)}</div></Lab></div>}
      <Lab t="Marca"><input {...t('brand')} list="marcas-pr" placeholder="New Holland" /></Lab><datalist id="marcas-pr">{['New Holland', 'Case', 'John Deere', 'Develon', 'Jacto', 'Baldan'].map(m => <option key={m} value={m} />)}</datalist>
      <Lab t="Modelo"><input {...t('model')} /></Lab><Lab t="Número de serie"><input {...t('serial')} /></Lab><Lab t="Cliente (si ya está vendido)"><input {...t('client')} /></Lab>
      <Lab t="Fecha de llegada"><input type="date" className={inp} value={f.arrival} onChange={e => setF({ ...f, arrival: e.target.value })} /></Lab><Lab t="Entrega prometida"><input type="date" className={inp} value={f.promised} onChange={e => setF({ ...f, promised: e.target.value })} /></Lab>
      <div className="sm:col-span-2"><Lab t="Responsable del montaje"><input {...t('owner')} /></Lab></div>
      <div className="sm:col-span-2"><Lab t="Notas"><textarea className={inp + ' h-20 py-3'} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Lab></div>
      {u && <div className="sm:col-span-2"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Problemas</p>
        {issues.map(i => <button key={i.id} onClick={() => toggle(i)} className="mb-1.5 flex w-full items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-left"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px]" style={i.resolved ? { background: GREEN, color: '#0b0f17', borderColor: GREEN } : { borderColor: RED, color: RED }}>{i.resolved ? '✓' : '!'}</span><span className="min-w-0 flex-1"><span className={`block text-sm ${i.resolved ? 'text-slate-500 line-through' : 'text-white'}`}>{i.text}</span><span className="text-[11px] text-slate-500">{i.by_name} · {fmtD(i.created_at)} · toca para {i.resolved ? 'reabrir' : 'marcar resuelto'}</span></span></button>)}
        {!issues.length && <p className="mb-2 text-xs text-slate-600">Sin problemas anotados.</p>}
        <div className="flex gap-2"><input className={inp} value={prob} onChange={e => setProb(e.target.value)} placeholder="Anotar un problema" onKeyDown={e => e.key === 'Enter' && addIssue()} /><button onClick={addIssue} className="h-11 shrink-0 rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: AMBER }}>Anotar</button></div></div>}
      {err && <p className="text-xs text-red-300 sm:col-span-2">{err}</p>}
      <div className="flex items-center justify-between gap-2 sm:col-span-2">{u && isAdmin ? <button onClick={del} className="text-xs text-red-300 hover:underline">Eliminar</button> : <span />}<div className="flex gap-2"><button onClick={onClose} className="px-3 text-xs text-slate-400">Cerrar</button><button onClick={save} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}>Guardar</button></div></div>
    </div></div></div>
}

export default function Preparacion({ areas, isAdmin, who }: { areas: Area[]; isAdmin: boolean; who: string }) {
  const [area, setArea] = useState<Area>(areas[0])
  const [units, setUnits] = useState<Unit[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [filter, setFilter] = useState<'todas' | St>('todas')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<Unit | 'new' | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([supabase.from('pr_units').select('*').order('created_at', { ascending: false }), supabase.from('pr_issues').select('*').order('created_at')])
    if (a.error || b.error) return setErr((a.error || b.error)!.message)
    setUnits((a.data ?? []) as Unit[]); setIssues((b.data ?? []) as Issue[]); setErr('')
  }, [])
  useEffect(() => { load() }, [load])

  const mine = units.filter(u => u.area === area)
  const open = (id: string) => issues.filter(i => i.unit_id === id && !i.resolved).length
  const month = today().slice(0, 7)
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const list = mine.filter(u => (filter === 'todas' || u.status === filter) && words.every(w => `${u.brand} ${u.model} ${u.serial} ${u.client} ${u.owner_name}`.toLowerCase().includes(w))).sort((a, b) => ({ en_proceso: 0, por_hacer: 1, finalizado: 2 })[a.status] - ({ en_proceso: 0, por_hacer: 1, finalizado: 2 })[b.status])
  async function setSt(u: Unit, st: St) {
    const { error } = await supabase.from('pr_units').update(stPatch(u, st)).eq('id', u.id)
    error ? alert(error.message) : load()
  }
  const cnt = (s: St) => mine.filter(u => u.status === s).length
  const sel = modal && modal !== 'new' ? modal : null

  return <div>
    <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c6ff00]">Taller</p><h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Preparación de {area === 'tractores' ? 'tractores' : 'implementos'}</h2></div>
      <button onClick={() => setModal('new')} className="flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Plus className="size-4" />Nuevo {area === 'tractores' ? 'tractor' : 'implemento'}</button></div>
    {areas.length > 1 && <div className="mb-5 flex gap-1 border-b border-white/[0.08]">{areas.map(a => <button key={a} onClick={() => { setArea(a); setFilter('todas') }} className={`border-b-2 px-4 pb-3 text-sm font-semibold ${area === a ? 'border-[#c6ff00] text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{AREA[a]}</button>)}</div>}
    {err && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">No se pudo cargar: {err}. ¿Ya ejecutaste preparacion.sql en Supabase?</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Por hacer', cnt('por_hacer'), '#94a3b8'], ['En proceso', cnt('en_proceso'), GREEN], ['Con problema', mine.filter(u => u.status !== 'finalizado' && open(u.id) > 0).length, RED], ['Finalizados este mes', mine.filter(u => u.status === 'finalizado' && (u.finished_at ?? '').startsWith(month)).length, CYAN]].map(([l, n, c]) => <div key={l as string} className="frost-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{l}</p><p className="mt-2 text-2xl font-semibold" style={{ color: c as string }}>{n}</p></div>)}</div>
    <div className="relative mt-5"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-500" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por modelo, serie, cliente o responsable…" className={inp} style={{ paddingLeft: 40 }} /></div>
    <div className="mt-3 flex flex-wrap gap-2">{(['todas', 'por_hacer', 'en_proceso', 'finalizado'] as const).map(k => <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === k ? 'border-[#c6ff00] bg-[#c6ff00]/10 text-[#c6ff00]' : 'border-white/10 text-slate-400 hover:text-white'}`}>{k === 'todas' ? `Todos (${mine.length})` : `${ST[k].l} (${cnt(k)})`}</button>)}</div>
    <div className="mt-4 flex flex-col gap-2">{list.map(u => { const s = ST[u.status]; const n = open(u.id); const late = u.status !== 'finalizado' && u.promised_date && u.promised_date < today()
      const days = u.status === 'finalizado' && u.started_at && u.finished_at ? `Tardó ${dayDiff(u.started_at, u.finished_at)} día(s)` : u.status === 'en_proceso' && u.started_at ? `${dayDiff(u.started_at, today())} día(s) en proceso` : `Llegó hace ${dayDiff(u.arrival_date, today())} día(s)`
      return <div key={u.id} className="frost-card flex flex-wrap items-center gap-3 p-4">
        <button onClick={() => setModal(u)} className="min-w-0 flex-1 text-left"><p className="text-sm text-white"><b>{[u.brand, u.model].filter(Boolean).join(' ')}</b>{u.serial && <span className="text-slate-500"> · Serie {u.serial}</span>}</p><p className="mt-1 text-[11px] text-slate-500">{u.client || 'Sin cliente'}{u.owner_name && ` · ${u.owner_name}`} · {days}</p>
          {(u.promised_date || n > 0) && <p className="mt-1 flex flex-wrap gap-3 text-[11px]">{u.promised_date && <span style={{ color: late ? RED : '#94a3b8' }}>Entrega prometida {fmtD(u.promised_date)}{late && ' · vencida'}</span>}{n > 0 && <span style={{ color: RED }}>{n} problema{n === 1 ? '' : 's'} abierto{n === 1 ? '' : 's'}</span>}</p>}</button>
        <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: s.c + '22', color: s.c }}>{s.l}</span>
        {u.status === 'por_hacer' && <button onClick={() => setSt(u, 'en_proceso')} className={btn}>Iniciar</button>}
        {u.status === 'en_proceso' && <button onClick={() => setSt(u, 'finalizado')} className={btn}>Finalizar</button>}
        {u.status === 'finalizado' && <button onClick={() => setSt(u, 'en_proceso')} className={btn}>Reabrir</button>}</div> })}
      {!list.length && <p className="frost-card p-8 text-center text-sm text-slate-500">No hay unidades aquí.</p>}</div>
    {modal && <UnitModal key={sel?.id ?? 'new'} u={sel} area={area} issues={sel ? issues.filter(i => i.unit_id === sel.id) : []} who={who} isAdmin={isAdmin} onClose={() => setModal(null)} onDone={load} />}
  </div>
}
