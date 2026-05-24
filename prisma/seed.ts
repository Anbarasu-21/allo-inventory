// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up
  await prisma.reservation.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Create warehouses
  const warehouseA = await prisma.warehouse.create({
    data: {
      id: "wh-mumbai",
      name: "Mumbai Central",
      location: "Mumbai, MH",
    },
  });

  const warehouseB = await prisma.warehouse.create({
    data: {
      id: "wh-delhi",
      name: "Delhi North",
      location: "New Delhi, DL",
    },
  });

  const warehouseC = await prisma.warehouse.create({
    data: {
      id: "wh-bangalore",
      name: "Bangalore Tech Park",
      location: "Bengaluru, KA",
    },
  });

  console.log("✅ Warehouses created");

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        id: "prod-001",
        name: "Wireless Noise-Cancelling Headphones",
        description:
          "Premium over-ear headphones with 40-hour battery and adaptive ANC",
        sku: "WH-ANC-001",
        price: 8999,
        imageUrl:
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod-002",
        name: "Mechanical Keyboard TKL",
        description:
          "Tenkeyless mechanical keyboard with Cherry MX switches and RGB backlight",
        sku: "KB-TKL-002",
        price: 5499,
        imageUrl:
          "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod-003",
        name: "27\" 4K Monitor",
        description: "IPS panel, 144Hz refresh rate, HDR400 support",
        sku: "MON-4K-003",
        price: 32999,
        imageUrl:
          "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod-004",
        name: "Ergonomic Office Chair",
        description:
          "Lumbar support, adjustable armrests, breathable mesh back",
        sku: "CH-ERG-004",
        price: 18999,
        imageUrl:
          "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=400",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod-005",
        name: "USB-C Hub 10-in-1",
        description:
          "4K HDMI, 100W PD, SD card reader, 3x USB-A, ethernet",
        sku: "HUB-10-005",
        price: 3499,
        imageUrl:
          "https://images.unsplash.com/photo-1625945329888-7f7ad48e04f4?w=400",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod-006",
        name: "Portable SSD 1TB",
        description: "USB 3.2 Gen 2, up to 1050 MB/s read, shock-resistant",
        sku: "SSD-1TB-006",
        price: 7499,
        imageUrl:
          "https://images.unsplash.com/photo-1601445638532-3b6313b0caef?w=400",
      },
    }),
  ]);

  console.log(`✅ ${products.length} products created`);

  // Create stock levels
  const stockData = [
    // Headphones
    { productId: "prod-001", warehouseId: "wh-mumbai", totalUnits: 15 },
    { productId: "prod-001", warehouseId: "wh-delhi", totalUnits: 8 },
    { productId: "prod-001", warehouseId: "wh-bangalore", totalUnits: 1 }, // Low stock edge case

    // Keyboard
    { productId: "prod-002", warehouseId: "wh-mumbai", totalUnits: 25 },
    { productId: "prod-002", warehouseId: "wh-bangalore", totalUnits: 10 },

    // Monitor
    { productId: "prod-003", warehouseId: "wh-delhi", totalUnits: 5 },
    { productId: "prod-003", warehouseId: "wh-bangalore", totalUnits: 3 },

    // Chair
    { productId: "prod-004", warehouseId: "wh-mumbai", totalUnits: 20 },
    { productId: "prod-004", warehouseId: "wh-delhi", totalUnits: 12 },

    // Hub
    { productId: "prod-005", warehouseId: "wh-mumbai", totalUnits: 50 },
    { productId: "prod-005", warehouseId: "wh-delhi", totalUnits: 30 },
    { productId: "prod-005", warehouseId: "wh-bangalore", totalUnits: 20 },

    // SSD
    { productId: "prod-006", warehouseId: "wh-mumbai", totalUnits: 40 },
    { productId: "prod-006", warehouseId: "wh-bangalore", totalUnits: 15 },
  ];

  await prisma.stockLevel.createMany({ data: stockData });
  console.log(`✅ ${stockData.length} stock levels created`);

  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
