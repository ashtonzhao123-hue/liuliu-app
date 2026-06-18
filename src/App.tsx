import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminGuard } from './components/AdminGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdminHomePage } from './pages/admin/AdminHomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { RoleSelectPage } from './pages/auth/RoleSelectPage';
import { AddressFormPage } from './pages/owner/AddressFormPage';
import { AddressListPage } from './pages/owner/AddressListPage';
import { ComplaintPage } from './pages/owner/ComplaintPage';
import { ConfirmOrderPage } from './pages/owner/ConfirmOrderPage';
import { CreateOrderPage } from './pages/owner/CreateOrderPage';
import { LiveOrderPage } from './pages/owner/LiveOrderPage';
import { OrderDetailPage } from './pages/owner/OrderDetailPage';
import { OrderListPage } from './pages/owner/OrderListPage';
import { OwnerHomePage } from './pages/owner/OwnerHomePage';
import { OwnerProfilePage } from './pages/owner/OwnerProfilePage';
import { PetFormPage } from './pages/owner/PetFormPage';
import { PetListPage } from './pages/owner/PetListPage';
import { ReviewPage } from './pages/owner/ReviewPage';
import { WalkerArrivePage } from './pages/walker/WalkerArrivePage';
import { WalkerFinishPage } from './pages/walker/WalkerFinishPage';
import { WalkerGoPage } from './pages/walker/WalkerGoPage';
import { WalkerHistoryPage } from './pages/walker/WalkerHistoryPage';
import { WalkerHomePage } from './pages/walker/WalkerHomePage';
import { WalkerLivePage } from './pages/walker/WalkerLivePage';
import { WalkerOrderDetailPage } from './pages/walker/WalkerOrderDetailPage';
import { WalkerProfilePage } from './pages/walker/WalkerProfilePage';
import { useAppStore } from './stores/useAppStore';

export function App() {
  const hydrateAuth = useAppStore((state) => state.hydrateAuth);

  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);

  return (
    <ErrorBoundary>
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
    <main className="auth-page">
      <section className="auth-panel">
        <div className="song-dog-mark song-dog-mark--small" aria-hidden="true">
          <img src="/song-login-reference.jpg" alt="" />
        </div>
        <p className="auth-subtitle">正在铺开画卷...</p>
      </section>
    </main>
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
