/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { followAppearance } from '@/lib/appearance'
import { DaemonProvider } from '@/lib/daemon-context'
import { NotFoundScreen } from '@/components/not-found-screen'
import { useAppHeight } from '@/hooks/use-app-height'
import { RuntimeProvider } from '@/lib/runtime-context'
import appCss from '@/styles.css?url'

const TITLE = 'Waku Web'
const DESCRIPTION =
  'Connect securely to a Waku daemon and continue your coding-agent tasks from the browser.'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'format-detection', content: 'telephone=no' },
      { name: 'apple-mobile-web-app-title', content: 'Waku' },
      {
        name: 'theme-color',
        media: '(prefers-color-scheme: light)',
        content: '#f7f7f6',
      },
      {
        name: 'theme-color',
        media: '(prefers-color-scheme: dark)',
        content: '#191a1a',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon.png' },
    ],
    scripts: [
      {
        children: `try{var d=document.documentElement,p=localStorage.getItem('waku.theme'),s=matchMedia('(prefers-color-scheme: dark)').matches,x=p==='dark'||p!=='light'&&s,l=localStorage.getItem('waku.language'),n=(navigator.languages&&navigator.languages[0]||navigator.language||'en').replaceAll('_','-').toLowerCase(),r=l==='zh-CN'||l==='ja'||l==='en'?l:n==='zh-cn'||n==='zh-sg'||n.startsWith('zh-hans')?'zh-CN':n==='ja'||n.startsWith('ja-')?'ja':'en';d.classList.toggle('dark',x);d.classList.toggle('light',!x);d.lang=r}catch(e){}`,
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundScreen,
})

function RootComponent() {
  useAppHeight()
  useFollowAppearance()

  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function useFollowAppearance() {
  useEffect(() => followAppearance(
    document,
    window.localStorage,
    window.matchMedia('(prefers-color-scheme: dark)'),
    window,
  ), [])
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <DaemonProvider>
          <RuntimeProvider>{children}</RuntimeProvider>
        </DaemonProvider>
        <Toaster position="top-center" richColors closeButton />
        <Scripts />
      </body>
    </html>
  )
}
