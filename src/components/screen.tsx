import { cn } from "~/utils/cn";

export default function Screen({ className }: { className: string }) {
  return (
    <div className={cn("w-full h-full m-auto bg-gray-600", className)}>
      {/* TODO: Add content here */}
    </div>
  );
}
