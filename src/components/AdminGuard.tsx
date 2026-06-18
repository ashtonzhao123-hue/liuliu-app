import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AdminGuard({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return;
      setIsAdmin(user?.app_metadata?.role === 'admin');
      setChecking(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="auth-subtitle">验证管理员身份中...</p>
        </section>
      </main>
    );
  }

  if (!isAdmin) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
