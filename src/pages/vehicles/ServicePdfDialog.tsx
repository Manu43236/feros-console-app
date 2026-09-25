import { Spinner } from '@/components/ui/loader'
import { useQuery } from '@tanstack/react-query'
import { PDFViewer } from '@react-pdf/renderer'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { vehicleServicesApi } from '@/api/vehicles'
import { useAuthStore } from '@/store/authStore'
import { ServiceDoc } from './ServicePdfPage'

/** Renders the service cost-estimate PDF inside a modal instead of a new tab. */
export function ServicePdfDialog({ serviceId, onClose }: { serviceId: number | null; onClose: () => void }) {
  const logoUrl = useAuthStore(s => s.logoUrl)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['vehicle-service', serviceId],
    queryFn: () => vehicleServicesApi.getById(serviceId!),
    enabled: serviceId != null,
  })

  return (
    <Dialog open={serviceId != null} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Service PDF Report</DialogTitle>
        {isLoading && <div className="flex items-center justify-center h-full text-gray-500 text-sm"><Spinner /></div>}
        {(isError || (data && !data.data)) && (
          <div className="flex items-center justify-center h-full text-red-500 text-sm">Service not found</div>
        )}
        {data?.data && (
          <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
            <ServiceDoc s={data.data} tenantLogoUrl={logoUrl} />
          </PDFViewer>
        )}
      </DialogContent>
    </Dialog>
  )
}
