import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleProducts = [
  {
    name: 'Aashirvaad Atta',
    brand: 'Aashirvaad',
    category: 'Staples & Grains',
    unit: 'kg',
    price: 55.00,
    description: 'Whole wheat flour for soft and nutritious rotis',
    isActive: true,
  },
  {
    name: 'Amul Taaza Milk',
    brand: 'Amul',
    category: 'Dairy',
    unit: '500ml',
    price: 28.00,
    description: 'Fresh homogenised toned milk pouch',
    isActive: true,
  },
  {
    name: 'Tata Salt',
    brand: 'Tata',
    category: 'Staples & Spices',
    unit: '1kg',
    price: 25.00,
    description: 'Desh Ka Namak - Vacuum evaporated iodised salt',
    isActive: true,
  },
  {
    name: 'Sugar',
    brand: 'Generic',
    category: 'Staples & Sweeteners',
    unit: 'kg',
    price: 45.00,
    description: 'Clean refined white crystal sugar',
    isActive: true,
  },
  {
    name: 'Fortune Sunflower Oil',
    brand: 'Fortune',
    category: 'Edible Oils',
    unit: 'litre',
    price: 150.00,
    description: 'Refined sunflower cooking oil pouch',
    isActive: true,
  },
  {
    name: 'Maggi Noodles',
    brand: 'Nestle Maggi',
    category: 'Instant Food & Snacks',
    unit: 'packet',
    price: 15.00,
    description: '2-Minute instant masala noodles 70g',
    isActive: true,
  },
  {
    name: 'Parle-G Biscuits',
    brand: 'Parle',
    category: 'Biscuits & Cookies',
    unit: 'packet',
    price: 10.00,
    description: 'Original glucose biscuits for tea time',
    isActive: true,
  },
  {
    name: 'Amul Butter',
    brand: 'Amul',
    category: 'Dairy',
    unit: '100g',
    price: 60.00,
    description: 'Pasteurised salted table butter pack',
    isActive: true,
  },
];

async function seed() {
  console.log('Seeding OrderSaathi multi-store database and catalogue...');

  // 1. Seed or update the default demo store
  const defaultStore = await prisma.store.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {
      name: 'OrderSaathi Local Store',
      ownerName: 'Ramesh Kumar',
      phone: '9876543210',
      address: 'Shop No. 4, Main Market, MG Road',
      city: 'Bengaluru',
      pincode: '560001',
      upiId: 'ordersaathi@upi',
      isOpen: true,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'OrderSaathi Local Store',
      ownerName: 'Ramesh Kumar',
      phone: '9876543210',
      passwordHash: '$2b$10$placeholderForPhaseAImplementationOnly0000000000000',
      address: 'Shop No. 4, Main Market, MG Road',
      city: 'Bengaluru',
      pincode: '560001',
      upiId: 'ordersaathi@upi',
      isOpen: true,
    },
  });
  console.log(`Default store verified: ${defaultStore.name} (${defaultStore.id})`);

  // 2. Seed catalogue products attached to the default store
  for (const item of sampleProducts) {
    const existing = await prisma.product.findFirst({
      where: {
        name: item.name,
        storeId: defaultStore.id,
      },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          brand: item.brand,
          category: item.category,
          unit: item.unit,
          price: item.price,
          description: item.description,
          isActive: item.isActive,
          isAvailable: true,
        },
      });
      console.log(`Updated existing product: ${item.name} (${item.unit} @ ₹${item.price})`);
    } else {
      await prisma.product.create({
        data: {
          ...item,
          storeId: defaultStore.id,
          isAvailable: true,
        },
      });
      console.log(`Created product: ${item.name} (${item.unit} @ ₹${item.price})`);
    }
  }

  const totalStores = await prisma.store.count();
  const totalCount = await prisma.product.count();
  console.log(`Seeding completed. Total stores: ${totalStores}, Total products: ${totalCount}`);
}

seed()
  .catch((e) => {
    console.error('Failed to seed database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

