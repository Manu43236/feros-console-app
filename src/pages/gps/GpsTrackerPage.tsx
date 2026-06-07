import { useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Settings, RefreshCw, MapPin, Truck, Zap, Square, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { gpsApi } from '@/api/gps'
import type { GpsFleetVehicle, GpsVehicleStatus } from '@/types'
import truckSvgRaw from '@/assets/map-truck.svg?raw'

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<GpsVehicleStatus, { color: string; fill: string; label: string; icon: React.ElementType }> = {
  MOVING:  { color: '#16a34a', fill: '#22c55e', label: 'Moving',  icon: Truck },
  IDLE:    { color: '#ca8a04', fill: '#eab308', label: 'Idle',    icon: Zap },
  STOPPED: { color: '#dc2626', fill: '#ef4444', label: 'Stopped', icon: Square },
  OFFLINE: { color: '#6b7280', fill: '#9ca3af', label: 'Offline', icon: WifiOff },
}

// ─── Truck map icon ────────────────────────────────────────────────────────────
function createTruckIcon(color: string, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 40 : 30
  const svg = truckSvgRaw
    .replace('fill="#000000"', `fill="${color}"`)
    .replace('width="800px"', `width="${size}px"`)
    .replace('height="800px"', `height="${size}px"`)
  const shadow = isSelected
    ? 'filter:drop-shadow(0 0 5px rgba(0,0,0,0.55));'
    : 'filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35));'
  return L.divIcon({
    html: `<div style="${shadow}">${svg}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

// ─── Auto-fit bounds when vehicles load ────────────────────────────────────────
function FitBounds({ vehicles }: { vehicles: GpsFleetVehicle[] }) {
  const map = useMap()
  const fitted = useRef(false)

  const positioned = vehicles.filter(v => v.latitude != null && v.longitude != null)
  if (positioned.length > 0 && !fitted.current) {
    fitted.current = true
    const lats = positioned.map(v => v.latitude!)
    const lngs = positioned.map(v => v.longitude!)
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [40, 40], maxZoom: 13 }
    )
  }
  return null
}

// ─── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ status, count, active, onClick }: {
  status: GpsVehicleStatus
  count: number
  active: boolean
  onClick: () => void
}) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all shrink-0',
        active ? 'border-transparent text-white shadow-sm' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
      )}
      style={active ? { backgroundColor: cfg.color } : {}}
    >
      <Icon size={14} />
      <span>{cfg.label}</span>
      <span className={cn('font-bold', active ? 'text-white' : 'text-gray-900')}>{count}</span>
    </button>
  )
}

// ─── Format last updated ────────────────────────────────────────────────────────
function formatLastSeen(ts: string | null) {
  if (!ts) return 'Unknown'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

// ─── Provider label ────────────────────────────────────────────────────────────
function providerLabel(type: string) {
  return type === 'TATA_FLEET_EDGE' ? 'TATA Fleet Edge'
    : type === 'BLACKBUCK' ? 'Blackbuck'
    : type === 'VAMOSYS' ? 'Vamosys'
    : type === 'FLEETX' ? 'Fleetx'
    : type
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function GpsTrackerPage() {
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState<GpsVehicleStatus | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const markerRefs = useRef<Record<number, L.Marker>>({} as Record<number, L.Marker>)

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['gps-fleet'],
    queryFn: () => gpsApi.getFleet().then(r => r.data ?? []),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev, // keep previous data while refetching — prevents map from unmounting
  })

  // If the latest response is empty but we had vehicles before, keep showing the last known data
  const lastKnownVehicles = useRef<GpsFleetVehicle[]>([])
  const vehicles = useMemo(() => {
    const current = data ?? []
    if (current.length > 0) lastKnownVehicles.current = current
    return lastKnownVehicles.current
  }, [data])
  const filtered = filterStatus ? vehicles.filter(v => v.gpsStatus === filterStatus) : vehicles
  const positioned = filtered.filter(v => v.latitude != null && v.longitude != null)

  const counts = {
    MOVING:  vehicles.filter(v => v.gpsStatus === 'MOVING').length,
    IDLE:    vehicles.filter(v => v.gpsStatus === 'IDLE').length,
    STOPPED: vehicles.filter(v => v.gpsStatus === 'STOPPED').length,
    OFFLINE: vehicles.filter(v => v.gpsStatus === 'OFFLINE').length,
  }

  function handleRowClick(v: GpsFleetVehicle) {
    setSelectedId(v.vehicleId)
    const marker = markerRefs.current[v.vehicleId]
    if (marker) marker.openPopup()
  }

  return (
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* ── Map (80%) ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        {/* Top-right controls overlay */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-500 border border-gray-200 shadow-sm">
            {vehicles.length} IoT vehicles
            {dataUpdatedAt > 0 && (
              <span className="ml-2 text-gray-400">· {formatLastSeen(new Date(dataUpdatedAt).toISOString())}</span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="bg-white/90 backdrop-blur-sm shadow-sm h-8"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={13} className={cn(isFetching && 'animate-spin')} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white/90 backdrop-blur-sm shadow-sm h-8"
            onClick={() => navigate('/gps/settings')}
          >
            <Settings size={13} className="mr-1" />
            Settings
          </Button>
        </div>

        {isLoading ? (
          <div className="h-full flex items-center justify-center bg-gray-100">
            <div className="text-center text-gray-500">
              <MapPin size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Loading fleet locations...</p>
            </div>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="h-full flex items-center justify-center bg-gray-100">
            <div className="text-center text-gray-500">
              <MapPin size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No GPS vehicles configured</p>
              <p className="text-xs mt-1">Go to Settings to connect your GPS provider</p>
              <Button size="sm" className="mt-3" onClick={() => navigate('/gps/settings')}>
                Configure GPS
              </Button>
            </div>
          </div>
        ) : (
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            className="h-full w-full"
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <FitBounds vehicles={positioned} />
            {positioned.map(v => {
              const cfg = STATUS_CONFIG[v.gpsStatus]
              const isSelected = selectedId === v.vehicleId
              return (
                <Marker
                  key={v.vehicleId}
                  position={[v.latitude!, v.longitude!]}
                  icon={createTruckIcon(cfg.fill, isSelected)}
                  ref={el => { if (el) markerRefs.current[v.vehicleId] = el }}
                  eventHandlers={{ click: () => setSelectedId(v.vehicleId) }}
                >
                  <Popup>
                    <div className="min-w-[160px]">
                      <p className="font-semibold text-gray-900">{v.registrationNumber}</p>
                      {v.driverName && <p className="text-xs text-gray-500 mt-0.5">{v.driverName}</p>}
                      <div className="mt-2 space-y-1 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>Status</span>
                          <span className="font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Speed</span>
                          <span className="font-medium">{v.speedKmh != null ? `${v.speedKmh.toFixed(0)} km/h` : '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last seen</span>
                          <span className="font-medium">{formatLastSeen(v.lastUpdatedAt)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Provider</span>
                          <span className="font-medium">{providerLabel(v.providerType)}</span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        )}
      </div>

      {/* ── Data strip (20%) ───────────────────────────────────────────────────── */}
      <div className="h-52 shrink-0 bg-white border-t border-gray-200 flex gap-0 overflow-hidden">

        {/* Summary cards */}
        <div className="shrink-0 w-56 flex flex-col justify-center gap-2 px-4 border-r border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fleet</span>
            <Badge variant="secondary" className="text-xs">{vehicles.length} total</Badge>
          </div>
          {(['MOVING', 'IDLE', 'STOPPED', 'OFFLINE'] as GpsVehicleStatus[]).map(status => (
            <SummaryCard
              key={status}
              status={status}
              count={counts[status]}
              active={filterStatus === status}
              onClick={() => setFilterStatus(f => f === status ? null : status)}
            />
          ))}
        </div>

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Driver</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Speed</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-xs">
                    {filterStatus ? `No ${STATUS_CONFIG[filterStatus].label.toLowerCase()} vehicles` : 'No vehicles'}
                  </td>
                </tr>
              ) : (
                filtered.map(v => {
                  const cfg = STATUS_CONFIG[v.gpsStatus]
                  const isSelected = selectedId === v.vehicleId
                  return (
                    <tr
                      key={v.vehicleId}
                      onClick={() => handleRowClick(v)}
                      className={cn(
                        'border-b border-gray-100 cursor-pointer transition-colors',
                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      )}
                    >
                      <td className="px-4 py-2 font-medium text-gray-900">{v.registrationNumber}</td>
                      <td className="px-4 py-2 text-gray-600">{v.driverName ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {v.speedKmh != null ? `${v.speedKmh.toFixed(0)} km/h` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: cfg.fill + '25', color: cfg.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.fill }} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{formatLastSeen(v.lastUpdatedAt)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
