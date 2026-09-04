import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { cn } from "@workspace/ui/lib/utils"
import { Providers } from "@/components/providers"
import { SiteShell } from "@/components/site-shell"
import { getServerLocale } from "@/lib/i18n/server"
import { m } from "@/lib/paraglide/messages"
import { getTextDirection } from "@/lib/paraglide/runtime"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()

  return {
    title: m.app_name({}, { locale }),
    description: m.home_lede({}, { locale }),
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getServerLocale()

  return (
    <html
      lang={locale}
      dir={getTextDirection(locale)}
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body>
        <Providers>
          <SiteShell locale={locale}>{children}</SiteShell>
        </Providers>
      </body>
    </html>
  )
}
