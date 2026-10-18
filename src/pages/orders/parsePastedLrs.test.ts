import { describe, it, expect } from 'vitest'
import { parsePastedLrs, buildTemplateCsv, LR_COLUMNS, type ParseLookups } from './parsePastedLrs'

const lookups: ParseLookups = {
  vehicles: [{ id: 7, registrationNumber: 'AP31AB1234', capacityInTons: 16 }],
  drivers: [{ userId: 11, userName: 'Ramesh' }],
  cleaners: [{ userId: 22, userName: 'Suresh' }],
}

describe('parsePastedLrs', () => {
  it('matches vehicle (normalised), driver, cleaner and parses weights + date', () => {
    const text = 'AP 31-AB 1234\tramesh\tSURESH\tPL-001\t16\t15\t14\t14\t15/10/2026\tEWB1\tnote'
    const { rows, unmatchedVehicles, unmatchedDrivers } = parsePastedLrs(text, lookups)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      vehicleId: 7, driverId: 11, cleanerId: 22, paperLrNumber: 'PL-001',
      vehicleCapacity: 16, allocatedWeight: 15, loadedWeight: 14, deliveredWeight: 14,
      lrDate: '2026-10-15', ewayBillNumber: 'EWB1', remarks: 'note',
    })
    expect(unmatchedVehicles).toEqual([])
    expect(unmatchedDrivers).toEqual([])
  })

  it('reports unmatched vehicle/driver but still yields a row to fix in the grid', () => {
    const text = 'XX00XX0000\tUnknown Driver\t\t\t\t10\t10\t10\t\t\t'
    const { rows, unmatchedVehicles, unmatchedDrivers } = parsePastedLrs(text, lookups)
    expect(rows).toHaveLength(1)
    expect(rows[0].vehicleId).toBe(0)
    expect(rows[0].driverId).toBe(0)
    expect(unmatchedVehicles).toEqual(['XX00XX0000'])
    expect(unmatchedDrivers).toEqual(['Unknown Driver'])
  })

  it('skips a pasted header row and falls back to vehicle capacity when blank', () => {
    const text = `${LR_COLUMNS.join('\t')}\nAP31AB1234\tRamesh\t\t\t\t15\t15\t15\t\t\t`
    const { rows } = parsePastedLrs(text, lookups)
    expect(rows).toHaveLength(1)
    expect(rows[0].vehicleCapacity).toBe(16) // from vehicle master, column blank
  })
})

describe('buildTemplateCsv', () => {
  it('starts with the exact column order', () => {
    expect(buildTemplateCsv().split('\n')[0]).toBe(LR_COLUMNS.join(','))
  })
})
