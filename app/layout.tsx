import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Block X Bluster",
  description: "A fast-paced block shooting game where you destroy falling blocks and collect power-ups!",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
  openGraph: {
    title: "Block X Bluster",
    description: "A fast-paced block shooting game where you destroy falling blocks and collect power-ups!",
    url: "https://your-game-url.com",
    siteName: "Block X Bluster",
    images: [
      {
        url: "/images/game-preview.png", // You'll need to create this image
        width: 1200,
        height: 630,
        alt: "Block X Bluster gameplay preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Block X Bluster",
    description: "A fast-paced block shooting game where you destroy falling blocks and collect power-ups!",
    images: ["/images/game-preview.png"], // Same image as OG
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png" }],
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head />
      <body>{children}</body>
    </html>
  )
}


import './globals.css'