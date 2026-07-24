export default function Skeleton({ count = 3, type = 'text' }) {
  if (type === 'card') {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="skeleton-text w-3/4" />
            <div className="skeleton-text w-1/2" />
            <div className="skeleton-text w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full skeleton shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton-text w-3/4" />
            <div className="skeleton-text w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
