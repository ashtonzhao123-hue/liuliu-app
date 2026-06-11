import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { TopBar } from './TopBar';

interface PageContainerProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  showBottomNav?: boolean;
  action?: ReactNode;
}

export function PageContainer({
  title,
  subtitle,
  children,
  showBottomNav = true,
  action
}: PageContainerProps) {
  return (
    <div className="page-shell">
      <TopBar title={title} subtitle={subtitle} action={action} />
      <main className="page-content">{children}</main>
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
}
