import type { ReactNode } from 'react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function TopBar({ title, subtitle, action }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar__main">
        <h1 className="top-bar__title">{title}</h1>
        {subtitle ? <p className="top-bar__subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="top-bar__action">{action}</div> : null}
    </header>
  );
}
