'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Sesión, rol, nombre y módulos habilitados de la persona que entró.
export function useAppSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [role, setRole] = useState('operador')
  const [who, setWho] = useState('')
  const [mods, setMods] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) { setReady(false); return }
    Promise.all([supabase.from('profiles').select('role, full_name').eq('id', session.user.id).single(), supabase.rpc('my_modules')]).then(([p, m]) => {
      if (p.data) { setRole(p.data.role); setWho(p.data.full_name ?? '') }
      setMods((m.data ?? []) as string[]); setReady(true)
    })
  }, [session])
  return { session, role, who, setWho, mods, ready }
}
