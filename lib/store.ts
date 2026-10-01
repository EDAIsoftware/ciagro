export type Fuel = 'Diésel' | 'Gasolina'
export type Vehicle = { id: string; name: string; plate: string; type: Fuel; driver: string; odometer: number }
export type Load = { id: string; vehicleId: string; date: string; liters: number; cost: number; invoice: string; odometer: number; driver: string }
export type Transfer = { id: string; vehicleId: string; datetime: string; liters: number; equipment: string; person: string; notes: string }
export type DB = { vehicles: Vehicle[]; loads: Load[]; transfers: Transfer[] }

export const EQUIPMENT = ['Excavadora CAT 320', 'Retroexcavadora 01', 'Generador Principal', 'Maquinaria Agrícola', 'Taller']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export const uid = () => Math.random().toString(36).slice(2, 10)
export const ym = (s: string) => s.slice(0, 7)
export const monthLabel = (m: string) => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`
export const nowYm = () => new Date().toISOString().slice(0, 7)
export const fmtL = (n: number) => `${n.toLocaleString('es-BO', { maximumFractionDigits: 1 })} L`
export const fmtBs = (n: number) => `Bs. ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
    vehicles: v.data!.map(r => ({ id: r.id, name: r.name, plate: r.plate, type: r.type, driver: r.driver, odometer: +r.odometer })),
    loads: l.data!.map(r => ({ id: r.id, vehicleId: r.vehicle_id, date: r.date, liters: +r.liters, cost: +r.cost, invoice: r.invoice, odometer: +r.odometer, driver: r.driver })),
    transfers: t.data!.map(r => ({ id: r.id, vehicleId: r.vehicle_id, datetime: r.datetime, liters: +r.liters, equipment: r.equipment, person: r.person, notes: r.notes })),
  }
}

export const api = {
  addVehicle: (v: Omit<Vehicle, 'id'>) => supabase.from('vehicles').insert(v),
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
