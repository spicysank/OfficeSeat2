import { Loader2 } from 'lucide-react';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
      <Spinner className="h-8 w-8 text-indigo-600" />
      {label && <p className="text-sm text-slate-500">{label}</p>}
    </div>
  );
}

export function CardSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner className="h-6 w-6 text-indigo-600" />
    </div>
  );
}
