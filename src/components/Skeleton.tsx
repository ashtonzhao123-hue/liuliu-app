interface SkeletonBaseProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

function sizeStyle({ width, height }: SkeletonBaseProps) {
  return {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height
  };
}

export function SkeletonText({ width = '100%', height = 14, className = '' }: SkeletonBaseProps) {
  return <span className={`skeleton skeleton-text ${className}`} style={sizeStyle({ width, height })} />;
}

export function SkeletonAvatar({ width = 56, height = 56, className = '' }: SkeletonBaseProps) {
  return <span className={`skeleton skeleton-avatar ${className}`} style={sizeStyle({ width, height })} />;
}

export function SkeletonImage({ width = '100%', height = 160, className = '' }: SkeletonBaseProps) {
  return <span className={`skeleton skeleton-image ${className}`} style={sizeStyle({ width, height })} />;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-card ${className}`} aria-hidden="true">
      <SkeletonAvatar />
      <div className="skeleton-card__body">
        <SkeletonText width="68%" />
        <SkeletonText width="92%" />
        <SkeletonText width="44%" />
      </div>
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="section-stack" aria-hidden="true">
      <SkeletonCard />
      <SkeletonImage height={120} />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
