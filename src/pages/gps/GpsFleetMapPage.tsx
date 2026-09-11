import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gpsTrackingApi, type GpsFleetItem } from '@/api/gpsTracking'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

// Top-down truck faces North (up) — GPS heading 0 = North, so no offset needed
function makeVehicleIcon(ignitionOn: boolean | null, isLive: boolean, heading: number | null) {
  const dot = !isLive ? '#9ca3af' : ignitionOn ? '#22c55e' : '#ef4444'
  const deg = heading ?? 0
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:40px;height:60px;">
      <img src="/tracking-truck.png" style="width:40px;height:60px;object-fit:contain;transform:rotate(${deg}deg);transform-origin:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));" />
      <span style="position:absolute;top:-3px;right:-3px;width:13px;height:13px;background:${dot};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.35);"></span>
    </div>`,
    iconSize: [40, 60],
    iconAnchor: [20, 60],
    popupAnchor: [0, -64],
  })
}

// Animates marker smoothly between GPS pings instead of jumping.
// stablePos ref never changes so react-leaflet won't call setLatLng — we own all updates.
function AnimatedMarker({ item, onNavigate }: { item: GpsFleetItem; onNavigate: (id: number) => void }) {
  const markerRef = useRef<L.Marker>(null)
  const rafRef    = useRef<number | null>(null)
  const currentPos = useRef<[number, number]>([Number(item.latitude), Number(item.longitude)])
  const stablePos  = useRef<[number, number]>(currentPos.current)

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return

    const from: [number, number] = [...currentPos.current]
    const to:   [number, number] = [Number(item.latitude), Number(item.longitude)]
    if (from[0] === to[0] && from[1] === to[1]) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const duration = 4000
    const t0 = performance.now()

    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1)
      const lat = from[0] + (to[0] - from[0]) * p
      const lng = from[1] + (to[1] - from[1]) * p
      currentPos.current = [lat, lng]
      marker!.setLatLng([lat, lng])
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [item.latitude, item.longitude])

  return (
    <Marker
      ref={markerRef}
      position={stablePos.current}
      icon={makeVehicleIcon(item.ignitionOn, item.isLive, item.heading)}
    >
      <Popup>
        <div className="text-sm">
          <p className="font-semibold">{item.registrationNumber}</p>
          <p className="text-gray-600 mt-1">
            Speed: {item.speedKmh != null ? `${Number(item.speedKmh).toFixed(0)} km/h` : '—'}
          </p>
          <p className="text-gray-600">Ignition: {item.ignitionOn ? 'ON' : 'OFF'}</p>
          <p className="text-gray-500 text-xs mt-1">{item.lastPingIst}</p>
          <button
            onClick={() => onNavigate(item.vehicleId)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            View vehicle →
          </button>
        </div>
      </Popup>
    </Marker>
  )
}

function VehicleCard({ item, onClick }: { item: GpsFleetItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">{item.registrationNumber}</p>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full font-medium',
          item.isLive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        )}>
          {item.isLive ? 'Live' : 'Last known'}
        </span>
      </div>
      <div className="flex gap-3 mt-1 text-xs text-gray-500">
        <span>{item.speedKmh != null ? `${Number(item.speedKmh).toFixed(0)} km/h` : '0 km/h'}</span>
        <span className={item.ignitionOn ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
          {item.ignitionOn ? 'ON' : 'OFF'}
        </span>
        <span>{item.lastPingIst}</span>
      </div>
      {item.odometer != null && (
        <p className="text-xs text-gray-400 mt-0.5">ODO: {Number(item.odometer).toFixed(1)} km</p>
      )}
    </button>
  )
}

export function GpsFleetMapPage() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['gps-fleet'],
    queryFn: () => gpsTrackingApi.getFleet(),
    refetchInterval: 30_000,
  })

  const fleet = data?.data ?? []
  const liveCount = fleet.filter(f => f.isLive).length

  // Map center: first vehicle with data, else Hyderabad
  const center: [number, number] = fleet.length > 0
    ? [Number(fleet[0].latitude), Number(fleet[0].longitude)]
    : [17.385, 78.4867]

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-4">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">Fleet Live Map</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {fleet.length} IoT vehicle{fleet.length !== 1 ? 's' : ''} · {liveCount} live
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-gray-400 p-4">Loading fleet…</p>
          ) : fleet.length === 0 ? (
            <div className="p-4">
              <p className="text-sm text-gray-500">No GPS data available.</p>
              <p className="text-xs text-gray-400 mt-1">Vehicles with IoT devices will appear here once they start pinging.</p>
            </div>
          ) : (
            fleet.map(item => (
              <VehicleCard
                key={item.vehicleId}
                item={item}
                onClick={() => navigate(`/vehicles/${item.vehicleId}`)}
              />
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 text-center">
          Auto-refreshes every 30s
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 rounded-xl overflow-hidden border border-gray-200">
        <MapContainer
          center={center}
          zoom={fleet.length > 0 ? 10 : 6}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {fleet.map(item => (
            <AnimatedMarker
              key={item.vehicleId}
              item={item}
              onNavigate={(id) => navigate(`/vehicles/${id}`)}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
