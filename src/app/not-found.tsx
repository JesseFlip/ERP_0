import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium text-emerald-700">404</p>
      <h1 className="text-2xl font-semibold text-neutral-900">Page not found</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        That page doesn&rsquo;t exist, or you don&rsquo;t have access to it.
      </p>
      <Link href="/dashboard" className={buttonVariants({})}>
        Back to dashboard
      </Link>
    </div>
  );
}
