import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminGuard } from './components/AdminGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NetworkBanner } from './components/NetworkBanner';
import { UpdatePrompt } from './components/UpdatePrompt';
import { LoginPage } from './pages/auth/LoginPage';
import { RoleSelectPage } from './pages/auth/RoleSelectPage';
import { OwnerHomePage } from './pages/owner/OwnerHomePage';
import { WalkerHomePage } from './pages/walker/WalkerHomePage';
import { useAppStore } from './stores/useAppStore';

const AddressFormPage = lazy(() => import('./pages/owner/AddressFormPage').then((module) => ({ default: module.AddressFormPage })));
const AddressListPage = lazy(() => import('./pages/owner/AddressListPage').then((module) => ({ default: module.AddressListPage })));
const AdminHomePage = lazy(() => import('./pages/admin/AdminHomePage').then((module) => ({ default: module.AdminHomePage })));
const ComplaintPage = lazy(() => import('./pages/owner/ComplaintPage').then((module) => ({ default: module.ComplaintPage })));
const ConfirmOrderPage = lazy(() => import('./pages/owner/ConfirmOrderPage').then((module) => ({ default: module.ConfirmOrderPage })));
const CreateOrderPage = lazy(() => import('./pages/owner/CreateOrderPage').then((module) => ({ default: module.CreateOrderPage })));
const LiveOrderPage = lazy(() => import('./pages/owner/LiveOrderPage').then((module) => ({ default: module.LiveOrderPage })));
const OrderDetailPage = lazy(() => import('./pages/owner/OrderDetailPage').then((module) => ({ default: module.OrderDetailPage })));
const OrderListPage = lazy(() => import('./pages/owner/OrderListPage').then((module) => ({ default: module.OrderListPage })));
const OwnerProfilePage = lazy(() => import('./pages/owner/OwnerProfilePage').then((module) => ({ default: module.OwnerProfilePage })));
const PetFormPage = lazy(() => import('./pages/owner/PetFormPage').then((module) => ({ default: module.PetFormPage })));
const PetListPage = lazy(() => import('./pages/owner/PetListPage').then((module) => ({ default: module.PetListPage })));
const ReviewPage = lazy(() => import('./pages/owner/ReviewPage').then((module) => ({ default: module.ReviewPage })));
const WalkerArrivePage = lazy(() => import('./pages/walker/WalkerArrivePage').then((module) => ({ default: module.WalkerArrivePage })));
const WalkerFinishPage = lazy(() => import('./pages/walker/WalkerFinishPage').then((module) => ({ default: module.WalkerFinishPage })));
const WalkerGoPage = lazy(() => import('./pages/walker/WalkerGoPage').then((module) => ({ default: module.WalkerGoPage })));
const WalkerHistoryPage = lazy(() => import('./pages/walker/WalkerHistoryPage').then((module) => ({ default: module.WalkerHistoryPage })));
const WalkerLivePage = lazy(() => import('./pages/walker/WalkerLivePage').then((module) => ({ default: module.WalkerLivePage })));
const WalkerOrderDetailPage = lazy(() => import('./pages/walker/WalkerOrderDetailPage').then((module) => ({ default: module.WalkerOrderDetailPage })));
const WalkerProfilePage = lazy(() => import('./pages/walker/WalkerProfilePage').then((module) => ({ default: module.WalkerProfilePage })));

