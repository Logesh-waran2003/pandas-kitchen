"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuthStore } from "@/stores/auth.store"
import { toast } from "sonner"
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Table,
  BarChart3,
  Settings,
  LogOut,
  ShoppingCart,
  ChefHat,
  Users,
  Package,
  Clock,
} from "lucide-react"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/kitchen", label: "Kitchen", icon: ChefHat },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/shifts", label: "Shifts", icon: Clock },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/tables", label: "Tables", icon: Table },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
]

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname()

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐼</span>
          <span className="font-bold text-gray-900">Pandas Kitchen</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-orange-50 text-orange-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-200">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  )
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken, clearAuth } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login")
    }
  }, [accessToken, router])

  function handleLogout() {
    clearAuth()
    toast.success("Logged out")
    router.replace("/login")
  }

  if (!accessToken) return null

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar onLogout={handleLogout} />
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {navItems.find((n) => n.href === pathname)?.label ??
              (pathname === "/" ? "Dashboard" : pathname.replace("/", ""))}
          </h2>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <span className="text-sm text-gray-700">{user?.name}</span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
