import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-7xl font-black text-brand/15">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-black/55">The page you are looking for has moved or no longer exists.</p>
      <Link href="/" className="button mt-6">
        Back to listings
      </Link>
    </div>
  );
}
