'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LogOut, ArrowDownToLine, BarChart3, CalendarDays, ChevronRight, Download, Droplets, Fuel, Gauge, ListOrdered, Menu, Plus, Printer, Trash2, X, Zap } from 'lucide-react'
import { DB, EQUIPMENT, api, defaultMonth, equipmentReport, fetchDB, fmtBs, fmtDate, fmtL, monthLabel, months, vehicleStats, weekOf, ym } from '@/lib/store'
import { supabase } from '@/lib/supabase'

type Kind = 'load' | 'transfer' | 'vehicle'
type Modal = { kind: Kind; vehicleId?: string } | null
type View = 'panel' | 'movs' | 'report'

const GREEN = '#c6ff00', AMBER = '#ff8a00', CYAN = '#00d2ff'
const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const inputCls = 'h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#00d2ff]'

function Pickup({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d="M2 16v-3.5l3-1L7.2 8h5.3v8" /><path d="M12.5 10.5H22V16" /><path d="M7.9 8.7h3.1V11H6.6Z" /><path d="M2 16h2.2M8.8 16h6.4M19.8 16H22" /><circle cx="6.5" cy="16.5" r="2.3" /><circle cx="17.5" cy="16.5" r="2.3" /></svg>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>{children}</label>
}

function Stat({ icon: Icon, label, value, sub, color }: { icon: typeof Fuel; label: string; value: string; sub: string; color: string }) {
  return <div className="frost-card relative p-5"><div className="absolute right-4 top-4 grid size-9 place-items-center rounded-xl" style={{ background: color + '1a', color }}><Icon className="size-[17px]" /></div><p className="pr-10 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></div>
}

function Dot({ color, label, value }: { color: string; label: string; value: string }) {
  return <div><div className="mb-1 flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: color }} /><span className="text-[9px] font-semibold tracking-wider text-slate-500">{label}</span></div><p className="font-mono text-xs font-semibold text-slate-200">{value}</p></div>
}

function FormModal({ modal, db, onClose, onSave }: { modal: NonNullable<Modal>; db: DB; onClose: () => void; onSave: (kind: Kind, f: Record<string, string>) => Promise<string | null> }) {
  const { kind } = modal
  const ev = kind === 'vehicle' && modal.vehicleId ? db.vehicles.find(v => v.id === modal.vehicleId) : undefined
  const [f, setF] = useState<Record<string, string>>({ vehicleId: kind === 'vehicle' ? (ev?.id ?? '') : (modal.vehicleId ?? db.vehicles[0]?.id ?? ''), date: localNow().slice(0, 10), datetime: localNow(), equipment: EQUIPMENT[0], type: ev?.type ?? 'Diésel', name: ev?.name ?? '', plate: ev?.plate ?? '', driver: ev?.driver ?? '', odometer: ev ? String(ev.odometer) : '', tankCapacity: ev ? String(ev.tankCapacity) : '', initialLiters: ev ? String(ev.initialLiters) : '0', initialOdometer: ev ? String(ev.initialOdometer) : '0', avgKmL: ev ? String(ev.avgKmL) : '10', initialDate: ev?.initialDate ?? localNow().slice(0, 10), fullTank: '' })
  const [err, setErr] = useState<string | null>(null)
  const p = (k: string, ph = '', type = 'text') => ({ value: f[k] ?? '', placeholder: ph, type, className: inputCls, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }) })
  const tone = kind === 'load' ? GREEN : kind === 'transfer' ? AMBER : CYAN
  const title = kind === 'load' ? 'Registrar carga (factura)' : kind === 'transfer' ? 'Registrar extracción / salida' : ev ? 'Editar vehículo' : 'Agregar vehículo'
  const vehicleSelect = <Field label={kind === 'load' ? 'Camioneta' : 'Camioneta de origen'}><select {...p('vehicleId')} className={inputCls}>{db.vehicles.map(v => <option key={v.id} value={v.id} className="bg-[#111a2a]">{v.name} · {v.plate}</option>)}</select></Field>
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#05070c]/80 backdrop-blur-sm sm:items-center sm:p-6">
    <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#111a2a] shadow-2xl sm:rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.07] p-5"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: tone }}>Nueva operación</p><h2 className="text-lg font-semibold text-white">{title}</h2></div><button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X className="size-5" /></button></div>
      <div className="flex flex-col gap-4 p-5">
        {kind !== 'vehicle' && !db.vehicles.length ? <p className="text-sm text-slate-400">Primero agrega un vehículo.</p> : <>
          <div className="grid gap-4 sm:grid-cols-2">
            {kind === 'load' && <>{vehicleSelect}<Field label="Fecha"><input {...p('date', '', 'date')} /></Field><Field label="Litros"><input {...p('liters', '0.00', 'number')} inputMode="decimal" /></Field><Field label="Costo total (Bs.)"><input {...p('cost', '0.00', 'number')} inputMode="decimal" /></Field><Field label="N° de factura"><input {...p('invoice', 'FAC-000000')} /></Field><Field label="Odómetro (Km)"><input {...p('odometer', '000000', 'number')} inputMode="numeric" /></Field><label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-slate-200 sm:col-span-2"><input type="checkbox" checked={f.fullTank === '1'} onChange={e => setF({ ...f, fullTank: e.target.checked ? '1' : '' })} className="size-4 accent-[#c6ff00]" />¿Se llenó el tanque completo? <span className="text-xs text-slate-500">(permite calcular el rendimiento real)</span></label></>}
            {kind === 'transfer' && <>{vehicleSelect}<Field label="Fecha y hora"><input {...p('datetime', '', 'datetime-local')} /></Field><Field label="Litros"><input {...p('liters', '0.00', 'number')} inputMode="decimal" /></Field><Field label="Equipo destino"><select {...p('equipment')} className={inputCls}>{EQUIPMENT.map(e => <option key={e} className="bg-[#111a2a]">{e}</option>)}</select></Field><Field label="Responsable que retira"><input {...p('person', 'Nombre completo')} /></Field><Field label="Notas / orden de trabajo"><input {...p('notes', 'Ej. OT #884')} /></Field></>}
            {kind === 'vehicle' && <><Field label="Modelo"><input {...p('name', 'Toyota Hilux')} /></Field><Field label="Placa"><input {...p('plate', '0000-ABC')} /></Field><Field label="Combustible"><select {...p('type')} className={inputCls}><option className="bg-[#111a2a]">Diésel</option><option className="bg-[#111a2a]">Gasolina</option></select></Field><Field label="Conductor asignado"><input {...p('driver', 'Nombre completo')} /></Field><Field label="Odómetro actual (Km)"><input {...p('odometer', '0', 'number')} inputMode="numeric" /></Field><p className="border-t border-white/[0.07] pt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#00d2ff] sm:col-span-2">Ajuste / carga inicial de combustible</p><Field label="Capacidad del tanque (L)"><input {...p('tankCapacity', '80', 'number')} inputMode="decimal" /></Field><Field label="Litros iniciales (stock base)"><input {...p('initialLiters', '0', 'number')} inputMode="decimal" /></Field><Field label="Odómetro inicial (Km)"><input {...p('initialOdometer', '0', 'number')} inputMode="numeric" /></Field><Field label="Fecha de inicio del sistema"><input {...p('initialDate', '', 'date')} /></Field><Field label="Rendimiento nominal (Km/L)"><input {...p('avgKmL', '10', 'number')} inputMode="decimal" /></Field></>}
          </div>
          {err && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
          <div className="flex justify-end gap-2 border-t border-white/[0.07] pt-4">
            <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-white/5">Cancelar</button>
            <button onClick={async () => { const e = await onSave(kind, f); e ? setErr(e) : onClose() }} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#0b0f17]" style={{ background: tone }}>{ev ? 'Guardar cambios' : 'Guardar operación'}</button>
          </div></>}
      </div>
    </div>
  </div>
}

function exportCsv(db: DB, m: string, rep: ReturnType<typeof equipmentReport>) {
  const plate = (id: string) => db.vehicles.find(v => v.id === id)?.plate ?? ''
  const n = (x: number) => x.toFixed(2).replace('.', ',')
  const rows: (string | number)[][] = [
    ['EDAI FuelOps - Informe mensual', monthLabel(m)], [],
    ['Equipo / Maquinaria', 'Litros', 'Importe Bs.'], ...rep.map(r => [r.equipment, n(r.liters), n(r.cost)]), [],
    ['STOCK POR CAMIONETA (litros)'], ['Placa', 'Remanente mes anterior', 'Compras nuevas', 'Transferido a maquinaria', 'Consumo propio estimado', 'Remanente estimado al cierre'],
    ...db.vehicles.map(v => { const s = vehicleStats(db, v.id, m); return [v.plate, n(s.opening), n(s.purchased), n(s.transferred), n(s.ownEst), n(s.tankLevel)] }), [],
    ['CARGAS'], ['Fecha', 'Placa', 'Factura', 'Litros', 'Importe Bs.', 'Odometro', 'Conductor', 'Tanque lleno'],
    ...db.vehicles.filter(v => vehicleStats(db, v.id, m).showOpening).map(v => [`${m}-01`, v.plate, 'REMANENTE MES ANTERIOR', n(vehicleStats(db, v.id, m).opening), n(0), '', '', '']),
    ...db.loads.filter(l => ym(l.date) === m).map(l => [l.date, plate(l.vehicleId), l.invoice, n(l.liters), n(l.cost), l.odometer, l.driver, l.fullTank ? 'Sí' : 'No']), [],
    ['SALIDAS A MAQUINARIA'], ['Fecha y hora', 'Placa', 'Litros', 'Equipo', 'Responsable', 'Notas'],
    ...db.transfers.filter(t => ym(t.datetime) === m).map(t => [t.datetime.replace('T', ' '), plate(t.vehicleId), n(t.liters), t.equipment, t.person, t.notes]),
  ]
  const csv = '\ufeff' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `EDAI-informe-${m}.csv`
  a.click()
}

function Table({ heads, rows, onDelete }: { heads: string[]; rows: { id: string; cells: React.ReactNode[]; locked?: boolean }[]; onDelete?: (id: string) => void }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-slate-600">Sin movimientos en este mes.</p>
  return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-slate-600"><tr>{heads.map(h => <th key={h} className="whitespace-nowrap px-3 py-3 font-semibold">{h}</th>)}{onDelete && <th />}</tr></thead>
    <tbody className="divide-y divide-white/[0.06]">{rows.map(r => <tr key={r.id} className="text-slate-300">{r.cells.map((c, i) => <td key={i} className="whitespace-nowrap px-3 py-3.5">{c}</td>)}{onDelete && <td className="no-print px-3">{!r.locked && <button aria-label="Eliminar" onClick={() => confirm('¿Eliminar este registro?') && onDelete(r.id)} className="text-slate-600 hover:text-red-400"><Trash2 className="size-4" /></button>}</td>}</tr>)}</tbody></table></div>
}

function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) setErr('Correo o contraseña incorrectos.')
    setBusy(false)
  }
  return <main className="grid min-h-screen place-items-center bg-[#0b0f17] p-5"><form onSubmit={submit} className="frost-card w-full max-w-sm p-7">
    <div className="mb-6 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl text-[#0b0f17]" style={{ background: GREEN }}><Fuel className="size-5" strokeWidth={2.5} /></div><div><div className="text-base font-bold tracking-[0.18em] text-white">EDAI FUELOPS</div><div className="text-[10px] tracking-wider text-slate-500">Control de combustible y flota</div></div></div>
    <div className="flex flex-col gap-4"><Field label="Correo"><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></Field><Field label="Contraseña"><input type="password" required value={pass} onChange={e => setPass(e.target.value)} className={inputCls} /></Field>
    {err && <p className="text-xs text-red-300">{err}</p>}
    <button disabled={busy} className="h-11 rounded-xl text-sm font-bold text-[#0b0f17] disabled:opacity-60" style={{ background: GREEN }}>{busy ? 'Ingresando…' : 'Ingresar'}</button></div>
  </form></main>
}

