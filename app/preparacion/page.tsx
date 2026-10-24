'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProfileName from '@/components/profile-name'
import Preparacion from './preparacion'

export default function PreparacionPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [role, setRole] = useState('operador')
  const [who, setWho] = useState('')
  const [mods, setMods] = useState<string[] | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return
    supabase.from('profiles').select('role, full_name').eq('id', session.user.id).single().then(({ data }) => { if (data) { setRole(data.role); setWho(data.full_name ?? '') } })
    supabase.rpc('my_modules').then(({ data }) => setMods((data ?? []) as string[]))
  }, [session])

  const wrap = (c: React.ReactNode) => <main className="grid min-h-screen place-items-center bg-[#0b0f17] p-6 text-center text-sm text-slate-400"><div>{c}</div></main>
  if (session === undefined || (session && mods === null)) return wrap('Cargando…')
  if (session === null) return wrap(<>Inicia sesión para continuar.<br /><a href="/" className="mt-3 inline-block text-[#c6ff00] underline">Ir al inicio de sesión</a></>)
  const areas = (['tractores', 'implementos'] as const).filter(a => mods!.includes(a))
  if (!areas.length) return wrap(<>No tienes acceso a la preparación de maquinaria.<br />Pide al administrador que te lo asigne.<br /><a href="/" className="mt-3 inline-block text-[#c6ff00] underline">Volver</a></>)

  return <main className="min-h-screen bg-[#0b0f17] text-slate-200">
    <header className="flex h-[68px] items-center justify-between gap-3 border-b border-white/[0.07] px-5 sm:px-8">
      <a href="/" className="flex shrink-0 items-center gap-2 text-xs text-slate-400 hover:text-white"><ArrowLeft className="size-4" /><span className="hidden sm:inline">Inicio</span></a>
      <span className="truncate text-[10px] font-bold tracking-[0.2em] text-white">CIAGRO SRL · PREPARACIÓN</span>
      <div className="flex min-w-0 items-center gap-4 text-xs text-slate-400"><ProfileName userId={session.user.id} name={who} fallback={session.user.email ?? ''} onSaved={setWho} /><button onClick={() => supabase.auth.signOut()} className="shrink-0 text-slate-500 hover:text-white">Salir</button></div>
    </header>
    <div className="mx-auto max-w-[1100px] p-4 sm:p-8"><Preparacion areas={[...areas]} isAdmin={role === 'admin'} who={who || session.user.email || ''} /></div>
  </main>
}
