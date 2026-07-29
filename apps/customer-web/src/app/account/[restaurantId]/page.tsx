"use client"
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useCustomerAuthStore } from "@/stores/customer-auth.store"

export default function AccountPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const router = useRouter()
  const { setAuth, isLoggedIn } = useCustomerAuthStore()

  const [mode, setMode] = useState<"login" | "register">("login")

  // Shared fields
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")

  // Register-only fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Already logged in — redirect to menu
  useEffect(() => {
    if (isLoggedIn()) {
      router.replace(`/menu/${restaurantId}`)
    }
  }, [isLoggedIn, restaurantId, router])

  function clearForm() {
    setPhone("")
    setPassword("")
    setName("")
    setEmail("")
    setError("")
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (phone.length < 10) { setError("Enter a valid 10-digit phone number"); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }

    setLoading(true)
    try {
      const res = await apiFetch<{ token: string; customerId: string; firstName?: string; name?: string }>(
        `/customers/${restaurantId}/login`,
        {
          method: "POST",
          body: JSON.stringify({ phone, password }),
        }
      )
      setAuth({
        token: res.token,
        customerId: res.customerId,
        name: res.firstName ?? res.name ?? phone,
        phone,
        restaurantId,
      })
      router.push(`/menu/${restaurantId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed. Check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!name.trim()) { setError("Please enter your name"); return }
    if (phone.length < 10) { setError("Enter a valid 10-digit phone number"); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }

    setLoading(true)
    try {
      const body: Record<string, string> = { name: name.trim(), phone, password }
      if (email.trim()) body.email = email.trim()

      const res = await apiFetch<{ token: string; customerId: string; firstName?: string; name?: string }>(
        `/customers/${restaurantId}/register`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      )
      setAuth({
        token: res.token,
        customerId: res.customerId,
        name: res.firstName ?? res.name ?? name.trim(),
        phone,
        restaurantId,
      })
      router.push(`/menu/${restaurantId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">My Account</h1>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Logo */}
          <div className="bg-orange-500 px-6 py-8 text-center">
            <p className="text-4xl mb-1">🐼</p>
            <p className="text-white font-bold text-xl">Pandas Kitchen</p>
            <p className="text-orange-100 text-sm mt-1">
              {mode === "login" ? "Welcome back!" : "Create your account"}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => { setMode("login"); clearForm() }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                mode === "login"
                  ? "text-orange-600 border-b-2 border-orange-500"
                  : "text-gray-400"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setMode("register"); clearForm() }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                mode === "register"
                  ? "text-orange-600 border-b-2 border-orange-500"
                  : "text-gray-400"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={mode === "login" ? handleLogin : handleRegister}
            className="px-6 py-6 space-y-3"
          >
            {mode === "register" && (
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoComplete="name"
              />
            )}

            <input
              type="tel"
              placeholder="10-digit phone number"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoComplete="tel"
            />

            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {mode === "register" && (
              <input
                type="email"
                placeholder="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoComplete="email"
              />
            )}

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition-all text-white rounded-xl py-3 font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading
                ? mode === "login" ? "Signing in…" : "Creating account…"
                : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Guest checkout note */}
          <div className="px-6 pb-6 text-center">
            <button
              onClick={() => router.push(`/menu/${restaurantId}`)}
              className="text-xs text-gray-400 hover:text-orange-500 transition-colors"
            >
              Guest checkout? Just enter your details at checkout →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
