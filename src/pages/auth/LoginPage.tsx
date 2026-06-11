import { useState, useEffect } from 'react'
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
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  pin:   z.string().length(4, 'PIN must be 4 digits'),
})
type FormData = z.infer<typeof schema>

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function LoginPage() {
  const [loading, setLoading]         = useState(false)
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [askingAdmin, setAskingAdmin] = useState(false)
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const login    = useAuthStore(s => s.login)
  const navigate = useNavigate()

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Countdown timer
  useEffect(() => {
    if (!lockedUntil) return
    const update = () => {
      const diff = Math.max(0, Math.floor((lockedUntil.getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
      if (diff === 0) setLockedUntil(null)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await authApi.login({ ...data, deviceType: 'WEB' })
      if (res.success && res.data) {
        login(res.data)
        navigate('/', { replace: true })
      } else {
        toast.error(res.message ?? 'Login failed')
      }
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { message?: string; data?: { lockedUntil?: string; failedAttempts?: number } } } })?.response?.data
      if (errData?.message === 'ACCOUNT_LOCKED' && errData?.data?.lockedUntil) {
        setLockedUntil(new Date(errData.data.lockedUntil))
        setAttemptsUsed(0)
      } else if (errData?.data?.failedAttempts !== undefined) {
        setAttemptsUsed(errData.data.failedAttempts)
        toast.error(errData.message ?? 'Invalid mobile number or PIN')
      } else {
        toast.error(errData?.message ?? 'Something went wrong')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleAskAdmin() {
    const phone = getValues('phone')
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      toast.error('Please enter your mobile number above first')
      return
    }
    setAskingAdmin(true)
    try {
      await authApi.askPinReset(phone)
      toast.success('Request sent! Your admin has been notified.')
    } catch {
      toast.error('Could not send request. Please try again.')
    } finally {
      setAskingAdmin(false)
    }
  }

  const isLocked = lockedUntil !== null && secondsLeft > 0

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

        {/* Lockout banner */}
        {isLocked && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 text-center">
            <p className="text-red-700 font-semibold text-sm">Account temporarily locked</p>
            <p className="text-red-500 text-xs">Too many incorrect PIN attempts. Try again in</p>
            <div className="text-3xl font-bold text-red-600 tracking-widest">
              {formatCountdown(secondsLeft)}
            </div>
            <p className="text-gray-500 text-xs">or ask your admin to reset your PIN</p>
            <Button
              type="button"
              variant="outline"
              className="w-full border-red-300 text-red-600 hover:bg-red-50 text-sm"
              disabled={askingAdmin}
              onClick={handleAskAdmin}
            >
              {askingAdmin ? 'Sending request…' : 'Ask admin to reset PIN'}
            </Button>
          </div>
        )}

        {/* Attempts warning */}
        {attemptsUsed >= 3 && !isLocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
            <span className="text-2xl font-bold text-amber-600 tabular-nums leading-none">{attemptsUsed}/5</span>
            <div>
              <p className="text-amber-700 text-sm font-medium">Incorrect PIN</p>
              <p className="text-amber-600 text-xs">{5 - attemptsUsed} attempt{5 - attemptsUsed !== 1 ? 's' : ''} left before account is locked</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" autoComplete="off">
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-gray-700 font-medium">Mobile Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="9876543210"
              inputMode="numeric"
              maxLength={10}
              autoComplete="off"
              disabled={isLocked}
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
              autoComplete="new-password"
              disabled={isLocked}
              {...register('pin')}
              className={`h-11 tracking-widest ${errors.pin ? 'border-red-500 focus-visible:ring-red-200' : ''}`}
            />
            {errors.pin && <p className="text-red-500 text-xs">{errors.pin.message}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading || isLocked}
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
