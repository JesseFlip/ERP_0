import { InvoiceComposer } from "./invoice-composer";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { jobId } = await searchParams;
  return <InvoiceComposer jobId={jobId} />;
}
