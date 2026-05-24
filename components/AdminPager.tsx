import Link from "next/link";

export function AdminPager({
  basePath,
  page,
  pages,
  params
}: {
  basePath: string;
  page: number;
  pages: number;
  params: Record<string, string | undefined>;
}) {
  const linkFor = (nextPage: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    search.set("page", String(nextPage));
    return `${basePath}?${search.toString()}`;
  };

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Link className="btn btn-secondary h-9" href={linkFor(Math.max(1, page - 1))}>
          Previous
        </Link>
        <Link className="btn btn-secondary h-9" href={linkFor(Math.min(pages, page + 1))}>
          Next
        </Link>
      </div>
    </div>
  );
}
