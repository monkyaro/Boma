import Link from "next/link";
import { Logo } from "./Header";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-black/[0.06] bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-black/55">
            Property for sale and rent across Tanzania. Every inquiry, viewing and negotiation is guided by an authorized BOMA officer.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Find a property</p>
          <ul className="mt-3 space-y-2 text-sm text-black/55">
            <li><Link href="/?listing_type=sale" className="hover:text-brand">Buy</Link></li>
            <li><Link href="/?listing_type=rent" className="hover:text-brand">Rent</Link></li>
            <li><Link href="/?listing_type=short_stay" className="hover:text-brand">Short stays</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Owners</p>
          <ul className="mt-3 space-y-2 text-sm text-black/55">
            <li><Link href="/dashboard?tab=owner" className="hover:text-brand">Become an owner</Link></li>
            <li><Link href="/dashboard/listings/new" className="hover:text-brand">List a property</Link></li>
            <li><Link href="/dashboard" className="hover:text-brand">My workspace</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-black/[0.06] py-5 text-center text-xs text-black/45">
        BOMA · Property. People. Possibility.
      </div>
    </footer>
  );
}
