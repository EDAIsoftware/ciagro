'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/app-shell'
import Salidas from '@/components/salidas'
import { balance, fetchDB, fmtBs, fmtL, vehicleStats } from '@/lib/store'

type Al = { c: string; t: string; href: string }
type Data = {
  alerts: Al[]
  rutas?: { hoy: number; libres: number; activos: number; pend: number }
  insp?: { hechas: number; total: number; taller: number; mant: number; r: number; a: number; v: number }
  comb?: { mes: string; comprado: number; extraido: number; costo: number; faltantes: number }
  prep?: { area: string; por: number; proc: number; fin: number; prob: number }[]
}
const RED = '#ef4444', AMBER = '#ff8a00', YELLOW = '#ffd400', GREEN = '#c6ff00', CYAN = '#00d2ff'
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtD = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '—')

async function compute(mods: string[]): Promise<Data> {
  const t = ymd(new Date()), month = t.slice(0, 7), half = +t.slice(8, 10) <= 15
  const d: Data = { alerts: [] }
  if (mods.includes('rutas')) {
    const [r, q, k] = await Promise.all([supabase.from('rt_routes').select('id,number,tech_id,support,depart_date,return_date,status').neq('status', 'cerrada'), supabase.from('rt_requests').select('priority').eq('status', 'pendiente'), supabase.from('rt_technicians').select('id,active,off_from,off_to')])
    if (!r.error && !q.error && !k.error) {
      const rs = r.data ?? [], end = (x: { depart_date: string; return_date: string | null }) => x.return_date || x.depart_date
      const now = rs.filter(x => x.status === 'confirmada' && x.depart_date <= t && t <= end(x))
      const busy = new Set(now.flatMap(x => [x.tech_id, ...(x.support ?? [])]))
      const act = (k.data ?? []).filter(x => x.active)
      d.rutas = { hoy: rs.filter(x => x.depart_date <= t && t <= end(x)).length, activos: act.length, libres: act.filter(x => !busy.has(x.id) && !(x.off_from && x.off_to && x.off_from <= t && t <= x.off_to)).length, pend: (q.data ?? []).length }
      rs.filter(x => x.status === 'confirmada' && x.return_date && x.return_date < t).forEach(x => d.alerts.push({ c: RED, t: `Ruta ${x.number}: el retorno estimado (${fmtD(x.return_date)}) ya pasó y sigue abierta`, href: `/rutas?ruta=${x.id}` }))
      const altas = (q.data ?? []).filter(x => x.priority === 1).length
      if (altas) d.alerts.push({ c: YELLOW, t: `${altas} solicitud${altas === 1 ? '' : 'es'} de servicio de prioridad alta sin ruta`, href: '/rutas' })
    }
  }
  if (mods.includes('inspecciones')) {
    const qs = `${month}-${half ? '01' : '16'}`, per = `${month}-${half ? 'Q1' : 'Q2'}`
    const d30 = ymd(new Date(Date.now() - 30 * 864e5))
    const [v, i, rq, w, o, m] = await Promise.all([supabase.from('insp_vehicles').select('id,odometer,km_next,insp_freq'), supabase.from('inspections').select('vehicle_id').eq('kind', 'inspeccion').gte('date', qs), supabase.from('insp_requests').select('vehicle_id').eq('period', per), supabase.from('insp_workshop').select('vehicle_id').is('exit_date', null), supabase.from('insp_observations').select('priority').eq('done', false), supabase.from('inspections').select('vehicle_id').eq('kind', 'inspeccion').gte('date', d30)])
    if (!v.error && !i.error && !rq.error && !w.error && !o.error && !m.error) {
      const vs = v.data ?? [], done = new Set((i.data ?? []).map(x => x.vehicle_id)), asked = new Set((rq.data ?? []).map(x => x.vehicle_id))
      const fr = (x: { insp_freq?: string }) => x.insp_freq ?? 'quincenal'
      const quin = vs.filter(x => fr(x) === 'quincenal'), done30 = new Set((m.data ?? []).map(x => x.vehicle_id))
      const mensPend = vs.filter(x => fr(x) === 'mensual' && !done30.has(x.id)).length
      const faltan = quin.filter(x => !done.has(x.id) && !asked.has(x.id)).length
      const mant = vs.filter(x => x.km_next != null && +x.km_next - +x.odometer <= 1000).length
      const ob = o.data ?? [], cnt = (p: string) => ob.filter(x => x.priority === p).length
      d.insp = { hechas: quin.filter(x => done.has(x.id)).length, total: quin.length, taller: (w.data ?? []).length, mant, r: cnt('A'), a: cnt('M'), v: cnt('B') }
      if (cnt('A')) d.alerts.push({ c: RED, t: `${cnt('A')} pendiente${cnt('A') === 1 ? '' : 's'} en rojo en camionetas`, href: '/inspecciones' })
      if ((w.data ?? []).length) d.alerts.push({ c: AMBER, t: `${(w.data ?? []).length} camioneta${(w.data ?? []).length === 1 ? '' : 's'} en taller`, href: '/inspecciones' })
      if (mant) d.alerts.push({ c: AMBER, t: `${mant} camioneta${mant === 1 ? '' : 's'} con el mantenimiento a menos de 1.000 km`, href: '/inspecciones' })
      if (mensPend) d.alerts.push({ c: AMBER, t: `${mensPend} camioneta${mensPend === 1 ? '' : 's'} con la inspección mensual pendiente`, href: '/inspecciones' })
      if (faltan) d.alerts.push({ c: AMBER, t: `${faltan} camioneta${faltan === 1 ? '' : 's'} sin pedir en la ronda de revisión`, href: '/inspecciones' })
    }
  }
  if (mods.includes('combustible')) {
    try {
      const db = await fetchDB()
      const st = db.vehicles.map(v => ({ v, s: vehicleStats(db, v.id, month), b: balance(db, v.id, month, t) }))
      const bad = st.filter(x => x.b.warn)
      d.comb = { mes: month, comprado: st.reduce((a, x) => a + x.s.purchased, 0), extraido: st.reduce((a, x) => a + x.s.transferred, 0), costo: st.reduce((a, x) => a + x.s.cost, 0), faltantes: bad.length }
      bad.slice(0, 3).forEach(x => d.alerts.push({ c: AMBER, t: `${x.v.plate}: posible faltante de combustible este mes`, href: '/' }))
    } catch { /* sin acceso */ }
  }
  const areas = (['tractores', 'implementos'] as const).filter(a => mods.includes(a))
  if (areas.length) {
    const [u, is] = await Promise.all([supabase.from('pr_units').select('id,area,status,promised_date'), supabase.from('pr_issues').select('unit_id').eq('resolved', false)])
    if (!u.error && !is.error) {
      const withIssue = new Set((is.data ?? []).map(x => x.unit_id))
      d.prep = areas.map(a => { const us = (u.data ?? []).filter(x => x.area === a); return { area: a === 'tractores' ? 'Tractores' : 'Implementos', por: us.filter(x => x.status === 'por_hacer').length, proc: us.filter(x => x.status === 'en_proceso').length, fin: us.filter(x => x.status === 'finalizado').length, prob: us.filter(x => x.status !== 'finalizado' && withIssue.has(x.id)).length } })
      const prob = d.prep.reduce((x, y) => x + y.prob, 0)
      if (prob) d.alerts.push({ c: AMBER, t: `${prob} unidad${prob === 1 ? '' : 'es'} en preparación con problema abierto`, href: '/preparacion' })
      const late = (u.data ?? []).filter(x => x.status !== 'finalizado' && x.promised_date && x.promised_date < t).length
      if (late) d.alerts.push({ c: RED, t: `${late} unidad${late === 1 ? '' : 'es'} con la entrega prometida vencida`, href: '/preparacion' })
    }
  }
  d.alerts.sort((a, b) => Number(b.c === RED) - Number(a.c === RED))
  return d
}

