// Parse LR rows pasted/copied from Excel (tab-separated) into POL LR rows.
// Zero dependencies — Excel clipboard is tab-separated, so split('\n') + split('\t').
// The same COLUMN headers drive the downloadable template, so they can't drift apart.

export const LR_COLUMNS = [
  'Vehicle No', 'Driver', 'Cleaner', 'Paper LR No', 'Capacity',
  'Allocated', 'Loaded', 'Delivered', 'LR Date', 'E-way Bill', 'Remarks',
] as const

export type PastedLrRow = {
  vehicleId: number; driverId: number; cleanerId?: number
  paperLrNumber: string; vehicleCapacity: number; allocatedWeight: number
  loadedWeight: number; deliveredWeight: number; lrDate: string
  ewayBillNumber: string; remarks: string
}

type VehicleLookup = { id: number; registrationNumber: string; capacityInTons?: number }
type StaffLookup = { userId: number; userName: string }

export type ParseLookups = {
  vehicles: VehicleLookup[]
  drivers: StaffLookup[]
  cleaners: StaffLookup[]
}

export type ParseResult = {
  rows: PastedLrRow[]
  unmatchedVehicles: string[]
  unmatchedDrivers: string[]
}

export function buildTemplateCsv(): string {
  const example = [
    'AP31AB1234', 'Ramesh', 'Suresh', 'PL-001', '16',
    '15', '15', '15', '15-10-2026', 'EWB123456', '',
  ]
  return `${LR_COLUMNS.join(',')}\n${example.join(',')}\n`
}

// Strip spaces/hyphens, uppercase — so "AP 31 AB 1234" matches "AP31AB1234".
const normReg = (s: string) => s.replace(/[\s-]/g, '').toUpperCase()
const normName = (s: string) => s.trim().toLowerCase()
const num = (s: string) => {
  const n = parseFloat((s ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

// ponytail: three date formats (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD); add more if a client pastes another.
function toIsoDate(raw: string): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return '' // unrecognised → leave blank, staff fill it in the grid
}

function looksLikeHeader(cells: string[]): boolean {
  // A real data row has a numeric weight somewhere (Allocated/Loaded/Delivered); a header row doesn't.
  return num(cells[5]) === 0 && num(cells[6]) === 0 && num(cells[7]) === 0
    && /[a-z]/i.test(cells[0] ?? '') && num(cells[0]) === 0 && !/\d/.test(cells[4] ?? '')
}

export function parsePastedLrs(text: string, lookups: ParseLookups): ParseResult {
  const { vehicles, drivers, cleaners } = lookups
  const rows: PastedLrRow[] = []
  const unmatchedVehicles = new Set<string>()
  const unmatchedDrivers = new Set<string>()

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)

  lines.forEach((line, idx) => {
    const c = line.split('\t')
    if (idx === 0 && looksLikeHeader(c)) return // skip a pasted header row

    const regRaw = (c[0] ?? '').trim()
    const vehicle = regRaw ? vehicles.find(v => normReg(v.registrationNumber) === normReg(regRaw)) : undefined
    if (regRaw && !vehicle) unmatchedVehicles.add(regRaw)

    const driverRaw = (c[1] ?? '').trim()
    const driver = driverRaw ? drivers.find(d => normName(d.userName) === normName(driverRaw)) : undefined
    if (driverRaw && !driver) unmatchedDrivers.add(driverRaw)

    const cleanerRaw = (c[2] ?? '').trim()
    const cleaner = cleanerRaw ? cleaners.find(d => normName(d.userName) === normName(cleanerRaw)) : undefined

    rows.push({
      vehicleId: vehicle?.id ?? 0,
      driverId: driver?.userId ?? 0,
      cleanerId: cleaner?.userId,
      paperLrNumber: (c[3] ?? '').trim(),
      vehicleCapacity: num(c[4]) || vehicle?.capacityInTons || 0,
      allocatedWeight: num(c[5]),
      loadedWeight: num(c[6]),
      deliveredWeight: num(c[7]),
      lrDate: toIsoDate(c[8] ?? ''),
      ewayBillNumber: (c[9] ?? '').trim(),
      remarks: (c[10] ?? '').trim(),
    })
  })

  return { rows, unmatchedVehicles: [...unmatchedVehicles], unmatchedDrivers: [...unmatchedDrivers] }
}
