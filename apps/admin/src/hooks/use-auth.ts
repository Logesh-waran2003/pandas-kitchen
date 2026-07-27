"use client"

import { useAuthStore } from "@/stores/auth.store"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function useAuth() {
  const { user, accessToken, clearAuth } = useAuthStore()
  const router = useRouter()

  const isAuthenticated = !!accessToken && !!user

  function logout() {
    clearAuth()
    router.push("/login")
  }

  return { user, accessToken, isAuthenticated, logout }
}
