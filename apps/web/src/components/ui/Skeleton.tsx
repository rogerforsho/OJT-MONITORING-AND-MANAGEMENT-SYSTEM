import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = 'h-4 w-full', count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-slate-200/80 rounded-lg ${className}`}
        />
      ))}
    </>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-3 p-4">
      <div className="flex gap-4 pb-2 border-b border-slate-100">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-200/90 rounded flex-1 animate-pulse" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-2.5 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3.5 bg-slate-100 rounded flex-1 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-3 animate-pulse">
          <div className="h-3 w-1/2 bg-slate-200 rounded" />
          <div className="h-7 w-3/4 bg-slate-300 rounded" />
          <div className="h-2.5 w-1/3 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  );
}
