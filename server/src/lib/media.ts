import { Exercise } from "@prisma/client";

export function exerciseMediaUrl(relativePath: string): string {
  const base = process.env.EXERCISE_MEDIA_BASE_URL ?? "";
  return `${base.replace(/\/$/, "")}/${relativePath.replace(/^\//, "")}`;
}

/** Replaces the stored relative `image`/`gifUrl` paths with absolute media URLs for API responses. */
export function withExerciseMediaUrls<T extends Pick<Exercise, "image" | "gifUrl">>(
  exercise: T
): Omit<T, "image" | "gifUrl"> & { imageUrl: string; gifUrl: string } {
  const { image, gifUrl, ...rest } = exercise;
  return {
    ...rest,
    imageUrl: exerciseMediaUrl(image),
    gifUrl: exerciseMediaUrl(gifUrl),
  };
}
