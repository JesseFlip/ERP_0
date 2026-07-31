import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { QueueList } from "./queue-list";

export default function QueuePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Uninvoiced queue</h1>
          <p className="text-sm text-neutral-500">
            Jobs marked done but not yet billed, oldest first. Nothing leaves this list except by
            invoicing it or dismissing it with a reason.
          </p>
        </div>
        <Link href="/queue/new" className={buttonVariants({})}>
          Log a finished job
        </Link>
      </div>
      <QueueList />
    </div>
  );
}
