"use client";

// Uploads photos into the signed-in user's own folder ('<user id>/<uuid>.<ext>').
// Storage policies refuse any other folder, and the database checks that a
// story or spot only uses photos from its author's folder.
//   'story-images' → photos on stories (stories.images)
//   'media'        → spot cover photos (public.media)
import type { SupabaseClient } from "@supabase/supabase-js";

export type Bucket = "story-images" | "media";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // the story-images bucket's limit
export const STORY_MAX_PHOTOS = 3; // same as the stories_images_check constraint

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type ImageProblem = "type" | "size";

/** Returns what's wrong with the file, or null if it can be uploaded. */
export function checkImage(file: File): ImageProblem | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size > IMAGE_MAX_BYTES) return "size";
  return null;
}

/** Resolves to the storage path to save in the database. Throws on failure. */
export async function uploadImage(supabase: SupabaseClient, bucket: Bucket, userId: string, file: File): Promise<string> {
  const problem = checkImage(file);
  if (problem) throw new Error(problem === "type" ? "Unsupported image type" : "Image is too large");
  const path = `${userId}/${crypto.randomUUID()}.${EXT[file.type]}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000", // file names are unique, so they never change
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Best effort: removes uploaded files that ended up unused. */
export async function removeImages(supabase: SupabaseClient, bucket: Bucket, paths: (string | null | undefined)[]) {
  const real = paths.filter((p): p is string => !!p);
  if (real.length) await supabase.storage.from(bucket).remove(real);
}
