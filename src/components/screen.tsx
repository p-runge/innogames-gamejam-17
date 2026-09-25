import { cn } from "~/lib/cn";

export default function Screen({ className }: { className: string }) {
  return (
    <div className={cn("h-full w-full bg-gray-600", className)}>
      {/* TODO: Add content here */}
    </div>
  );
}
