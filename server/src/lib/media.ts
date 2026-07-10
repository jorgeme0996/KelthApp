import { Exercise } from "@prisma/client";

export function exerciseMediaUrl(relativePath: string): string {
  const base = process.env.EXERCISE_MEDIA_BASE_URL ?? "";
  return `${base.replace(/\/$/, "")}/${relativePath.replace(/^\//, "")}`;
}

/** Replaces the stored relative `image`/`gifUrl` paths with absolute media URLs for API responses.
 * AI-generated exercises have no real media yet, so `image`/`gifUrl` may be null. */
export function withExerciseMediaUrls<T extends Pick<Exercise, "image" | "gifUrl">>(
  exercise: T
): Omit<T, "image" | "gifUrl"> & { imageUrl: string | null; gifUrl: string | null } {
  const { image, gifUrl, ...rest } = exercise;
  return {
    ...rest,
    imageUrl: image ? exerciseMediaUrl(image) : null,
    gifUrl: gifUrl ? exerciseMediaUrl(gifUrl) : null,
  };
}
