'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Inspections from './inspections'
import ProfileName from '@/components/profile-name'

export default function InspeccionesPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [role, setRole] = useState('operador')
  const [who, setWho] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return
    supabase.from('profiles').select('role, full_name').eq('id', session.user.id).single().then(({ data }) => { if (data) { setRole(data.role); setWho(data.full_name ?? '') } })
  }, [session])

  if (session === undefined) return <main className="grid min-h-screen place-items-center bg-[#0b0f17] text-sm text-slate-500">Cargando…</main>
  if (session === null) return <main className="grid min-h-screen place-items-center bg-[#0b0f17] p-6 text-center text-sm text-slate-400"><div>Inicia sesión para ver las inspecciones.<br /><a href="/" className="mt-3 inline-block text-[#c6ff00] underline">Ir al inicio de sesión</a></div></main>

  return <main className="print-root min-h-screen bg-[#0b0f17] text-slate-200">
    <header className="no-print flex h-[68px] items-center justify-between border-b border-white/[0.07] px-5 sm:px-8">
      <a href="/" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"><ArrowLeft className="size-4" />Control de combustible</a>
      <span className="text-[10px] font-bold tracking-[0.2em] text-white">CIAGRO SRL · INSPECCIONES</span>
      <div className="flex min-w-0 items-center gap-4 text-xs text-slate-400"><ProfileName userId={session.user.id} name={who} fallback={session.user.email ?? ''} onSaved={setWho} /><button onClick={() => supabase.auth.signOut()} className="shrink-0 text-slate-500 hover:text-white">Salir</button></div>
    </header>
    <div className="mx-auto max-w-[1500px] p-5 sm:p-8"><Inspections isAdmin={role === 'admin'} who={who || session.user.email || ''} /></div>
  </main>
}
