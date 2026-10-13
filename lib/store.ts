export type Fuel = 'Diésel' | 'Gasolina'
export type Vehicle = { id: string; name: string; plate: string; type: Fuel; driver: string; odometer: number; kmpl: number | null; opening: number }
export type Load = { id: string; vehicleId: string; date: string; liters: number; cost: number; invoice: string; odometer: number; driver: string }
export type Transfer = { id: string; vehicleId: string; datetime: string; liters: number; equipment: string; person: string; notes: string }
export type DB = { vehicles: Vehicle[]; loads: Load[]; transfers: Transfer[] }

export const EQUIPMENT = ['Taller', 'Maquinaria', 'Insumos', 'Comercial']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export const uid = () => Math.random().toString(36).slice(2, 10)
export const ym = (s: string) => s.slice(0, 7)
export const monthLabel = (m: string) => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`
export const nowYm = () => new Date().toISOString().slice(0, 7)
export const fmtL = (n: number) => `${(n ?? 0).toLocaleString('es-BO', { maximumFractionDigits: 1 })} L`
export const fmtBs = (n: number) => `Bs. ${(n ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const fmtDate = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}${s.length > 10 ? ' · ' + s.slice(11, 16) : ''}` }

import { supabase } from './supabase'

export async function fetchDB(): Promise<DB> {
  const [v, l, t] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at'),
    supabase.from('loads').select('*'),
    supabase.from('transfers').select('*'),
  ])
  const err = v.error || l.error || t.error
  if (err) throw err
  return {
    vehicles: v.data!.map(r => ({ id: r.id, name: r.name, plate: r.plate, type: r.type, driver: r.driver, odometer: +r.odometer, kmpl: r.kmpl == null ? null : +r.kmpl, opening: +(r.opening_liters ?? 0) })),
    loads: l.data!.map(r => ({ id: r.id, vehicleId: r.vehicle_id, date: r.date, liters: +r.liters, cost: +r.cost, invoice: r.invoice, odometer: +r.odometer, driver: r.driver })),
    transfers: t.data!.map(r => ({ id: r.id, vehicleId: r.vehicle_id, datetime: r.datetime, liters: +r.liters, equipment: r.equipment, person: r.person, notes: r.notes })),
  }
}

export const api = {
  addVehicle: (v: Record<string, unknown>) => supabase.from('vehicles').insert(v),
  updateTransfer: (id: string, t: Record<string, unknown>) => supabase.from('transfers').update(t).eq('id', id),
  updateVehicle: (id: string, v: Record<string, unknown>) => supabase.from('vehicles').update(v).eq('id', id),
  delVehicle: (id: string) => supabase.from('vehicles').delete().eq('id', id),
  addLoad: (l: Record<string, unknown>) => supabase.from('loads').insert(l),
  addTransfer: (t: Record<string, unknown>) => supabase.from('transfers').insert(t),
  del: (table: 'loads' | 'transfers', id: string) => supabase.from(table).delete().eq('id', id),
}

export function months(db: DB) {
  const s = new Set<string>([nowYm()])
  db.loads.forEach(l => s.add(ym(l.date)))
  db.transfers.forEach(t => s.add(ym(t.datetime)))
  return [...s].sort().reverse()
}
export function defaultMonth(db: DB) {
  const all = [...db.loads.map(l => ym(l.date)), ...db.transfers.map(t => ym(t.datetime))].sort()
  return all.length ? all[all.length - 1] : nowYm()
}

export function vehicleStats(db: DB, id: string, m: string) {
  const loads = db.loads.filter(l => l.vehicleId === id && ym(l.date) === m).sort((a, b) => a.date.localeCompare(b.date))
  const transfers = db.transfers.filter(t => t.vehicleId === id && ym(t.datetime) === m)
  const purchased = loads.reduce((s, l) => s + l.liters, 0)
  const cost = loads.reduce((s, l) => s + l.cost, 0)
  const transferred = transfers.reduce((s, t) => s + t.liters, 0)
  const net = purchased - transferred
  const odo = loads.map(l => l.odometer)
  const km = odo.length > 1 ? Math.max(...odo) - Math.min(...odo) : 0
  return { loads, transfers, purchased, cost, transferred, net, km, pricePerL: purchased ? cost / purchased : 0 }
}

export function equipmentReport(db: DB, m: string) {
  const avg = (id: string) => { const s = vehicleStats(db, id, m); return s.pricePerL }
  const all = db.loads.filter(l => ym(l.date) === m)
  const globalAvg = all.length ? all.reduce((s, l) => s + l.cost, 0) / all.reduce((s, l) => s + l.liters, 0) : 0
  const map = new Map<string, { liters: number; cost: number }>()
  db.transfers.filter(t => ym(t.datetime) === m).forEach(t => {
    const r = map.get(t.equipment) ?? { liters: 0, cost: 0 }
    r.liters += t.liters; r.cost += t.liters * (avg(t.vehicleId) || globalAvg)
    map.set(t.equipment, r)
  })
  return [...map.entries()].map(([equipment, r]) => ({ equipment, ...r })).sort((a, b) => b.liters - a.liters)
}

export const weekOf = (day: number) => Math.min(3, Math.floor((day - 1) / 7))

// ---- Saldo acumulado de combustible por camioneta (no altera lo cargado ni lo extraído del mes) ----
const DAY = 864e5
const dayMs = (s: string) => Date.parse(s.slice(0, 10))
function odoAt(pts: { t: number; o: number }[], t: number) {
  if (!pts.length) return 0
  if (t <= pts[0].t) return pts[0].o
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) { const a = pts[i - 1], b = pts[i]; return b.t === a.t ? b.o : a.o + ((b.o - a.o) * (t - a.t)) / (b.t - a.t) }
  }
  return pts[pts.length - 1].o
}
export function balance(db: DB, id: string, m: string, todayStr: string) {
  const v = db.vehicles.find(x => x.id === id)
  const loads = db.loads.filter(l => l.vehicleId === id)
  const trs = db.transfers.filter(t => t.vehicleId === id)
  const pts = loads.map(l => ({ t: dayMs(l.date), o: l.odometer })).filter(p => !isNaN(p.o)).sort((a, b) => a.t - b.t)
  const start = Date.parse(m + '-01')
  const [y, mo] = m.split('-').map(Number)
  const cap = Math.max(Math.min(Date.UTC(y, mo, 0), dayMs(todayStr)), start - DAY)
  const before = (s: string) => dayMs(s) < start
  const pre = loads.filter(l => before(l.date)).reduce((a, l) => a + l.liters, 0) - trs.filter(t => before(t.datetime)).reduce((a, t) => a + t.liters, 0)
  const kmpl = v?.kmpl && v.kmpl > 0 ? v.kmpl : null
  const prevOdo = odoAt(pts, start - DAY)
  const km = Math.max(0, odoAt(pts, cap) - prevOdo)
  const kmBefore = Math.max(0, prevOdo - (pts.length ? pts[0].o : 0))
  const use = kmpl ? km / kmpl : 0
  const opening = (v?.opening ?? 0) + pre - (kmpl ? kmBefore / kmpl : 0)
  const st = vehicleStats(db, id, m)
  const close = opening + st.purchased - st.transferred - use
  return { kmpl, km, opening, use, close, warn: kmpl !== null && close < -0.05 * Math.max(1, st.purchased) }
}
