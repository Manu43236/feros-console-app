import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
      <div className="space-y-8">
        {/* Mobile logo */}
        <div className="lg:hidden text-center">
          <span className="text-feros-navy font-bold text-3xl tracking-tight">FEROS</span>
          <p className="text-gray-500 text-sm mt-1">Fleet. Managed.</p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="text-gray-500 text-sm mt-1">Sign in to your FEROS account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="9876543210"
              inputMode="numeric"
              {...register('phone')}
              className={errors.phone ? 'border-red-500' : ''}
            />
            {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              type="password"
              placeholder="••••"
              maxLength={4}
              inputMode="numeric"
              {...register('pin')}
              className={errors.pin ? 'border-red-500' : ''}
            />
            {errors.pin && <p className="text-red-500 text-xs">{errors.pin.message}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-feros-navy hover:bg-feros-navy/90 text-white h-11"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
