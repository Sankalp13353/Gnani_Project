-- AlterTable: Add idempotencyKey, payloadHash, and confirmationTokenHash to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payloadHash" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmationTokenHash" TEXT;

-- CreateIndex: Composite unique constraint on (storeId, idempotencyKey)
CREATE UNIQUE INDEX IF NOT EXISTS "orders_storeId_idempotencyKey_key" ON "orders"("storeId", "idempotencyKey");