export default function FuelOpsDashboard() {
  const [db, setDb] = useState<DB | null>(null)
  const [month, setMonth] = useState('')
  const [view, setView] = useState<View>('panel')
  const [modal, setModal] = useState<Modal>(null)
  const [selId, setSelId] = useState<string | null>(null)
  const [tab, setTab] = useState<'loads' | 'transfers'>('loads')
  const [menu, setMenu] = useState(false)

  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [role, setRole] = useState<'admin' | 'operador'>('operador')
  const [who, setWho] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const isAdmin = role === 'admin'

  const refresh = async () => { try { const d = await fetchDB(); setDb(d); setMonth(m => m || defaultMonth(d)); setLoadErr('') } catch (e) { setLoadErr((e as Error).message) } }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) { setDb(null); setMonth(''); return }
    refresh()
    supabase.from('profiles').select('role, full_name').eq('id', session.user.id).single().then(({ data }) => { if (data) { setRole(data.role); setWho(data.full_name ?? '') } })
    const ch = supabase.channel('edai').on('postgres_changes', { event: '*', schema: 'public' }, () => refresh()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session])

  const stats = useMemo(() => (db ? Object.fromEntries(db.vehicles.map(v => [v.id, vehicleStats(db, v.id, month)])) : {}), [db, month])
  const rep = useMemo(() => (db ? equipmentReport(db, month) : []), [db, month])
  if (session === null) return <Login />
  if (loadErr) return <main className="grid min-h-screen place-items-center bg-[#0b0f17] p-6 text-center text-sm text-red-300">No se pudo cargar la base de datos: {loadErr}</main>
  if (!db) return <main className="grid min-h-screen place-items-center bg-[#0b0f17] text-sm text-slate-500">Cargando EDAI FuelOps…</main>

  const S = (id: string) => stats[id] ?? vehicleStats(db, id, month)
  const sum = (f: (id: string) => number) => db.vehicles.reduce((a, v) => a + f(v.id), 0)
  const purchased = sum(id => S(id).purchased), cost = sum(id => S(id).cost), transferred = sum(id => S(id).transferred), opening = sum(id => S(id).opening)
  const diesel = db.vehicles.filter(v => v.type === 'Diésel').reduce((a, v) => a + S(v.id).purchased, 0)
  const plate = (id: string) => db.vehicles.find(v => v.id === id)?.plate ?? '—'
  const selected = db.vehicles.find(v => v.id === selId) ?? null
  const equipCount = rep.length

  async function onSave(kind: Kind, f: Record<string, string>): Promise<string | null> {
    const num = (k: string) => parseFloat((f[k] ?? '').replace(',', '.'))
    if (kind === 'vehicle') {
      if (!f.name?.trim() || !f.plate?.trim()) return 'Modelo y placa son obligatorios.'
      const body = { name: f.name.trim(), plate: f.plate.trim().toUpperCase(), type: f.type as 'Diésel' | 'Gasolina', driver: f.driver?.trim() || 'Sin asignar', odometer: num('odometer') || 0, tankCapacity: num('tankCapacity') || 0, initialLiters: num('initialLiters') || 0, initialOdometer: num('initialOdometer') || 0, avgKmL: num('avgKmL') > 0 ? num('avgKmL') : 10, initialDate: f.initialDate || localNow().slice(0, 10) }
      const { error } = f.vehicleId ? await api.updateVehicle(f.vehicleId, body) : await api.addVehicle(body)
      if (error) return error.code === '23505' ? 'Ya existe un vehículo con esa placa.' : error.message
      await refresh(); return null
    }
    const veh = db!.vehicles.find(v => v.id === f.vehicleId)
    if (!veh) return 'Selecciona una camioneta.'
    const liters = num('liters')
    if (!(liters > 0)) return 'Ingresa los litros (mayor a 0).'
    if (kind === 'load') {
      const c = num('cost'), odo = num('odometer')
      if (!f.date) return 'Ingresa la fecha.'
      if (isNaN(c) || c < 0) return 'Ingresa el costo total en Bs.'
      if (!f.invoice?.trim()) return 'Ingresa el número de factura.'
      if (isNaN(odo)) return 'Ingresa el odómetro.'
      const { error } = await api.addLoad({ vehicle_id: veh.id, date: f.date, liters, cost: c, invoice: f.invoice.trim(), odometer: odo, driver: veh.driver, full_tank: f.fullTank === '1' })
      if (error) return error.message
      setMonth(ym(f.date))
    } else {
      if (!f.datetime) return 'Ingresa fecha y hora.'
      if (!f.person?.trim()) return 'Indica quién retira el combustible.'
      const avail = veh.initialLiters + db!.loads.filter(l => l.vehicleId === veh.id).reduce((a, l) => a + l.liters, 0) - db!.transfers.filter(t => t.vehicleId === veh.id).reduce((a, t) => a + t.liters, 0)
      if (liters > avail) return `Solo hay ${fmtL(avail)} disponibles (stock inicial + facturas − salidas). Si falta una factura o el stock inicial, regístralo primero.`
      const { error } = await api.addTransfer({ vehicle_id: veh.id, datetime: f.datetime, liters, equipment: f.equipment, person: f.person.trim(), notes: f.notes?.trim() ?? '' })
      if (error) return error.message
      setMonth(ym(f.datetime))
    }
    await refresh(); return null
  }

  const del = (table: 'loads' | 'transfers') => async (id: string) => { const { error } = await api.del(table, id); error ? alert(error.message) : refresh() }
  const delLoad = isAdmin ? del('loads') : undefined
  const delTransfer = isAdmin ? del('transfers') : undefined
  async function delVehicle(v: DB['vehicles'][number]) {
    const nl = db!.loads.filter(l => l.vehicleId === v.id).length, nt = db!.transfers.filter(t => t.vehicleId === v.id).length
    if (!confirm(`¿Eliminar ${v.name} (${v.plate})? Se borrarán también sus ${nl} cargas y ${nt} salidas. Esto no se puede deshacer.`)) return
    const { error } = await api.delVehicle(v.id)
    if (error) alert(error.message); else { setSelId(null); refresh() }
  }
  const nav: [View, string, React.ComponentType<{ className?: string }>][] = [['panel', 'Panel y flota', Pickup], ['movs', 'Movimientos', ListOrdered], ['report', 'Reportes mensuales', CalendarDays]]

  const loadRows = (id?: string) => db.loads.filter(l => ym(l.date) === month && (!id || l.vehicleId === id)).sort((a, b) => b.date.localeCompare(a.date))
  const trRows = (id?: string) => db.transfers.filter(t => ym(t.datetime) === month && (!id || t.vehicleId === id)).sort((a, b) => b.datetime.localeCompare(a.datetime))
  const openingRows = (id?: string) => db.vehicles.filter(v => !id || v.id === id).filter(v => S(v.id).showOpening).map(v => ({ id: 'open-' + v.id, locked: true, cells: [fmtDate(month + '-01'), ...(id ? [] : [v.plate]), <span key="o" className="rounded-md border border-[#00d2ff]/30 bg-[#00d2ff]/10 px-2 py-1 text-[10px] font-bold tracking-wider" style={{ color: CYAN }}>REMANENTE MES ANTERIOR</span>, <span key="l" style={{ color: CYAN }}>{fmtL(S(v.id).opening)}</span>, `${fmtBs(0)} · arrastre`, '—', '—', '—'] }))
  const loadTable = (id?: string) => <Table heads={['Fecha', ...(id ? [] : ['Placa']), 'Factura', 'Litros', 'Importe', 'Odómetro', 'Conductor', 'Lleno']} onDelete={delLoad} rows={[...openingRows(id), ...loadRows(id).map(l => ({ id: l.id, cells: [fmtDate(l.date), ...(id ? [] : [plate(l.vehicleId)]), l.invoice, <span key="l" style={{ color: GREEN }}>{fmtL(l.liters)}</span>, fmtBs(l.cost), `${l.odometer.toLocaleString('es-BO')} km`, l.driver, l.fullTank ? '✓' : '—'] }))]} />
  const trTable = (id?: string) => <Table heads={['Fecha y hora', ...(id ? [] : ['Placa']), 'Litros', 'Destino', 'Responsable', 'Motivo']} onDelete={delTransfer} rows={trRows(id).map(t => ({ id: t.id, cells: [fmtDate(t.datetime), ...(id ? [] : [plate(t.vehicleId)]), <span key="l" style={{ color: AMBER }}>{fmtL(t.liters)}</span>, t.equipment, t.person, t.notes || '—'] }))} />

  return <main className="print-root min-h-screen bg-[#0b0f17] text-slate-200">
    <aside className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/[0.07] bg-[#0d131f] p-5 transition-transform lg:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl text-[#0b0f17]" style={{ background: GREEN }}><Fuel className="size-5" strokeWidth={2.5} /></div><div><div className="text-[15px] font-bold tracking-[0.18em] text-white">EDAI</div><div className="text-[9px] font-medium tracking-[0.22em] text-slate-500">FUELOPS</div></div></div><button onClick={() => setMenu(false)} className="text-slate-500 lg:hidden"><X className="size-5" /></button></div>
      <nav className="mt-12 flex flex-col gap-1">{nav.map(([k, label, Icon]) => <button key={k} onClick={() => { setView(k); setMenu(false) }} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${view === k ? 'bg-[#c6ff00]/10 font-medium text-[#c6ff00]' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}><Icon className="size-[17px]" />{label}</button>)}</nav>
      <div className="mt-auto rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"><p className="truncate text-xs font-medium text-white">{who || session?.user.email}</p><p className="mt-0.5 text-[10px] uppercase tracking-wider" style={{ color: isAdmin ? GREEN : CYAN }}>{isAdmin ? 'Administrador' : 'Operador'}</p><button onClick={() => supabase.auth.signOut()} className="mt-3 flex items-center gap-2 text-xs text-slate-500 hover:text-white"><LogOut className="size-4" />Cerrar sesión</button></div>
    </aside>

    <div className="lg:pl-64">
      <header className="no-print flex h-[76px] items-center justify-between border-b border-white/[0.07] px-5 sm:px-8">
        <div className="flex items-center gap-3"><button onClick={() => setMenu(true)} className="text-slate-400 lg:hidden" aria-label="Abrir menú"><Menu className="size-5" /></button><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">EDAI FuelOps //</p><h1 className="mt-0.5 text-sm font-semibold text-white sm:text-base">Control de Combustible y Flota</h1></div></div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3"><CalendarDays className="size-4 text-slate-500" /><select value={month} onChange={e => setMonth(e.target.value)} className="h-10 bg-transparent text-xs text-slate-300 outline-none">{months(db).map(m => <option key={m} value={m} className="bg-[#111a2a]">{monthLabel(m)}</option>)}</select></div>
      </header>

      <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
        <h2 className="print-only hidden text-xl font-semibold">EDAI FuelOps — Informe de {monthLabel(month)}</h2>
        <div className="no-print mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c6ff00]">{monthLabel(month)}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{view === 'panel' ? 'Resumen operativo' : view === 'movs' ? 'Movimientos del mes' : 'Informe mensual'}</h2></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModal({ kind: 'transfer' })} className="flex h-11 items-center gap-2 rounded-xl border border-[#ff8a00]/30 bg-[#ff8a00]/10 px-4 text-xs font-semibold text-[#ffae47] hover:bg-[#ff8a00]/20"><ArrowDownToLine className="size-4" />− Registrar salida a maquinaria</button>
            <button onClick={() => setModal({ kind: 'load' })} className="flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold text-[#0b0f17] hover:brightness-110" style={{ background: GREEN }}><Plus className="size-4" />Registrar carga (factura)</button>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Droplets} color={GREEN} label="Compras nuevas del mes" value={fmtL(purchased)} sub={`${fmtBs(cost)} en facturas`} />
          <Stat icon={ArrowDownToLine} color={AMBER} label="Transferido a maquinaria" value={fmtL(transferred)} sub={`${equipCount} equipo${equipCount === 1 ? '' : 's'} abastecido${equipCount === 1 ? '' : 's'}`} />
          <Stat icon={Gauge} color={CYAN} label="Stock total operativo" value={fmtL(purchased + opening)} sub={`${fmtL(opening)} remanente + ${fmtL(purchased)} compras`} />
          <Stat icon={Zap} color="#4d9bff" label="Diésel vs. gasolina" value={`${fmtL(diesel)} / ${fmtL(purchased - diesel)}`} sub={purchased ? `${Math.round((diesel / purchased) * 100)}% es diésel` : 'Sin cargas en el mes'} />
        </section>

        {view === 'panel' && <section className="mt-10">
          <div className="mb-4 flex items-end justify-between"><h2 className="text-lg font-semibold text-white">Vehículos <span className="ml-2 rounded-md bg-white/[0.06] px-2 py-1 text-xs font-normal text-slate-500">{db.vehicles.length}</span></h2>{isAdmin && <button onClick={() => setModal({ kind: 'vehicle' })} className="flex items-center gap-1.5 text-xs text-[#00d2ff] hover:text-white"><Plus className="size-4" />Agregar vehículo</button>}</div>
          {!db.vehicles.length && <p className="frost-card p-8 text-center text-sm text-slate-500">No hay vehículos registrados. {isAdmin ? 'Agrega el primero para empezar.' : 'Pide a un administrador que los registre.'}</p>}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{db.vehicles.map(v => { const s = S(v.id); const pct = v.tankCapacity > 0 ? Math.min(100, (s.tankLevel / v.tankCapacity) * 100) : s.opening + s.purchased > 0 ? Math.min(100, (s.tankLevel / (s.opening + s.purchased)) * 100) : 0; const c = v.type === 'Diésel' ? CYAN : GREEN
            return <button key={v.id} onClick={() => { setSelId(v.id); setTab('loads') }} className="frost-card group text-left transition-all duration-200 hover:-translate-y-1 hover:border-white/20">
              <div className="flex items-center gap-3 p-5 pb-3"><div className="grid size-11 place-items-center rounded-xl bg-white/[0.06] text-slate-300"><Pickup className="size-6" /></div><div><h3 className="font-semibold text-white">{v.name}</h3><p className="mt-0.5 text-xs text-slate-500">{v.driver}</p></div></div>
              <div className="flex items-center gap-2 px-5"><span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] font-semibold tracking-wider text-white">{v.plate}</span><span className="rounded-md bg-white/[0.05] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: c }}>{v.type}</span></div>
              <div className="px-5 pt-5"><div className="mb-2 flex justify-between"><span className="text-[11px] uppercase tracking-wider text-slate-500">Nivel estimado del tanque</span><span className="text-sm font-semibold text-white">{Math.round(pct)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c, boxShadow: `0 0 12px ${c}66` }} /></div></div>
              <div className="grid grid-cols-3 gap-2 p-5"><Dot color={GREEN} label="CARGADO" value={fmtL(s.purchased)} /><Dot color={AMBER} label="TRASPASADO" value={fmtL(s.transferred)} /><Dot color={CYAN} label="EN TANQUE ~" value={fmtL(s.tankLevel)} /></div>
              <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-xs text-slate-500 group-hover:text-white"><span>Ver detalle y movimientos</span><ChevronRight className="size-4" /></div>
            </button> })}</div>
        </section>}

        {view === 'movs' && <section className="mt-10 grid gap-6"><div className="frost-card p-5"><h3 className="mb-2 text-sm font-semibold" style={{ color: GREEN }}>Cargas (facturas)</h3>{loadTable()}</div><div className="frost-card p-5"><h3 className="mb-2 text-sm font-semibold" style={{ color: AMBER }}>Salidas a maquinaria</h3>{trTable()}</div></section>}

        {view === 'report' && <section className="frost-card mt-10 p-5 sm:p-6">
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Asignación</p><h3 className="mt-1 text-base font-semibold text-white">Consumo por equipo / maquinaria</h3></div><div className="flex gap-2"><button onClick={() => exportCsv(db, month, rep)} className="flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Download className="size-4" />Excel (CSV)</button><button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5"><Printer className="size-4" />PDF / Imprimir</button></div></div>
          <Table heads={['Equipo / maquinaria', 'Litros', 'Importe (Bs.)', '% del total']} rows={rep.map(r => ({ id: r.equipment, cells: [r.equipment, <span key="l" style={{ color: AMBER }}>{fmtL(r.liters)}</span>, fmtBs(r.cost), `${transferred ? Math.round((r.liters / transferred) * 100) : 0}%`] }))} />
          {!!rep.length && <div className="mt-4 flex justify-between border-t border-white/[0.07] px-3 pt-4 text-sm font-semibold text-white"><span>Total asignado</span><span className="font-mono">{fmtL(transferred)} · {fmtBs(rep.reduce((a, r) => a + r.cost, 0))}</span></div>}
          <p className="mt-4 px-3 text-[11px] text-slate-600">El importe por equipo se calcula con el precio promedio por litro de las facturas de la camioneta de origen en el mes.</p>
          <h3 className="mt-8 text-base font-semibold text-white">Balance de combustible por camioneta</h3>
          <Table heads={['Placa', 'Remanente mes anterior', 'Compras nuevas', 'Transferido a maquinaria', 'Consumo propio est.', 'Remanente est. al cierre']} rows={db.vehicles.map(v => { const s = S(v.id); return { id: v.id, cells: [v.plate, <span key="o" style={{ color: CYAN }}>{fmtL(s.opening)}</span>, fmtL(s.purchased), fmtL(s.transferred), fmtL(s.ownEst), <strong key="c">{fmtL(s.tankLevel)}</strong>] } })} />
        </section>}
      </div>
    </div>

    {modal && <FormModal key={modal.kind + (modal.vehicleId ?? '')} modal={modal} db={db} onClose={() => setModal(null)} onSave={onSave} />}

    {selected && (() => { const s = S(selected.id); const weeks = [0, 1, 2, 3].map(w => ({ buy: s.loads.filter(l => weekOf(+l.date.slice(8, 10)) === w).reduce((a, l) => a + l.liters, 0), out: s.transfers.filter(t => weekOf(+t.datetime.slice(8, 10)) === w).reduce((a, t) => a + t.liters, 0) })); const max = Math.max(1, ...weeks.flatMap(w => [w.buy, w.out]))
      return <div className="no-print fixed inset-0 z-50 flex justify-end bg-[#05070c]/70 backdrop-blur-sm" onClick={() => setSelId(null)}><div onClick={e => e.stopPropagation()} className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#101827] p-5 sm:p-8">
        <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: CYAN }}>Detalle de vehículo · {monthLabel(month)}</p><h2 className="mt-2 text-2xl font-semibold text-white">{selected.name}</h2><p className="mt-2 text-sm text-slate-400"><span className="font-mono text-white">{selected.plate}</span> · {selected.type} · {selected.driver}</p></div><button onClick={() => setSelId(null)} className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white" aria-label="Cerrar"><X className="size-5" /></button></div>
        <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Odómetro actual</p><p className="mt-1 font-mono text-lg font-semibold text-white">{selected.odometer.toLocaleString('es-BO')} <span className="text-xs font-normal text-slate-500">km</span></p></div><div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Rendimiento {s.rateReal ? `real · tanque lleno (${s.segments} tramo${s.segments === 1 ? '' : 's'})` : 'nominal'}</p><p className="mt-1 font-mono text-lg font-semibold" style={{ color: CYAN }}>{s.rate.toFixed(1)} km/L</p></div></div>
        <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"><p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Estado del combustible · {monthLabel(month)}</p>
          <div className="grid grid-cols-3 gap-3 text-xs"><div><p className="text-slate-500">Total en facturas</p><p className="mt-1 font-mono text-sm font-semibold" style={{ color: GREEN }}>{fmtL(s.purchased)}</p></div><div><p className="text-slate-500">Transferido a maquinaria</p><p className="mt-1 font-mono text-sm font-semibold" style={{ color: AMBER }}>{fmtL(s.transferred)}</p></div><div><p className="text-slate-500">Remanente estimado en tanque</p><p className="mt-1 font-mono text-sm font-semibold" style={{ color: CYAN }}>{fmtL(s.tankLevel)}</p></div></div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${selected.tankCapacity > 0 ? Math.min(100, (s.tankLevel / selected.tankCapacity) * 100) : 0}%`, background: CYAN }} /></div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Remanente del mes anterior: {fmtL(s.opening)} (sin costo) · Consumo propio estimado: {fmtL(s.ownEst)} ({s.km.toLocaleString('es-BO')} km ÷ {s.rate.toFixed(1)} km/L){selected.tankCapacity > 0 ? ` · Capacidad: ${fmtL(selected.tankCapacity)}` : ''}. Es una estimación: no se asume que el tanque quedó vacío.</p>
          {s.closing < -1 && <p className="mt-2 text-[11px] text-amber-300">El estimado es negativo: revisa los litros iniciales, los odómetros o el rendimiento.</p>}</div>
        <div className="mt-4 flex gap-2"><button onClick={() => setModal({ kind: 'load', vehicleId: selected.id })} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-[#0b0f17]" style={{ background: GREEN }}><Plus className="size-4" />Carga</button><button onClick={() => setModal({ kind: 'transfer', vehicleId: selected.id })} className="flex h-10 items-center gap-1.5 rounded-xl border border-[#ff8a00]/30 bg-[#ff8a00]/10 px-3 text-xs font-semibold text-[#ffae47]"><ArrowDownToLine className="size-4" />Salida</button>{isAdmin && <><button onClick={() => setModal({ kind: 'vehicle', vehicleId: selected.id })} className="ml-auto flex h-10 items-center rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5">Editar vehículo</button><button onClick={() => delVehicle(selected)} className="flex h-10 items-center gap-1.5 rounded-xl border border-red-500/30 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/10"><Trash2 className="size-4" />Eliminar</button></>}</div>
        <div className="mt-6 flex gap-1 border-b border-white/[0.08]">{(['loads', 'transfers'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`border-b-2 px-3 pb-3 text-xs font-semibold ${tab === t ? 'text-white' : 'border-transparent text-slate-500'}`} style={tab === t ? { borderColor: t === 'loads' ? GREEN : AMBER } : undefined}>{t === 'loads' ? 'Historial de cargas' : 'Extracciones y traspasos'}</button>)}</div>
        <div className="mt-3">{tab === 'loads' ? loadTable(selected.id) : trTable(selected.id)}</div>
        <div className="mt-8"><p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Compras vs. transferencias por semana</p><div className="flex h-36 items-end justify-around gap-4">{weeks.map((w, i) => <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="flex h-full items-end gap-1"><div className="w-4 rounded-t-sm" title={fmtL(w.buy)} style={{ height: `${(w.buy / max) * 100}%`, background: GREEN }} /><div className="w-4 rounded-t-sm" title={fmtL(w.out)} style={{ height: `${(w.out / max) * 100}%`, background: AMBER }} /></div><span className="text-[10px] text-slate-600">{['1–7', '8–14', '15–21', '22–fin'][i]}</span></div>)}</div><div className="mt-4 flex gap-5 text-[10px] text-slate-500"><span><i className="mr-2 inline-block size-2 rounded-sm" style={{ background: GREEN }} />Cargas</span><span><i className="mr-2 inline-block size-2 rounded-sm" style={{ background: AMBER }} />Salidas a maquinaria</span></div></div>
      </div></div> })()}
  </main>
}

export { FuelOpsDashboard }