export function App() {
  const hydrateAuth = useAppStore((state) => state.hydrateAuth);

  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);

  return (
    <ErrorBoundary>
      <NetworkBanner />
      <UpdatePrompt />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<PublicOnlyRoute element={<LoginPage />} />} />
          <Route path="/role-select" element={<ProtectedRoute element={<RoleSelectPage />} allowUnselectedRole />} />
          <Route path="/owner" element={<ProtectedRoute element={<OwnerHomePage />} />} />
          <Route path="/owner/pets" element={<ProtectedRoute element={<PetListPage />} />} />
          <Route path="/owner/pets/new" element={<ProtectedRoute element={<PetFormPage />} />} />
          <Route path="/owner/pets/:id/edit" element={<ProtectedRoute element={<PetFormPage />} />} />
          <Route path="/owner/addresses" element={<ProtectedRoute element={<AddressListPage />} />} />
          <Route path="/owner/addresses/new" element={<ProtectedRoute element={<AddressFormPage />} />} />
          <Route path="/owner/addresses/:id/edit" element={<ProtectedRoute element={<AddressFormPage />} />} />
          <Route path="/owner/orders/new" element={<ProtectedRoute element={<CreateOrderPage />} />} />
          <Route path="/owner/orders" element={<ProtectedRoute element={<OrderListPage />} />} />
          <Route path="/owner/orders/:id" element={<ProtectedRoute element={<OrderDetailPage />} />} />
          <Route path="/owner/orders/:id/live" element={<ProtectedRoute element={<LiveOrderPage />} />} />
          <Route path="/owner/orders/:id/confirm" element={<ProtectedRoute element={<ConfirmOrderPage />} />} />
          <Route path="/owner/orders/:id/review" element={<ProtectedRoute element={<ReviewPage />} />} />
          <Route path="/owner/orders/:id/complaint" element={<ProtectedRoute element={<ComplaintPage />} />} />
          <Route path="/owner/profile" element={<ProtectedRoute element={<OwnerProfilePage />} />} />
          <Route path="/walker" element={<ProtectedRoute element={<WalkerHomePage />} />} />
          <Route path="/walker/orders/:id" element={<ProtectedRoute element={<WalkerOrderDetailPage />} />} />
          <Route path="/walker/orders/:id/go" element={<ProtectedRoute element={<WalkerGoPage />} />} />
          <Route path="/walker/orders/:id/arrive" element={<ProtectedRoute element={<WalkerArrivePage />} />} />
          <Route path="/walker/orders/:id/live" element={<ProtectedRoute element={<WalkerLivePage />} />} />
          <Route path="/walker/orders/:id/finish" element={<ProtectedRoute element={<WalkerFinishPage />} />} />
          <Route path="/walker/history" element={<ProtectedRoute element={<WalkerHistoryPage />} />} />
          <Route path="/walker/profile" element={<ProtectedRoute element={<WalkerProfilePage />} />} />
          <Route path="/admin" element={<AdminGuard><AdminHomePage /></AdminGuard>} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function RootRedirect() {
  return <Navigate to={getNextPath()} replace />;
}

function PublicOnlyRoute({ element }: { element: ReactNode }) {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const isAuthReady = useAppStore((state) => state.isAuthReady);

  if (!isAuthReady) {
    return <RouteLoading />;
  }

  if (isAuthenticated) {
    return <Navigate to={getNextPath()} replace />;
  }

  return element;
}

function ProtectedRoute({
  element,
  allowUnselectedRole = false
}: {
  element: ReactNode;
  allowUnselectedRole?: boolean;
}) {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const hasSelectedRole = useAppStore((state) => state.hasSelectedRole);
  const isAuthReady = useAppStore((state) => state.isAuthReady);

  if (!isAuthReady) {
    return <RouteLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasSelectedRole && !allowUnselectedRole) {
    return <Navigate to="/role-select" replace />;
  }

  if (hasSelectedRole && allowUnselectedRole) {
    return <Navigate to={getNextPath()} replace />;
  }

  return element;
}

function RouteLoading() {
  return (
    <div className="page-shell">
      <main className="page-body">
        <div className="skeleton-list"><span /><span /><span /></div>
      </main>
    </div>
  );
}

function getNextPath(): string {
  const { isAuthenticated, hasSelectedRole, roleMode } = useAppStore.getState();

  if (!isAuthenticated) {
    return '/login';
  }

  if (!hasSelectedRole) {
    return '/role-select';
  }

  return roleMode === 'walker' ? '/walker' : '/owner';
}
