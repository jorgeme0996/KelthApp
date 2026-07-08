import { prisma } from "../prisma";
import exercises from "../data/exercises/exercises.json";

interface RawExercise {
  id: string;
  name: { es: string };
  body_part: string;
  equipment: string;
  instructions: { es: string };
  instruction_steps: { es: string[] };
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  image: string;
  gif_url: string;
  attribution: string;
}

async function main() {
  const list = exercises as unknown as RawExercise[];
  console.log(`Seeding ${list.length} exercises...`);

  for (const ex of list) {
    const data = {
      name: ex.name.es,
      bodyPart: ex.body_part,
      equipment: ex.equipment,
      instructions: ex.instructions.es,
      instructionSteps: ex.instruction_steps.es,
      muscleGroup: ex.muscle_group,
      secondaryMuscles: ex.secondary_muscles,
      target: ex.target,
      image: ex.image,
      gifUrl: ex.gif_url,
      attribution: ex.attribution,
    };
    await prisma.exercise.upsert({
      where: { id: ex.id },
      create: { id: ex.id, ...data },
      update: data,
    });
  }

  console.log("Seed de ejercicios completado.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
