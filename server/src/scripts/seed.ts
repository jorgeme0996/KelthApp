import { prisma } from "../prisma";
import recipes from "../data/recipes/lowcarb-mexicano.json";

async function main() {
  console.log(`Seeding ${recipes.length} recipes...`);

  for (const recipe of recipes) {
    const { id, ...rest } = recipe as typeof recipe & { id: string };
    await prisma.recipe.upsert({
      where: { id },
      create: { id, ...rest },
      update: { ...rest },
    });
  }

  console.log("Seed completado.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
