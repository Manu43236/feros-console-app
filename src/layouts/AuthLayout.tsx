export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — FEROS branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-feros-navy flex-col justify-between p-12">
        <div>
          <span className="text-feros-orange font-bold text-3xl tracking-tight">FEROS</span>
        </div>
        <div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            Fleet. Managed.
          </h1>
          <p className="text-blue-200 text-lg">
            End-to-end fleet operations — from orders to payroll, all in one place.
          </p>
        </div>
        <p className="text-blue-300 text-sm">© {new Date().getFullYear()} FEROS. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
