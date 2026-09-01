export interface AdminCredentials {
  email: string;
  password: string;
  name: string;
}

export function adminCredentials(): AdminCredentials {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = (process.env.ADMIN_NAME ?? "Admin").trim() || "Admin";

  if (!email || !email.includes("@")) {
    throw new Error("ADMIN_EMAIL is not configured");
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  return { email, password, name };
}
