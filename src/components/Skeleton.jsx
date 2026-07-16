// Reusable skeleton loader components
export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded ${className}`} style={{ height: '1em' }} />;
}

export function MessageSkeleton() {
  return (
    <div className="flex justify-start animate-fade-in mb-4">
      <div className="max-w-[80%]">
        <div className="msg-ai">
          <Skeleton className="w-full h-4 mb-2" />
          <Skeleton className="w-3/4 h-4 mb-2" />
          <Skeleton className="w-1/2 h-4" />
        </div>
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="p-3 space-y-2">
      <Skeleton className="w-full h-9 mb-3" />
      <Skeleton className="w-full h-8 mb-2" />
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="w-full h-10" />
      ))}
    </div>
  );
}

export function DocListSkeleton() {
  return (
    <div className="p-3 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg-card)' }}>
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8" />
            <div className="flex-1">
              <Skeleton className="w-3/4 h-4 mb-1" />
              <Skeleton className="w-1/3 h-3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
