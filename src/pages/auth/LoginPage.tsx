import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ferosLogo from '@/assets/feros_transperant_logo.png'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const schema = z.object({
  phone: z.string().min(10, 'Enter a valid mobile number'),
  pin:   z.string().length(4, 'PIN must be 4 digits'),
})
type FormData = z.infer<typeof schema>

export function LoginPage() {
  const [loading, setLoading] = useState(false)
  const login = useAuthStore(s => s.login)
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await authApi.login(data)
      if (res.success && res.data) {
        const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'OFFICE_STAFF', 'SUPERVISOR']
        if (!allowedRoles.includes(res.data.role)) {
          toast.error('Access denied. Please use the FEROS mobile app.')
          return
        }
        login(res.data)
        navigate('/', { replace: true })
      } else {
        toast.error(res.message ?? 'Login failed')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {/* Mobile logo */}
      <div className="lg:hidden text-center mb-8">
        <img src={ferosLogo} alt="FEROS" className="h-12 w-auto object-contain mx-auto" />
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-7">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="text-gray-400 text-sm mt-1">Sign in to your FEROS account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-gray-700 font-medium">Mobile Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="9876543210"
              inputMode="numeric"
              {...register('phone')}
              className={`h-11 ${errors.phone ? 'border-red-500 focus-visible:ring-red-200' : ''}`}
            />
            {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin" className="text-gray-700 font-medium">PIN</Label>
            <Input
              id="pin"
              type="password"
              placeholder="••••"
              maxLength={4}
              inputMode="numeric"
              {...register('pin')}
              className={`h-11 tracking-widest ${errors.pin ? 'border-red-500 focus-visible:ring-red-200' : ''}`}
            />
            {errors.pin && <p className="text-red-500 text-xs">{errors.pin.message}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 text-sm font-semibold mt-1"
            style={{ backgroundColor: '#1E293B' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
