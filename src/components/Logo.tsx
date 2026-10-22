export default function Logo({
  className = 'h-9 w-36',
}: {
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-white px-2 py-1 shadow-sm ${className}`}
    >
      <img
        src="/assets/image copy.png"
        alt="HOERBIGER"
        className="h-full w-full object-contain"
      />
    </div>
  );
}
