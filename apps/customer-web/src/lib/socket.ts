import type { Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket(token?: string): Socket {
  if (typeof window === "undefined") {
    throw new Error("Socket.io cannot be used on the server side")
  }
  if (!socket) {
    // Dynamic import to prevent SSR issues
    const { io } = require("socket.io-client")
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      auth: token ? { token } : {},
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: false,
    })
  }
  return socket
}

export function connectSocket(token?: string): Socket {
  const s = getSocket(token)
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  if (typeof window === "undefined") return
  socket?.disconnect()
  socket = null
}
