import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'

export function SessionDisplacedModal() {
  const sessionDisplaced = useAuthStore((s) => s.sessionDisplaced)
  const setSessionDisplaced = useAuthStore((s) => s.setSessionDisplaced)
  const navigate = useNavigate()

  if (!sessionDisplaced) return null

  const handleOk = () => {
    setSessionDisplaced(false)
    navigate('/login', { replace: true })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Signed in elsewhere</h2>
        <p className="text-sm text-gray-600 mb-6">
          Your account has been signed in on another device. You have been signed out from this session.
        </p>
        <button
          onClick={handleOk}
          className="w-full bg-feros-navy text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          OK, take me to login
        </button>
      </div>
    </div>
  )
}
