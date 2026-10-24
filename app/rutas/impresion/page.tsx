'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { RouteSheet, type Req, type Route, type Tech, type Veh } from '../rutas'

type Job = { id: string; route: Route; techs: Tech[]; veh?: Veh; visits: Req[] }

export default function EstacionImpresion() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [ok, setOk] = useState<boolean | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [msg, setMsg] = useState('Esperando órdenes de impresión…')
  const cur = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (session) supabase.rpc('my_modules').then(({ data }) => setOk(((data ?? []) as string[]).includes('rutas'))) }, [session])

  const check = useCallback(async () => {
    if (cur.current) return
    const { data: jobs, error } = await supabase.from('rt_print_jobs').select('id,route_id').is('printed_at', null).order('requested_at').limit(1)
    if (error) return setMsg('No se pudo consultar la cola: ' + error.message)
    if (!jobs?.length) return
    const j = jobs[0]; cur.current = j.id
    const [r, t, q] = await Promise.all([supabase.from('rt_routes').select('*').eq('id', j.route_id).single(), supabase.from('rt_technicians').select('*'), supabase.from('rt_requests').select('*').eq('route_id', j.route_id)])
    if (r.error) { cur.current = null; return setMsg('No se pudo cargar la ruta: ' + r.error.message) }
    const { data: v } = r.data.vehicle_id ? await supabase.from('insp_vehicles').select('id,name,plate,driver,area,odometer,km_next').eq('id', r.data.vehicle_id).single() : { data: null }
    setJob({ id: j.id, route: { ...r.data, cash: +(r.data.cash ?? 0), support: r.data.support ?? [] } as Route, techs: (t.data ?? []) as Tech[], veh: (v ?? undefined) as Veh | undefined, visits: (q.data ?? []).map(x => ({ ...x, amount: x.amount == null ? null : +x.amount })) as Req[] })
  }, [])
  useEffect(() => { if (!ok) return; check(); const t = setInterval(check, 8000); return () => clearInterval(t) }, [ok, check])
  useEffect(() => {
    if (!job) return
    const t = setTimeout(async () => {
      window.print()
      await supabase.from('rt_print_jobs').update({ printed_at: new Date().toISOString() }).eq('id', job.id)
      setMsg(`Última impresión: ruta ${job.route.number} a las ${new Date().toLocaleTimeString('es-BO')}`); cur.current = null; setJob(null)
    }, 1500)
    return () => clearTimeout(t)
  }, [job])

  const wrap = (c: React.ReactNode) => <main className="grid min-h-screen place-items-center bg-[#0b0f17] p-6 text-center text-sm text-slate-400"><div>{c}</div></main>
  if (session === undefined || (session && ok === null)) return wrap('Cargando…')
  if (session === null) return wrap(<>Inicia sesión en esta computadora y vuelve a abrir esta página.<br /><a href="/" className="mt-3 inline-block text-[#c6ff00] underline">Ir al inicio de sesión</a></>)
  if (!ok) return wrap('Esta cuenta no tiene acceso a las rutas de servicio.')
  return <main className="print-root min-h-screen bg-[#0b0f17] p-6 text-slate-200">
    <div className="no-print mx-auto max-w-xl text-center"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c6ff00]">Estación de impresión</p><h1 className="mt-2 text-2xl font-semibold text-white">Esta computadora imprime las rutas</h1><p className="mt-3 text-sm text-slate-400">{job ? `Imprimiendo la ruta ${job.route.number}…` : msg}</p><p className="mt-6 text-xs text-slate-600">Deja esta ventana abierta y la computadora encendida. Revisa cada 8 segundos si hay hojas por imprimir.</p></div>
    {job && <div className="mt-6"><RouteSheet r={job.route} techs={job.techs} veh={job.veh} visits={job.visits} onBack={() => {}} /></div>}
  </main>
}
