import { Armchair } from 'lucide-react';

export default function Logo({
  className = 'h-9 w-9',
  iconClass = 'h-5 w-5',
  showText = true,
}: {
  className?: string;
  iconClass?: string;
  showText?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex ${className} items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-navy-700 text-white shadow-md`}
      >
        <Armchair className={iconClass} />
      </div>
      {showText && (
        <span className="text-lg font-bold tracking-tight text-navy-300">
          BookMy<span className="text-indigo-600">Seat</span>
        </span>
      )}
    </div>
  );
}
