import { Button } from 'antd-mobile';
import type { ReactNode } from 'react';

interface FriendlyEmptyProps {
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export function FriendlyEmpty({
  title,
  description,
  actionText,
  onAction,
  icon = <img className="friendly-empty__image" src="/song-login-reference.jpg" alt="" />
}: FriendlyEmptyProps) {
  return (
    <section className="friendly-empty">
      <div className="friendly-empty__icon" aria-hidden="true">
        {icon}
      </div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {actionText && onAction ? (
        <Button color="primary" onClick={onAction}>
          {actionText}
        </Button>
      ) : null}
    </section>
  );
}
