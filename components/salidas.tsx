'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const RED = '#ef4444', AMBER = '#ff8a00'
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => ymd(new Date())
const fmtD = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '—')

export default function Salidas() {
  type R = { id: string; number: number; tech_id: string | null; support: string[] | null; vehicle_id: string | null; depart_date: string; depart_time: string | null; return_date: string | null; status: string }
  type Vi = { route_id: string; client: string; zone: string; job: string; priority: number }
  const [d, setD] = useState<{ routes: R[]; techs: Record<string, string>; plates: Record<string, string>; visits: Vi[] } | null>(null)
  useEffect(() => {
    (async () => {
      const { data: has } = await supabase.rpc('has_module', { m: 'rutas' })
      if (!has) return
      const [r, k, v, q] = await Promise.all([supabase.from('rt_routes').select('id,number,tech_id,support,vehicle_id,depart_date,depart_time,return_date,status').neq('status', 'cerrada').order('depart_date'), supabase.from('rt_technicians').select('id,name'), supabase.from('insp_vehicles').select('id,plate'), supabase.from('rt_requests').select('route_id,client,zone,job,priority').not('route_id', 'is', null).neq('status', 'cancelada')])
      if (r.error || k.error || v.error || q.error) return
      setD({ routes: (r.data ?? []) as R[], techs: Object.fromEntries((k.data ?? []).map(t => [t.id, t.name])), plates: Object.fromEntries((v.data ?? []).map(x => [x.id, x.plate])), visits: (q.data ?? []) as Vi[] })
    })()
  }, [])
  if (!d) return null
  const t0 = today(), lim = new Date(); lim.setDate(lim.getDate() + 7)
  const list = d.routes.filter(r => r.depart_date <= ymd(lim) && (r.return_date || r.depart_date) >= t0)
  return <div className="frost-card mb-8 p-5">
    <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold text-white">Salidas de técnicos</h3><p className="text-[11px] text-slate-500">Hoy y los próximos 7 días</p></div><a href="/rutas" className="text-xs text-[#c6ff00] hover:underline">Ver todas →</a></div>
    {list.map(r => { const vis = d.visits.filter(x => x.route_id === r.id); const en = r.status === 'confirmada' && r.depart_date <= t0; const st = r.status === 'borrador' ? ['Borrador', '#94a3b8'] : en ? ['En ruta', RED] : ['Asignada', AMBER]
      return <a key={r.id} href={`/rutas?ruta=${r.id}`} className="mb-2 block rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-white"><b>Ruta {r.number}</b> · {d.techs[r.tech_id ?? ''] ?? '—'}{(r.support ?? []).length > 0 && <span className="text-slate-400"> + {(r.support ?? []).map(i => d.techs[i]).filter(Boolean).join(', ')}</span>}</p><span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: st[1] + '22', color: st[1] }}>{st[0]}</span></div>
        <p className="mt-1 text-[11px] text-slate-500"><span className="font-mono text-slate-300">{d.plates[r.vehicle_id ?? ''] ?? '—'}</span> · {fmtD(r.depart_date)} {r.depart_time?.slice(0, 5) ?? ''} → {fmtD(r.return_date)}</p>
        {vis.slice(0, 4).map((x, i) => <p key={i} className="mt-1 truncate text-xs text-slate-300"><span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: ['', '#ff0000', '#ffd400', '#34a853'][x.priority] }} />{x.client}{x.zone && ` (${x.zone})`} — {x.job.split('\n')[0]}</p>)}
        {vis.length > 4 && <p className="mt-1 text-[11px] text-slate-500">+ {vis.length - 4} visitas más</p>}
        {!vis.length && <p className="mt-1 text-[11px] text-slate-600">Sin visitas cargadas</p>}</a> })}
    {!list.length && <p className="py-4 text-center text-sm text-slate-500">No hay salidas en los próximos 7 días.</p>}</div>
}
