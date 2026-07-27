import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐼</div>
          <h1 className="text-3xl font-bold text-gray-900">Pandas Kitchen</h1>
          <p className="text-gray-500 mt-1">Sign in to your dashboard</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
