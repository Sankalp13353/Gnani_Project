-- Migration: 20261109000000_add_multi_store_architecture
-- Step 1: Create the Store table
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "upiId" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- Create indexes on stores
CREATE UNIQUE INDEX "stores_phone_key" ON "stores"("phone");
CREATE INDEX "stores_phone_idx" ON "stores"("phone");
CREATE INDEX "stores_city_pincode_idx" ON "stores"("city", "pincode");

-- Step 2: Create one default demo store for the existing CallSaar catalogue
INSERT INTO "stores" (
    "id",
    "name",
    "ownerName",
    "phone",
    "passwordHash",
    "address",
    "city",
    "pincode",
    "upiId",
    "isOpen",
    "createdAt",
    "updatedAt"
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'CallSaar Kirana Store',
    'Ramesh Kumar',
    '9876543210',
    '$2b$10$placeholderForPhaseAImplementationOnly0000000000000',
    'Shop No. 4, Main Market, MG Road',
    'Bengaluru',
    '560001',
    'callsaar@upi',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;

-- Step 3: Add nullable storeId columns and isAvailable to Product and Order initially
ALTER TABLE "products" ADD COLUMN "storeId" TEXT;
ALTER TABLE "products" ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "orders" ADD COLUMN "storeId" TEXT;

-- Step 4: Backfill all existing Product and Order records with the default store ID
UPDATE "products" SET "storeId" = '00000000-0000-0000-0000-000000000001' WHERE "storeId" IS NULL;
UPDATE "orders" SET "storeId" = '00000000-0000-0000-0000-000000000001' WHERE "storeId" IS NULL;

-- Step 5 & 6: Enforce NOT NULL and foreign-key constraints
ALTER TABLE "products" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "products" ADD CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create store-scoped indexes on products and orders
CREATE INDEX "products_storeId_isActive_isAvailable_idx" ON "products"("storeId", "isActive", "isAvailable");
CREATE INDEX "products_storeId_name_idx" ON "products"("storeId", "name");
CREATE INDEX "orders_storeId_status_idx" ON "orders"("storeId", "status");

-- Step 7: Add payment enums and fields to orders with safe defaults
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_PICKUP', 'UPI_AT_STORE');

ALTER TABLE "orders" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "orders" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH_ON_PICKUP';
ALTER TABLE "orders" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "orders" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "readyAt" TIMESTAMP(3);
ALTER TABLE "orders" DROP COLUMN IF EXISTS "confirmedAt";

-- Step 8: Migrate OrderStatus safely
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING_APPROVAL', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED', 'REJECTED', 'CANCELLED');

ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING (
  CASE "status"::text
    WHEN 'PENDING_CONFIRMATION' THEN 'PENDING_APPROVAL'::"OrderStatus_new"
    WHEN 'CONFIRMED' THEN 'ACCEPTED'::"OrderStatus_new"
    WHEN 'PACKING' THEN 'PREPARING'::"OrderStatus_new"
    WHEN 'READY' THEN 'READY_FOR_PICKUP'::"OrderStatus_new"
    WHEN 'COMPLETED' THEN 'COMPLETED'::"OrderStatus_new"
    WHEN 'REJECTED' THEN 'REJECTED'::"OrderStatus_new"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"OrderStatus_new"
    ELSE 'PENDING_APPROVAL'::"OrderStatus_new"
  END
);

ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL'::"OrderStatus_new";

DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";

