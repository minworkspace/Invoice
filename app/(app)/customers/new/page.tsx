import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { sanitizeNullablePhoneDisplay } from "@/lib/document-text";
import { formString, nullableString } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

async function createCustomerAction(formData: FormData) {
  "use server";
  const user = await requireUser();

  const customer = await prisma.customer.create({
    data: {
      companyId: user.companyId,
      name: formString(formData, "name"),
      email: nullableString(formData, "email"),
      phone: sanitizeNullablePhoneDisplay(formData.get("phone")),
      whatsapp: sanitizeNullablePhoneDisplay(formData.get("whatsapp")),
      address: nullableString(formData, "address")
    }
  });

  redirect(`/customers/${customer.id}`);
}

export default async function NewCustomerPage() {
  await requireUser();

  return (
    <>
      <PageHeader title="New customer" eyebrow="Contacts" />
      <CustomerForm action={createCustomerAction} submitLabel="Create customer" />
    </>
  );
}

function CustomerForm({
  action,
  submitLabel,
  initial
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  initial?: { name?: string; email?: string | null; phone?: string | null; whatsapp?: string | null; address?: string | null };
}) {
  return (
    <form action={action} className="panel grid gap-4 lg:grid-cols-2">
      <label>
        <span className="label">Name</span>
        <input className="field" name="name" defaultValue={initial?.name || ""} required />
      </label>
      <label>
        <span className="label">Email</span>
        <input className="field" name="email" type="email" defaultValue={initial?.email || ""} />
      </label>
      <label>
        <span className="label">Phone</span>
        <input className="field" name="phone" defaultValue={initial?.phone || ""} />
      </label>
      <label>
        <span className="label">WhatsApp</span>
        <input className="field" name="whatsapp" defaultValue={initial?.whatsapp || ""} />
      </label>
      <label className="lg:col-span-2">
        <span className="label">Address</span>
        <textarea className="field min-h-28" name="address" defaultValue={initial?.address || ""} />
      </label>
      <div className="lg:col-span-2 flex justify-end">
        <button className="btn btn-primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
