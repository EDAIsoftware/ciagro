'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { RouteSheet, type Req, type Route, type Tech, type Veh } from '../rutas'

type Job = { id: string; route: Route; techs: Tech[]; veh?: Veh; visits: Req[] }
const hora = () => new Date().toLocaleTimeString('es-BO')
const mask = (e: string) => e.replace(/^(.{2}).*(@.*)$/, '$1***$2')
const btn = 'h-10 rounded-xl border border-white/15 px-4 text-xs font-semibold text-slate-200 hover:bg-white/5'

export default function EstacionImpresion() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [ok, setOk] = useState<boolean | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [test, setTest] = useState(false)
  const [env, setEnv] = useState('')
  const [d, setD] = useState<{ last: string; pending: number | null; err: string; perr: string; printed: string; ms: number | null }>({ last: '—', pending: null, err: '', perr: '', printed: '—', ms: null })
  const cur = useRef<string | null>(null)
  const failed = useRef<Set<string>>(new Set())
  const upd = (p: Partial<typeof d>) => setD(x => ({ ...x, ...p }))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    const v = /Chrome\/([\d.]+)/.exec(navigator.userAgent)?.[1] ?? 'desconocido'
    setEnv(`Chrome ${v} · ventana ${window.matchMedia('(display-mode: standalone)').matches ? 'de aplicación' : 'de navegador'} · ${window.location.pathname}`)
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (session) supabase.rpc('my_modules').then(({ data }) => setOk(((data ?? []) as string[]).includes('rutas'))) }, [session])

  const check = useCallback(async () => {
    const { data: jobs, error } = await supabase.from('rt_print_jobs').select('id,route_id').is('printed_at', null).order('requested_at').limit(10)
    if (error) return upd({ last: hora(), err: 'Cola: ' + error.message })
    const list = (jobs ?? []).filter(j => !failed.current.has(j.id))
    upd({ last: hora(), pending: list.length, err: '' })
    if (cur.current || !list.length) return
    const j = list[0]; cur.current = j.id
    const [r, t, q] = await Promise.all([supabase.from('rt_routes').select('*').eq('id', j.route_id).single(), supabase.from('rt_technicians').select('*'), supabase.from('rt_requests').select('*').eq('route_id', j.route_id)])
    if (r.error) { cur.current = null; failed.current.add(j.id); return upd({ err: 'Ruta: ' + r.error.message }) }
    const { data: v } = r.data.vehicle_id ? await supabase.from('insp_vehicles').select('id,name,plate,driver,area,odometer,km_next').eq('id', r.data.vehicle_id).single() : { data: null }
    setJob({ id: j.id, route: { ...r.data, cash: +(r.data.cash ?? 0), support: r.data.support ?? [] } as Route, techs: (t.data ?? []) as Tech[], veh: (v ?? undefined) as Veh | undefined, visits: (q.data ?? []).map(x => ({ ...x, amount: x.amount == null ? null : +x.amount })) as Req[] })
  }, [])
  useEffect(() => { if (!ok) return; check(); const t = setInterval(check, 8000); return () => clearInterval(t) }, [ok, check])

  const doPrint = () => { const t0 = performance.now(); window.print(); return Math.round(performance.now() - t0) }
  useEffect(() => {
    if (!job) return
    const t = setTimeout(async () => {
      const ms = doPrint()
      const { error } = await supabase.from('rt_print_jobs').update({ printed_at: new Date().toISOString() }).eq('id', job.id)
      if (error) { failed.current.add(job.id); upd({ perr: 'No se pudo marcar como impresa: ' + error.message }) }
      upd({ printed: `ruta ${job.route.number} a las ${hora()}`, ms }); cur.current = null; setJob(null)
    }, 1500)
    return () => clearTimeout(t)
  }, [job])
  useEffect(() => { if (!test) return; const t = setTimeout(() => { const ms = doPrint(); upd({ printed: `página de prueba a las ${hora()}`, ms }); setTest(false) }, 600); return () => clearTimeout(t) }, [test])

  const how = d.ms == null ? '—' : d.ms < 1500 ? `imprimió directo (${d.ms} ms)` : `se abrió el cuadro de impresión y esperó ${(d.ms / 1000).toFixed(1)} s (la impresión directa NO está activa)`
  const text = () => ['ESTACIÓN DE IMPRESIÓN · diagnóstico', `Hora: ${new Date().toLocaleString('es-BO')}`, `Sesión: ${session ? 'sí (' + mask(session.user.email ?? '') + ')' : 'no'}`, `Acceso a rutas: ${ok === null ? 'sin comprobar' : ok ? 'sí' : 'no'}`, `Navegador: ${env}`, `Última consulta de la cola: ${d.last}`, `Órdenes pendientes: ${d.pending ?? '—'}`, `Última impresión: ${d.printed} → ${how}`, `Error de cola: ${d.err || 'ninguno'}`, `Error al imprimir: ${d.perr || 'ninguno'}`].join('\n')
  const copy = async () => { try { await navigator.clipboard.writeText(text()); alert('Diagnóstico copiado. Pégalo en el chat.') } catch { window.prompt('Copia este texto:', text()) } }

  const wrap = (c: React.ReactNode) => <main className="grid min-h-screen place-items-center bg-[#0b0f17] p-6 text-center text-sm text-slate-400"><div>{c}</div></main>
  if (session === undefined || (session && ok === null)) return wrap('Cargando…')
  if (session === null) return wrap(<>Inicia sesión en esta computadora y vuelve a abrir esta página.<br /><a href="/" className="mt-3 inline-block text-[#c6ff00] underline">Ir al inicio de sesión</a></>)
  if (!ok) return wrap('Esta cuenta no tiene acceso a las rutas de servicio.')
  const rows: [string, string][] = [['Sesión', mask(session.user.email ?? '')], ['Navegador', env], ['Última consulta de la cola', d.last], ['Órdenes pendientes', String(d.pending ?? '—')], ['Última impresión', `${d.printed} → ${how}`], ['Error de cola', d.err || 'ninguno'], ['Error al imprimir', d.perr || 'ninguno']]
  return <main className="print-root min-h-screen bg-[#0b0f17] p-6 text-slate-200">
    <div className="no-print mx-auto max-w-xl">
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#c6ff00]">Estación de impresión</p>
      <h1 className="mt-2 text-center text-2xl font-semibold text-white">Esta computadora imprime las rutas</h1>
      <p className="mt-2 text-center text-sm text-slate-400">{job ? `Imprimiendo la ruta ${job.route.number}…` : 'Esperando órdenes de impresión…'}</p>
      <div className="mt-6 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#161f30] text-xs">{rows.map(([a, b]) => <div key={a} className="flex justify-between gap-4 p-3"><span className="text-slate-500">{a}</span><span className="text-right text-slate-200">{b}</span></div>)}</div>
      <div className="mt-4 flex flex-wrap justify-center gap-2"><button onClick={check} className={btn}>Revisar la cola ahora</button><button onClick={() => setTest(true)} className={btn}>Imprimir página de prueba</button><button onClick={copy} className={btn}>Copiar diagnóstico</button></div>
      <p className="mt-4 text-center text-[11px] text-slate-600">Deja esta ventana abierta y la computadora encendida. Revisa la cola cada 8 segundos.</p>
    </div>
    {test && <div className="mt-6 bg-white p-10 text-black"><h1 className="text-xl font-bold">CIAGRO SA · Prueba de impresión</h1><p className="mt-2">{new Date().toLocaleString('es-BO')}</p></div>}
    {job && <div className="mt-6"><RouteSheet r={job.route} techs={job.techs} veh={job.veh} visits={job.visits} onBack={() => {}} /></div>}
  </main>
}
