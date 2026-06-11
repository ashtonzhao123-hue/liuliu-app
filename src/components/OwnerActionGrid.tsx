import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface OwnerAction {
  label: string;
  description: string;
  path: string;
  icon: ReactNode;
}

interface OwnerActionGridProps {
  actions: OwnerAction[];
}

export function OwnerActionGrid({ actions }: OwnerActionGridProps) {
  const navigate = useNavigate();

  return (
    <div className="owner-action-grid">
      {actions.map((action) => (
        <button key={action.path} className="owner-action" type="button" onClick={() => navigate(action.path)}>
          <span className="owner-action__icon">{action.icon}</span>
          <span className="owner-action__label">{action.label}</span>
          <span className={`owner-action__desc ${action.description.startsWith('0') ? 'is-empty-count' : ''}`}>{action.description}</span>
        </button>
      ))}
    </div>
  );
}
