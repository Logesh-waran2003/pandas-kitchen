import { io, Socket } from "socket.io-client"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

let socket: Socket | null = null

export function getSocket(token: string): Socket {
  if (socket?.connected) return socket

  socket = io(API_BASE, {
    auth: { token },
    transports: ["websocket"],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
