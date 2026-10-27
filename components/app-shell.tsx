'use client'

import { useState } from 'react'
import { ClipboardCheck, Fuel, LayoutDashboard, LogOut, Menu, Route as RouteIcon, Users, Wrench } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProfileName from './profile-name'

type Props = { active: string; email: string; userId: string; mods: string[]; isAdmin: boolean; who: string; onWho: (n: string) => void; children: React.ReactNode }

// Menú lateral común: cada persona ve solo los módulos que tiene habilitados.
export default function AppShell({ active, email, userId, mods, isAdmin, who, onWho, children }: Props) {
  const [open, setOpen] = useState(false)
  const items = [
    { k: 'resumen', href: '/resumen', label: 'Panel general', Icon: LayoutDashboard, show: true },
    { k: 'combustible', href: '/', label: 'Combustible', Icon: Fuel, show: mods.includes('combustible') },
    { k: 'inspecciones', href: '/inspecciones', label: 'Inspecciones y taller', Icon: ClipboardCheck, show: mods.includes('inspecciones') },
    { k: 'rutas', href: '/rutas', label: 'Rutas de servicio', Icon: RouteIcon, show: mods.includes('rutas') },
    { k: 'preparacion', href: '/preparacion', label: 'Preparación', Icon: Wrench, show: mods.includes('tractores') || mods.includes('implementos') },
    { k: 'usuarios', href: '/usuarios', label: 'Usuarios y permisos', Icon: Users, show: isAdmin },
  ].filter(i => i.show)
  return <main className="print-root min-h-screen bg-[#0b0f17] text-slate-200">
    <aside className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/[0.07] bg-[#0d131f] p-5 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl text-[#0b0f17]" style={{ background: '#c6ff00' }}><Fuel className="size-5" strokeWidth={2.5} /></div><div><div className="text-[15px] font-bold tracking-[0.18em] text-white">CIAGRO</div><div className="text-[9px] font-medium tracking-[0.22em] text-slate-500">PLATAFORMA</div></div></div>
      <nav className="mt-10 flex flex-col gap-1">{items.map(({ k, href, label, Icon }) => <a key={k} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${active === k ? 'bg-[#c6ff00]/10 font-medium text-[#c6ff00]' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}><Icon className="size-[17px]" />{label}</a>)}</nav>
      <div className="mt-auto rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"><div className="text-xs font-medium text-white"><ProfileName userId={userId} name={who} fallback={email} onSaved={onWho} /></div><p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{isAdmin ? 'Administrador' : 'Operador'}</p><button onClick={() => supabase.auth.signOut()} className="mt-3 flex items-center gap-2 text-xs text-slate-500 hover:text-white"><LogOut className="size-4" />Cerrar sesión</button></div>
    </aside>
    {open && <div className="no-print fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
    <div className="lg:pl-64">
      <header className="no-print flex h-[56px] items-center border-b border-white/[0.07] px-4 lg:hidden"><button onClick={() => setOpen(true)} aria-label="Abrir menú" className="text-slate-400"><Menu className="size-5" /></button><span className="ml-3 text-[10px] font-bold tracking-[0.2em] text-white">CIAGRO SRL</span></header>
      <div className="shell-body mx-auto max-w-[1200px] p-4 sm:p-8">{children}</div>
    </div>
  </main>
}
