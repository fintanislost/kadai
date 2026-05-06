interface Props {
  className?: string;
}

export function Skeleton({ className = 'h-4 w-32' }: Props) {
  return <div className={`skeleton animate-shimmer rounded ${className}`} />;
}

export function SkeletonStack({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
