import { useQuery } from '@tanstack/react-query'
import { gpsTrackingApi, type GpsFleetItem } from '@/api/gpsTracking'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

// Custom marker icon using divIcon — avoids webpack/vite default icon path issues
function makeVehicleIcon(ignitionOn: boolean | null, isLive: boolean) {
  const color = !isLive ? '#9ca3af' : ignitionOn ? '#22c55e' : '#ef4444'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50% 50% 50% 0;
      background:${color};border:2px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,.35);
      transform:rotate(-45deg);
    "></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  })
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
            <Marker
              key={item.vehicleId}
              position={[Number(item.latitude), Number(item.longitude)]}
              icon={makeVehicleIcon(item.ignitionOn, item.isLive)}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{item.registrationNumber}</p>
                  <p className="text-gray-600 mt-1">
                    Speed: {item.speedKmh != null ? `${Number(item.speedKmh).toFixed(0)} km/h` : '—'}
                  </p>
                  <p className="text-gray-600">
                    Ignition: {item.ignitionOn ? 'ON' : 'OFF'}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">{item.lastPingIst}</p>
                  <button
                    onClick={() => navigate(`/vehicles/${item.vehicleId}`)}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    View vehicle →
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