const Row = ({ l, v, c }: { l: string; v: string | number; c: string }) => <div className="flex items-baseline justify-between py-1"><span className="text-[11px] text-slate-400">{l}</span><span className="text-lg font-medium" style={{ color: c }}>{v}</span></div>
const Card = ({ title, href, open, children }: { title: string; href: string; open: string; children: React.ReactNode }) => <div className="frost-card p-4"><h3 className="mb-1 text-sm font-medium text-white">{title}</h3>{children}<a href={href} className="mt-3 inline-block text-xs text-[#c6ff00] hover:underline">{open} →</a></div>

export default function ResumenPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [who, setWho] = useState('')
  const [role, setRole] = useState('operador')
  const [mods, setMods] = useState<string[] | null>(null)
  const [d, setD] = useState<Data | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return
    supabase.from('profiles').select('full_name, role').eq('id', session.user.id).single().then(({ data }) => { setWho(data?.full_name ?? ''); setRole(data?.role ?? 'operador') })
    supabase.rpc('my_modules').then(({ data }) => setMods((data ?? []) as string[]))
  }, [session])
  useEffect(() => { if (mods) compute(mods).then(setD) }, [mods])

  const wrap = (c: React.ReactNode) => <main className="grid min-h-screen place-items-center bg-[#0b0f17] p-6 text-center text-sm text-slate-400"><div>{c}</div></main>
  if (session === undefined || (session && (mods === null || !d))) return wrap('Cargando…')
  if (session === null) return wrap(<>Inicia sesión para continuar.<br /><a href="/" className="mt-3 inline-block text-[#c6ff00] underline">Ir al inicio de sesión</a></>)
  if (!mods!.length) return wrap(<>Todavía no tienes módulos asignados.<br />Pide al administrador que te los asigne.</>)
  const x = d!
  const hoy = new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return <AppShell active="resumen" email={session.user.email ?? ''} userId={session.user.id} mods={mods!} isAdmin={role === 'admin'} who={who} onWho={setWho}>
    <div>
      <h1 className="text-2xl font-semibold text-white sm:text-3xl">Panel general</h1><p className="mt-1 text-sm capitalize text-slate-500">{hoy}</p>
      <div className="frost-card mt-5 p-4"><h2 className="mb-2 text-sm font-medium text-white">Atención hoy</h2>
        {x.alerts.map((a, i) => <a key={i} href={a.href} className="flex items-center gap-3 border-t border-white/[0.07] py-2 text-sm text-slate-200 hover:text-white"><span className="size-2 shrink-0 rounded-full" style={{ background: a.c }} />{a.t}</a>)}
        {!x.alerts.length && <p className="border-t border-white/[0.07] pt-3 text-sm text-slate-500">Nada urgente por ahora.</p>}</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {x.rutas && <Card title="Rutas de servicio" href="/rutas" open="Abrir rutas"><Row l="Salidas hoy" v={x.rutas.hoy} c={AMBER} /><Row l="Técnicos libres" v={`${x.rutas.libres} de ${x.rutas.activos}`} c={GREEN} /><Row l="Solicitudes pendientes" v={x.rutas.pend} c={CYAN} /></Card>}
        {x.insp && <Card title="Inspecciones y taller" href="/inspecciones" open="Abrir inspecciones"><Row l="Ronda: hechas" v={`${x.insp.hechas} de ${x.insp.total}`} c={GREEN} /><Row l="En taller ahora" v={x.insp.taller} c={AMBER} /><Row l="Mantenimiento cerca" v={x.insp.mant} c={RED} /><p className="mt-1 text-[11px] text-slate-400"><span className="mr-1 inline-block size-2 rounded-full bg-[#ff0000]" />{x.insp.r}<span className="ml-3 mr-1 inline-block size-2 rounded-full bg-[#ffd400]" />{x.insp.a}<span className="ml-3 mr-1 inline-block size-2 rounded-full bg-[#34a853]" />{x.insp.v} pendientes</p></Card>}
        {x.comb && <Card title={`Combustible · ${x.comb.mes}`} href="/" open="Abrir combustible"><Row l="Comprado" v={fmtL(x.comb.comprado)} c={GREEN} /><Row l="A maquinaria" v={fmtL(x.comb.extraido)} c={AMBER} /><Row l="Posibles faltantes" v={x.comb.faltantes} c={RED} /><p className="mt-1 text-[11px] text-slate-400">{fmtBs(x.comb.costo)} en facturas del mes</p></Card>}
        {x.prep?.map(p => <Card key={p.area} title={`Preparación de ${p.area.toLowerCase()}`} href="/preparacion" open="Abrir preparación"><Row l="Por hacer" v={p.por} c="#94a3b8" /><Row l="En proceso" v={p.proc} c={GREEN} /><Row l="Finalizados" v={p.fin} c={CYAN} /><Row l="Con problema" v={p.prob} c={RED} /></Card>)}
      </div>
      {mods!.includes('rutas') && <div className="mt-4"><Salidas /></div>}
    </div></AppShell>
}
