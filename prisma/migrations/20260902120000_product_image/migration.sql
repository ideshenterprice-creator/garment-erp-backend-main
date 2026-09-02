-- Product catalog image stored in private Supabase Storage.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imagePath" TEXT;
