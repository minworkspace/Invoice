import "server-only";

export function localRedirect(path: string, status = 303) {
  const location = path.startsWith("/") && !path.startsWith("//") ? path : "/";

  return new Response(null, {
    status,
    headers: {
      Location: location
    }
  });
}

export function safeReturnPath(value: string | null, fallback: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
