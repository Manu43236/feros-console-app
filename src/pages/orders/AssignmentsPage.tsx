import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '@/api/orders'
import { vehiclesApi } from '@/api/vehicles'
import { staffApi } from '@/api/staff'
import type { Order, Vehicle, VehicleAllocation } from '@/types'
import { toast } from 'sonner'
import { Plus, Truck, Users, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ── Flattened row types ────────────────────────────────────────────────────────
interface VehicleAssignmentRow {
  orderId: number; orderNumber: string; clientName: string
  allocationId: number; registrationNumber: string
  allocatedWeight: number; allocationStatus: string
  expectedLoadDate?: string; expectedDeliveryDate?: string
  driversCount: number
}

interface DriverAssignmentRow {
  orderId: number; orderNumber: string
  allocationId: number; registrationNumber: string
  staffAllocationId: number; userName: string; roleName: string
  allocationStatus: string; expectedStartDate?: string
}

// ── Add Vehicle Assignment Dialog ─────────────────────────────────────────────
function AddVehicleAssignmentDialog({ open, onClose, orders, vehicles }: {
  open: boolean; onClose: () => void
  orders: Order[]; vehicles: Vehicle[]
}) {
  const qc = useQueryClient()
  const [orderId, setOrderId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [allocatedWeight, setAllocatedWeight] = useState('')
  const [expectedLoadDate, setExpectedLoadDate] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [remarks, setRemarks] = useState('')

  const eligibleOrders = orders.filter(o =>
    ['PENDING', 'PARTIALLY_ASSIGNED'].includes(o.orderStatus) && o.isActive
  )
  const availableVehicles = vehicles.filter(v => !v.isAssigned && v.isActive)

  const mutation = useMutation({
    mutationFn: () => ordersApi.assignVehicle(Number(orderId), {
      vehicleId: Number(vehicleId),
      allocatedWeight: Number(allocatedWeight),
      expectedLoadDate: expectedLoadDate || undefined,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      remarks: remarks || undefined,
    }),
    onSuccess: () => {
      toast.success('Vehicle assigned successfully')
      qc.invalidateQueries({ queryKey: ['assignments-orders'] })
      qc.invalidateQueries({ queryKey: ['assignments-vehicles'] })
      handleClose()
    },
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to assign vehicle')
    },
  })

  function handleClose() {
    setOrderId(''); setVehicleId(''); setAllocatedWeight('')
    setExpectedLoadDate(''); setExpectedDeliveryDate(''); setRemarks('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Vehicle Assignment</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Order <span className="text-red-500">*</span></Label>
            <select
              className="w-full mt-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-feros-orange"
              value={orderId}
              onChange={e => setOrderId(e.target.value)}
            >
              <option value="">Select order (Pending / Partially Assigned)</option>
              {eligibleOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} — {o.clientName} · {o.sourceCityName} → {o.destinationCityName} ({o.orderStatus})
                </option>
              ))}
            </select>
            {eligibleOrders.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No pending or partially assigned orders found.</p>
            )}
          </div>

          <div>
            <Label>Available Vehicle <span className="text-red-500">*</span></Label>
            <select
              className="w-full mt-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-feros-orange"
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
            >
              <option value="">Select vehicle</option>
              {availableVehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber}{v.vehicleTypeName ? ` — ${v.vehicleTypeName}` : ''}{v.capacityInTons ? ` (${v.capacityInTons} T)` : ''}
                </option>
              ))}
            </select>
            {availableVehicles.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No available vehicles found.</p>
            )}
          </div>

          <div>
            <Label>Allocated Weight (tons) <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 20"
              value={allocatedWeight}
              onChange={e => setAllocatedWeight(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Expected Load Date</Label>
              <Input type="date" value={expectedLoadDate} onChange={e => setExpectedLoadDate(e.target.value)} />
            </div>
            <div>
              <Label>Expected Delivery Date</Label>
              <Input type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Remarks</Label>
            <Input placeholder="Optional remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!orderId || !vehicleId || !allocatedWeight || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Assigning…' : 'Assign Vehicle'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Assign Driver Dialog ───────────────────────────────────────────────────────
function AssignDriverDialog({ open, onClose, orders, drivers }: {
  open: boolean; onClose: () => void
  orders: Order[]
  drivers: { id: number; name: string; isActive: boolean; isAssigned?: boolean }[]
}) {
  const qc = useQueryClient()
  const [allocationKey, setAllocationKey] = useState('') // "orderId|allocationId"
  const [driverId, setDriverId] = useState('')
  const [expectedStartDate, setExpectedStartDate] = useState('')
  const [expectedEndDate, setExpectedEndDate] = useState('')
  const [remarks, setRemarks] = useState('')

  // Vehicle allocations that have no driver assigned yet
  const vehiclesWithoutDriver: { orderId: number; orderNumber: string; allocation: VehicleAllocation }[] = []
  orders.forEach(order => {
    ;(order.vehicleAllocations ?? []).forEach(va => {
      const hasDriver = (va.staffAllocations ?? []).some(sa => sa.roleName === 'DRIVER')
      if (!hasDriver && va.allocationStatus !== 'CANCELLED') {
        vehiclesWithoutDriver.push({ orderId: order.id, orderNumber: order.orderNumber, allocation: va })
      }
    })
  })

  const activeDrivers = drivers.filter(d => d.isActive && !d.isAssigned)
  const [parsedOrderId, parsedAllocationId] = allocationKey
    ? allocationKey.split('|').map(Number)
    : [0, 0]

  const mutation = useMutation({
    mutationFn: () => ordersApi.assignStaff(parsedOrderId, {
      vehicleAllocationId: parsedAllocationId,
      userId: Number(driverId),
      expectedStartDate: expectedStartDate || undefined,
      expectedEndDate: expectedEndDate || undefined,
      remarks: remarks || undefined,
    }),
    onSuccess: () => {
      toast.success('Driver assigned successfully')
      qc.invalidateQueries({ queryKey: ['assignments-orders'] })
      qc.invalidateQueries({ queryKey: ['assignments-users'] })
      handleClose()
    },
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to assign driver')
    },
  })

  function handleClose() {
    setAllocationKey(''); setDriverId('')
    setExpectedStartDate(''); setExpectedEndDate(''); setRemarks('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Assign Driver</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Vehicle Allocation (without driver) <span className="text-red-500">*</span></Label>
            <select
              className="w-full mt-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-feros-orange"
              value={allocationKey}
              onChange={e => setAllocationKey(e.target.value)}
            >
              <option value="">Select vehicle allocation</option>
              {vehiclesWithoutDriver.map(({ orderId, orderNumber, allocation }) => (
                <option key={allocation.id} value={`${orderId}|${allocation.id}`}>
                  {orderNumber} — {allocation.registrationNumber || allocation.vehicleRegistrationNumber} ({allocation.allocatedWeight} T)
                </option>
              ))}
            </select>
            {vehiclesWithoutDriver.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">All assigned vehicles already have a driver.</p>
            )}
          </div>

          <div>
            <Label>Driver <span className="text-red-500">*</span></Label>
            <select
              className="w-full mt-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-feros-orange"
              value={driverId}
              onChange={e => setDriverId(e.target.value)}
            >
              <option value="">Select driver</option>
              {activeDrivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Expected Start Date</Label>
              <Input type="date" value={expectedStartDate} onChange={e => setExpectedStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Expected End Date</Label>
              <Input type="date" value={expectedEndDate} onChange={e => setExpectedEndDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Remarks</Label>
            <Input placeholder="Optional remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!allocationKey || !driverId || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Assigning…' : 'Assign Driver'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Status badge helper ────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-gray-100 text-gray-700',
  ASSIGNED:   'bg-blue-100 text-blue-700',
  IN_PROGRESS:'bg-amber-100 text-amber-800',
  COMPLETED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AssignmentsPage() {
  const [tab, setTab] = useState<'vehicle' | 'driver'>('vehicle')
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [showAssignDriver, setShowAssignDriver] = useState(false)
  const qc = useQueryClient()

  const { data: ordersRes, isLoading } = useQuery({
    queryKey: ['assignments-orders'],
    queryFn: ordersApi.getAll,
  })
  const { data: vehiclesRes } = useQuery({
    queryKey: ['assignments-vehicles'],
    queryFn: () => vehiclesApi.getAll(),
  })
  const { data: usersRes } = useQuery({
    queryKey: ['assignments-users'],
    queryFn: staffApi.getUsers,
  })

  const orders = (ordersRes?.data ?? []) as Order[]
  const vehicles = (vehiclesRes?.data ?? []) as Vehicle[]
  const users = usersRes?.data ?? []
  const drivers = users.filter(u => u.role === 'DRIVER')

  // ── Flatten vehicle assignment rows ──────────────────────────────────────────
  const vehicleRows: VehicleAssignmentRow[] = []
  orders.forEach(o => {
    ;(o.vehicleAllocations ?? []).forEach(va => {
      vehicleRows.push({
        orderId:            o.id,
        orderNumber:        o.orderNumber,
        clientName:         o.clientName,
        allocationId:       va.id,
        registrationNumber: va.registrationNumber || va.vehicleRegistrationNumber || '—',
        allocatedWeight:    va.allocatedWeight,
        allocationStatus:   va.allocationStatus,
        expectedLoadDate:   va.expectedLoadDate,
        expectedDeliveryDate: va.expectedDeliveryDate,
        driversCount: (va.staffAllocations ?? []).filter(sa => sa.roleName === 'DRIVER').length,
      })
    })
  })

  // ── Flatten driver assignment rows ───────────────────────────────────────────
  const driverRows: DriverAssignmentRow[] = []
  orders.forEach(o => {
    ;(o.vehicleAllocations ?? []).forEach(va => {
      ;(va.staffAllocations ?? [])
        .filter(sa => sa.roleName === 'DRIVER')
        .forEach(sa => {
          driverRows.push({
            orderId:            o.id,
            orderNumber:        o.orderNumber,
            allocationId:       va.id,
            registrationNumber: va.registrationNumber || va.vehicleRegistrationNumber || '—',
            staffAllocationId:  sa.id,
            userName:           sa.userName,
            roleName:           sa.roleName,
            allocationStatus:   sa.allocationStatus,
            expectedStartDate:  sa.expectedStartDate,
          })
        })
    })
  })

  const unassignVehicle = useMutation({
    mutationFn: ({ orderId, allocationId }: { orderId: number; allocationId: number }) =>
      ordersApi.unassignVehicle(orderId, allocationId),
    onSuccess: () => {
      toast.success('Vehicle unassigned')
      qc.invalidateQueries({ queryKey: ['assignments-orders'] })
      qc.invalidateQueries({ queryKey: ['assignments-vehicles'] })
    },
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to unassign vehicle')
    },
  })

  const unassignDriver = useMutation({
    mutationFn: ({ orderId, staffAllocationId }: { orderId: number; staffAllocationId: number }) =>
      ordersApi.unassignStaff(orderId, staffAllocationId),
    onSuccess: () => {
      toast.success('Driver unassigned')
      qc.invalidateQueries({ queryKey: ['assignments-orders'] })
      qc.invalidateQueries({ queryKey: ['assignments-users'] })
    },
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to unassign driver')
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage vehicle and driver assignments for orders</p>
        </div>
        {tab === 'vehicle' ? (
          <Button onClick={() => setShowAddVehicle(true)}>
            <Plus size={16} className="mr-2" />
            Add Assignment
          </Button>
        ) : (
          <Button onClick={() => setShowAssignDriver(true)}>
            <Plus size={16} className="mr-2" />
            Assign Driver
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'vehicle', label: 'Vehicle Assignments', Icon: Truck,  count: vehicleRows.length },
          { key: 'driver',  label: 'Driver Assignments',  Icon: Users,  count: driverRows.length  },
        ] as const).map(({ key, label, Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-feros-orange text-feros-orange'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon size={16} />
            {label}
            <span className={cn(
              'ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium',
              tab === key ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Vehicle Assignments */}
      {tab === 'vehicle' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
          ) : vehicleRows.length === 0 ? (
            <div className="py-16 text-center">
              <Truck size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">No vehicle assignments yet</p>
              <p className="text-gray-400 text-xs mt-1">Click "Add Assignment" to assign a vehicle to an order</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Order', 'Client', 'Vehicle', 'Weight (T)', 'Load Date', 'Delivery Date', 'Status', 'Drivers', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicleRows.map(row => (
                    <tr key={row.allocationId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-feros-navy whitespace-nowrap">{row.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{row.clientName}</td>
                      <td className="px-4 py-3 font-medium">{row.registrationNumber}</td>
                      <td className="px-4 py-3 text-gray-700">{row.allocatedWeight}</td>
                      <td className="px-4 py-3 text-gray-500">{row.expectedLoadDate ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{row.expectedDeliveryDate ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[row.allocationStatus] ?? 'bg-gray-100 text-gray-600')}>
                          {row.allocationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.driversCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">
                            {row.driversCount} driver{row.driversCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">
                            No driver
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => unassignVehicle.mutate({ orderId: row.orderId, allocationId: row.allocationId })}
                          disabled={unassignVehicle.isPending}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Unassign vehicle"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Driver Assignments */}
      {tab === 'driver' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
          ) : driverRows.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">No driver assignments yet</p>
              <p className="text-gray-400 text-xs mt-1">Click "Assign Driver" to assign a driver to a vehicle</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Order', 'Vehicle', 'Driver', 'Role', 'Status', 'Start Date', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {driverRows.map(row => (
                    <tr key={row.staffAllocationId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-feros-navy whitespace-nowrap">{row.orderNumber}</td>
                      <td className="px-4 py-3 font-medium">{row.registrationNumber}</td>
                      <td className="px-4 py-3 text-gray-800">{row.userName}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{row.roleName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[row.allocationStatus] ?? 'bg-gray-100 text-gray-600')}>
                          {row.allocationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{row.expectedStartDate ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => unassignDriver.mutate({ orderId: row.orderId, staffAllocationId: row.staffAllocationId })}
                          disabled={unassignDriver.isPending}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Unassign driver"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <AddVehicleAssignmentDialog
        open={showAddVehicle}
        onClose={() => setShowAddVehicle(false)}
        orders={orders}
        vehicles={vehicles}
      />
      <AssignDriverDialog
        open={showAssignDriver}
        onClose={() => setShowAssignDriver(false)}
        orders={orders}
        drivers={drivers}
      />
    </div>
  )
}
