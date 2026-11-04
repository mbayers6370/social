/** Test-only guard: never let a regression runner reach application data. */
export function privateTestDatabaseUrl(value = process.env.DATABASE_URL): URL {
  const message = "Disposable runtime database required";
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error(message);
  }
  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "55432" ||
    !/^\/margin_slice_test_[a-f0-9]{32}$/.test(url.pathname) ||
    url.username !== "margin_runtime"
  )
    throw new Error(message);
  return url;
}
