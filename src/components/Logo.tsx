export default function Logo({
  dark = false,
}: {
  dark?: boolean;
}) {
  return (
    <div className="flex min-w-max items-center gap-2.5">
      <div className="flex h-10 w-20 items-center justify-center rounded-lg bg-white px-1.5 py-1 shadow-sm">
        <img
          src="/assets/image copy.png"
          alt="HOERBIGER"
          className="h-full w-full object-contain"
        />
      </div>
      <span className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-navy-800'}`}>
        BookMy<span className="text-indigo-500">Seat</span>
      </span>
    </div>
  );
}
