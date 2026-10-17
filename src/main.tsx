import { I18nProvider, RouterProvider } from '@heroui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useHref, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppRoutes } from './routes'
import { useAuth } from './stores/auth'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function HeroUIRouterBridge({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      {children}
    </RouterProvider>
  )
}

void useAuth.getState().bootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <HeroUIRouterBridge>
          <I18nProvider locale="es-MX">
            <AppRoutes />
            <Toaster position="bottom-right" richColors closeButton />
          </I18nProvider>
        </HeroUIRouterBridge>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
