import { Children, type ReactNode } from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';
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
  const contentRef = useScrollReveal<HTMLElement>();
  const revealedChildren = Children.map(children, (child) => (
    <div className="reveal-item" data-reveal>
      {child}
    </div>
  ));

  return (
    <div className="page-shell">
      <TopBar title={title} subtitle={subtitle} action={action} />
      <main ref={contentRef} className="page-content reveal-stack">{revealedChildren}</main>
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
}
