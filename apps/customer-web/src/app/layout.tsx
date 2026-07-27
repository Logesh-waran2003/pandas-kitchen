import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Pandas Kitchen",
  description: "Order delicious food from Pandas Kitchen",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
