export function formatPrice(price: string | number, currency = "TZS"): string {
  const amount = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function listingTypeLabel(type: string): string {
  if (type === "short_stay") return "Short stay";
  return type === "rent" ? "For rent" : "For sale";
}
