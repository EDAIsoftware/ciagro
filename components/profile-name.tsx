'use client'

import { useEffect, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Muestra el nombre del usuario y permite cambiarlo (no se muestra el correo en los registros).
export default function ProfileName({ userId, name, fallback, onSaved }: { userId: string; name: string; fallback: string; onSaved: (n: string) => void }) {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState('')
  const [err, setErr] = useState('')

  // Si el nombre guardado todavía es el correo, se pide uno al entrar
  useEffect(() => { if (name.includes('@')) { setV(''); setOpen(true) } }, [name])

  async function save() {
    const n = v.trim()
    if (n.length < 2) return setErr('Escribe tu nombre.')
    const { data, error } = await supabase.from('profiles').update({ full_name: n }).eq('id', userId).select('id')
    if (error) return setErr(error.message)
    if (!data?.length) return setErr('No se encontró tu perfil. Avisa al administrador.')
    onSaved(n); setOpen(false)
  }

  return <>
    <button onClick={() => { setV(name.includes('@') ? '' : name); setErr(''); setOpen(true) }} title="Cambiar mi nombre" className="flex max-w-full items-center gap-1.5 text-left hover:text-white"><span className="truncate">{name || fallback}</span><Pencil className="size-3 shrink-0 opacity-60" /></button>
    {open && <div className="no-print fixed inset-0 z-[70] flex items-end justify-center bg-[#05070c]/80 backdrop-blur-sm sm:items-center sm:p-6"><div className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#111a2a] p-5 text-left sm:rounded-2xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Tu nombre</h2><button onClick={() => setOpen(false)} aria-label="Cerrar" className="text-slate-500 hover:text-white"><X className="size-5" /></button></div>
      <p className="mb-3 text-xs text-slate-400">Este nombre aparecerá en las inspecciones y registros que hagas, en lugar de tu correo.</p>
      <input autoFocus value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="Nombre y apellido" className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-[#00d2ff]" />
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOpen(false)} className="px-3 text-xs text-slate-400">Ahora no</button><button onClick={save} className="rounded-xl bg-[#c6ff00] px-4 py-2.5 text-xs font-bold text-[#0b0f17]">Guardar</button></div>
    </div></div>}
  </>
}
