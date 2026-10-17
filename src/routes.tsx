import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import {
  RedirectIfAuthenticated,
  RequireAdmin,
  RequireAuth,
  RequireSeller,
} from './components/Guards'
import { FullPageSpinner } from './components/States'
import { RootLayout } from './layouts/RootLayout'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProductPage } from './pages/ProductPage'
import { StorePage } from './pages/StorePage'

const DemoEntryPage = lazy(() =>
  import('./pages/DemoEntryPage').then((m) => ({ default: m.DemoEntryPage })),
)
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
const CartPage = lazy(() => import('./pages/CartPage').then((m) => ({ default: m.CartPage })))
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })),
)
const SellerLayout = lazy(() =>
  import('./layouts/SellerLayout').then((m) => ({ default: m.SellerLayout })),
)
const OpenStorePage = lazy(() =>
  import('./pages/seller/OpenStorePage').then((m) => ({ default: m.OpenStorePage })),
)
const ProductsPage = lazy(() =>
  import('./pages/seller/ProductsPage').then((m) => ({ default: m.ProductsPage })),
)
const ProductFormPage = lazy(() =>
  import('./pages/seller/ProductFormPage').then((m) => ({ default: m.ProductFormPage })),
)
const StoreSettingsPage = lazy(() =>
  import('./pages/seller/StoreSettingsPage').then((m) => ({ default: m.StoreSettingsPage })),
)
const ShippingPage = lazy(() =>
  import('./pages/seller/ShippingPage').then((m) => ({ default: m.ShippingPage })),
)
const CheckoutPage = lazy(() =>
  import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })),
)
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const OrderDetailPage = lazy(() =>
  import('./pages/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage })),
)
const SalesPage = lazy(() =>
  import('./pages/seller/SalesPage').then((m) => ({ default: m.SalesPage })),
)
const EarningsPage = lazy(() =>
  import('./pages/seller/EarningsPage').then((m) => ({ default: m.EarningsPage })),
)
const MessagesPage = lazy(() =>
  import('./pages/MessagesPage').then((m) => ({ default: m.MessagesPage })),
)
const SellerDisputesPage = lazy(() =>
  import('./pages/DisputesPage').then((m) => ({ default: m.SellerDisputesPage })),
)
const AdminDisputesPage = lazy(() =>
  import('./pages/DisputesPage').then((m) => ({ default: m.AdminDisputesPage })),
)
const AdminLayout = lazy(() =>
  import('./layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
const SellersPage = lazy(() =>
  import('./pages/admin/SellersPage').then((m) => ({ default: m.SellersPage })),
)
const AuditPage = lazy(() =>
  import('./pages/admin/AuditPage').then((m) => ({ default: m.AuditPage })),
)

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="p/:slug" element={<ProductPage />} />
          <Route path="t/:slug" element={<StorePage />} />
          <Route path="demo" element={<DemoEntryPage />} />

          <Route element={<RedirectIfAuthenticated />}>
            <Route path="entrar" element={<LoginPage />} />
            <Route path="crear-cuenta" element={<RegisterPage />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="cuenta" element={<AccountPage />} />
            <Route path="carrito" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="mensajes" element={<MessagesPage />} />
            <Route path="pedidos" element={<OrdersPage />} />
            <Route path="pedidos/:id" element={<OrderDetailPage />} />
            <Route path="vender" element={<OpenStorePage />} />
          </Route>

          <Route element={<RequireSeller />}>
            <Route path="panel" element={<SellerLayout />}>
              <Route index element={<ProductsPage />} />
              <Route path="tienda" element={<StoreSettingsPage />} />
              <Route path="ventas" element={<SalesPage />} />
              <Route path="aclaraciones" element={<SellerDisputesPage />} />
              <Route path="pagos" element={<EarningsPage />} />
              <Route path="envios" element={<ShippingPage />} />
              <Route path="productos/nuevo" element={<ProductFormPage />} />
              <Route path="productos/:id" element={<ProductFormPage />} />
            </Route>
          </Route>

          <Route element={<RequireAdmin />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<SellersPage />} />
              <Route path="aclaraciones" element={<AdminDisputesPage />} />
              <Route path="bitacora" element={<AuditPage />} />
            </Route>
          </Route>

          <Route path="no-encontrado" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
