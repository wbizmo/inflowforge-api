import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "node:crypto";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function main() {
  const plainApiKey = "iff_dev_test_key_123456789";

  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo-workspace" },
    update: {},
    create: {
      name: "Demo Workspace",
      slug: "demo-workspace",
    },
  });

  await prisma.apiKey.upsert({
    where: { keyHash: hashKey(plainApiKey) },
    update: {},
    create: {
      name: "Development Test Key",
      keyHash: hashKey(plainApiKey),
      keyPrefix: "iff_dev",
      workspaceId: workspace.id,
    },
  });

  console.log("Seed completed.");
  console.log("Test API Key:", plainApiKey);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });