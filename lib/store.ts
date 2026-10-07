export type Fuel = 'Diésel' | 'Gasolina'
export type Vehicle = {
  id: string; name: string; plate: string; type: Fuel; driver: string; odometer: number
  tankCapacity: number; initialLiters: number; initialOdometer: number; avgKmL: number; initialDate: string
}
export type Load = { id: string; vehicleId: string; date: string; liters: number; cost: number; invoice: string; odometer: number; driver: string; fullTank: boolean }
export type Transfer = { id: string; vehicleId: string; datetime: string; liters: number; equipment: string; person: string; notes: string }
export type DB = { vehicles: Vehicle[]; loads: Load[]; transfers: Transfer[] }

export const EQUIPMENT = ['Maquinaria', 'Taller', 'Comercial', 'Almacen']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export const uid = () => Math.random().toString(36).slice(2, 10)
export const ym = (s: string) => s.slice(0, 7)
export const monthLabel = (m: string) => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`
export const nowYm = () => new Date().toISOString().slice(0, 7)
export const prevYm = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7) }
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
    vehicles: v.data!.map(r => ({
      id: r.id, name: r.name, plate: r.plate, type: r.type, driver: r.driver, odometer: +r.odometer,
      tankCapacity: +(r.tank_capacity ?? 0), initialLiters: +(r.initial_liters ?? 0), initialOdometer: +(r.initial_odometer ?? 0),
      avgKmL: +(r.avg_km_per_l ?? 10) || 10, initialDate: r.initial_date ?? String(r.created_at).slice(0, 10),
    })),
    loads: l.data!.map(r => ({ id: r.id, vehicleId: r.vehicle_id, date: r.date, liters: +r.liters, cost: +r.cost, invoice: r.invoice, odometer: +r.odometer, driver: r.driver, fullTank: !!r.full_tank })),
    transfers: t.data!.map(r => ({ id: r.id, vehicleId: r.vehicle_id, datetime: r.datetime, liters: +r.liters, equipment: r.equipment, person: r.person, notes: r.notes })),
  }
}

const vehicleRow = (v: Omit<Vehicle, 'id'>) => ({
  name: v.name, plate: v.plate, type: v.type, driver: v.driver, odometer: v.odometer,
  tank_capacity: v.tankCapacity, initial_liters: v.initialLiters, initial_odometer: v.initialOdometer, avg_km_per_l: v.avgKmL, initial_date: v.initialDate,
})

export const api = {
  addVehicle: (v: Omit<Vehicle, 'id'>) => supabase.from('vehicles').insert(vehicleRow(v)),
  updateVehicle: (id: string, v: Omit<Vehicle, 'id'>) => supabase.from('vehicles').update(vehicleRow(v)).eq('id', id),
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

const sumL = (a: { liters: number }[]) => a.reduce((s, x) => s + x.liters, 0)

// Odómetro de partida: el declarado; si no hay, el menor odómetro de sus cargas (evita km absurdos)
function odoBase(db: DB, v: Vehicle) {
  if (v.initialOdometer > 0) return v.initialOdometer
  const o = db.loads.filter(l => l.vehicleId === v.id).map(l => l.odometer)
  return o.length ? Math.min(...o) : v.odometer
}
// Odómetro máximo conocido hasta el cierre del mes x
function odoEnd(db: DB, v: Vehicle, x: string) {
  const o = db.loads.filter(l => l.vehicleId === v.id && ym(l.date) <= x).map(l => l.odometer)
  return Math.max(odoBase(db, v), x >= nowYm() ? v.odometer : 0, ...o)
}

// Rendimiento real: método Full-to-Full (entre dos cargas con tanque lleno)
export function fullToFull(db: DB, id: string) {
  const loads = db.loads.filter(l => l.vehicleId === id).sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer)
  const trs = db.transfers.filter(t => t.vehicleId === id)
  let km = 0, liters = 0, n = 0, prev = -1
  loads.forEach((l, i) => {
    if (!l.fullTank) return
    if (prev >= 0) {
      const a = loads[prev]
      const bought = sumL(loads.slice(prev + 1, i + 1))
      const out = sumL(trs.filter(t => t.datetime.slice(0, 10) > a.date && t.datetime.slice(0, 10) <= l.date))
      const dk = l.odometer - a.odometer, net = bought - out
      if (dk > 0 && net > 0) { km += dk; liters += net; n++ }
    }
    prev = i
  })
  const r = n && liters ? km / liters : null
  // Si el dato es implausible (p. ej. salidas sin registrar), se ignora y se usa el rendimiento nominal
  return { rate: r !== null && r >= 2 && r <= 40 ? r : null, segments: n }
}

// Stock estimado en el tanque al cierre del mes x (acumulado desde el inicio)
function stockEnd(db: DB, v: Vehicle, x: string, rate: number) {
  const L = sumL(db.loads.filter(l => l.vehicleId === v.id && ym(l.date) <= x))
  const T = sumL(db.transfers.filter(t => t.vehicleId === v.id && ym(t.datetime) <= x))
  return v.initialLiters + L - T - (odoEnd(db, v, x) - odoBase(db, v)) / rate
}

export function vehicleStats(db: DB, id: string, m: string) {
  const v = db.vehicles.find(x => x.id === id)
  const loads = db.loads.filter(l => l.vehicleId === id && ym(l.date) === m).sort((a, b) => a.date.localeCompare(b.date))
  const transfers = db.transfers.filter(t => t.vehicleId === id && ym(t.datetime) === m)
  const purchased = sumL(loads)
  const cost = loads.reduce((s, l) => s + l.cost, 0)
  const transferred = sumL(transfers)
  let opening = 0, closing = 0, km = 0, ownEst = 0, rate = 10, rateReal = false, segments = 0, showOpening = false
  if (v) {
    const ftf = fullToFull(db, id)
    rate = ftf.rate ?? (v.avgKmL > 0 ? v.avgKmL : 10); rateReal = ftf.rate !== null; segments = ftf.segments
    const p = prevYm(m)
    opening = stockEnd(db, v, p, rate)
    closing = stockEnd(db, v, m, rate)
    km = Math.max(0, odoEnd(db, v, m) - odoEnd(db, v, p))
    ownEst = km / rate
    showOpening = m >= ym(v.initialDate) && opening > 0.05
  }
  return { loads, transfers, purchased, cost, transferred, opening: Math.max(0, opening), ownEst, closing, tankLevel: Math.max(0, closing), km, rate, rateReal, segments, showOpening, pricePerL: purchased ? cost / purchased : 0 }
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
