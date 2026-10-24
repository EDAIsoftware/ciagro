'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type P = { id: string; full_name: string | null; role: string }
const MODS: [string, string][] = [['combustible', 'Combustible'], ['inspecciones', 'Inspecciones y taller'], ['rutas', 'Rutas de servicio'], ['tractores', 'Preparación de tractores'], ['implementos', 'Preparación de implementos']]

export default function UsuariosPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [people, setPeople] = useState<P[]>([])
  const [mods, setMods] = useState<Set<string>>(new Set())
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([supabase.from('profiles').select('id, full_name, role').order('full_name'), supabase.from('user_modules').select('user_id, module')])
    if (a.error || b.error) return setErr((a.error || b.error)!.message)
    setPeople((a.data ?? []) as P[]); setMods(new Set((b.data ?? []).map(r => `${r.user_id}:${r.module}`))); setErr('')
  }, [])
  useEffect(() => {
    if (!session) return
    supabase.from('profiles').select('role').eq('id', session.user.id).single().then(({ data }) => { const ok = data?.role === 'admin'; setAdmin(ok); if (ok) load() })
  }, [session, load])

  async function toggle(p: P, m: string, on: boolean) {
    const q = on ? await supabase.from('user_modules').insert({ user_id: p.id, module: m }) : await supabase.from('user_modules').delete().eq('user_id', p.id).eq('module', m)
    q.error ? alert(q.error.message) : load()
  }
  const wrap = (c: React.ReactNode) => <main className="grid min-h-screen place-items-center bg-[#0b0f17] p-6 text-center text-sm text-slate-400"><div>{c}</div></main>
  if (session === undefined || (session && admin === null)) return wrap('Cargando…')
  if (session === null) return wrap(<>Inicia sesión para continuar.<br /><a href="/" className="mt-3 inline-block text-[#c6ff00] underline">Ir al inicio de sesión</a></>)
  if (!admin) return wrap(<>Solo el administrador puede ver esta pantalla.<br /><a href="/" className="mt-3 inline-block text-[#c6ff00] underline">Volver</a></>)

  return <main className="min-h-screen bg-[#0b0f17] text-slate-200">
    <header className="flex h-[68px] items-center justify-between border-b border-white/[0.07] px-5 sm:px-8"><a href="/" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"><ArrowLeft className="size-4" />Volver</a><span className="text-[10px] font-bold tracking-[0.2em] text-white">CIAGRO SRL · USUARIOS Y PERMISOS</span><span className="w-16" /></header>
    <div className="mx-auto max-w-2xl p-5 sm:p-8">
      <h1 className="text-2xl font-semibold text-white">Quién puede usar cada módulo</h1>
      <p className="mt-2 text-sm text-slate-500">Cada persona solo ve los módulos que marques. Los administradores ven todo. Las cuentas nuevas empiezan sin ningún módulo.</p>
      {err && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}. ¿Ya ejecutaste los archivos .sql en Supabase?</p>}
      <div className="mt-6 flex flex-col gap-3">{people.map(p => <div key={p.id} className="rounded-2xl border border-white/[0.08] bg-[#161f30] p-4">
        <p className="text-sm text-white">{p.full_name || 'Sin nombre'}<span className="ml-2 text-[11px] uppercase tracking-wider text-slate-500">{p.role === 'admin' ? 'Administrador' : 'Operador'}</span></p>
        {p.role === 'admin' ? <p className="mt-2 text-xs text-[#c6ff00]">Acceso total</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{MODS.map(([m, l]) => <label key={m} className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" className="size-5" checked={mods.has(`${p.id}:${m}`)} onChange={e => toggle(p, m, e.target.checked)} />{l}</label>)}</div>}
      </div>)}{!people.length && <p className="p-6 text-center text-sm text-slate-500">No hay usuarios.</p>}</div>
    </div></main>
}
