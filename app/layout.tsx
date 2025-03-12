import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Private Files — 2XBCEXXXX",
  description: "No one is gonna delete this one.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
