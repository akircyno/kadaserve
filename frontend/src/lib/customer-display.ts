export function formatNameFromEmail(email: string | null | undefined) {
  if (!email) return null;

  const name = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();

  if (!name) return null;

  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function maskCustomerName(
  name: string | null | undefined,
  fallback = "Customer"
) {
  const normalized = name?.trim().replace(/\s+/g, " ");

  if (!normalized) return fallback;

  const [firstName, ...rest] = normalized.split(" ");
  const initialSource = rest.at(-1) ?? firstName.slice(1);
  const initial = initialSource?.charAt(0).toUpperCase();

  return initial ? `${firstName} ${initial}.` : firstName;
}
