'use client'

import AppShell from '@/components/app-shell'
import { useAppSession } from '@/components/use-app-session'
import Preparacion from './preparacion'

export default function PreparacionPage() {
  const { session, role, who, setWho, mods, ready } = useAppSession()
  const wrap = (c: React.ReactNode) => <main className="grid min-h-screen place-items-center bg-[#0b0f17] p-6 text-center text-sm text-slate-400"><div>{c}</div></main>
  if (session === undefined || (session && !ready)) return wrap('Cargando…')
  if (session === null) return wrap(<>Inicia sesión para continuar.<br /><a href="/" className="mt-3 inline-block text-[#c6ff00] underline">Ir al inicio de sesión</a></>)
  const areas = (['tractores', 'implementos'] as const).filter(a => mods.includes(a))
  if (!areas.length) return wrap(<>No tienes acceso a la preparación de maquinaria.<br />Pide al administrador que te lo asigne.<br /><a href="/resumen" className="mt-3 inline-block text-[#c6ff00] underline">Ir a mi panel</a></>)
  return <AppShell active="preparacion" email={session.user.email ?? ''} userId={session.user.id} mods={mods} isAdmin={role === 'admin'} who={who} onWho={setWho}><Preparacion areas={[...areas]} isAdmin={role === 'admin'} who={who || session.user.email || ''} /></AppShell>
}
