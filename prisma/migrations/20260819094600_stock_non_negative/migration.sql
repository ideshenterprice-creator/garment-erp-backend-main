-- Enforce stock can never go below 0 at the database level
ALTER TABLE "Stock" ADD CONSTRAINT "stock_quantity_non_negative" CHECK ("quantity" >= 0);
