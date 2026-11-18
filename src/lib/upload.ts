"use client";

// Uploads a photo to the public 'media' bucket, into the signed-in user's own
// folder ('<user id>/<random name>'). Storage policies refuse any other folder.
import type { SupabaseClient } from "@supabase/supabase-js";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // bucket allows 20 MB; photos don't need more than 10

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export type ImageProblem = "type" | "size";

/** Returns what's wrong with the file, or null if it can be uploaded. */
export function checkImage(file: File): ImageProblem | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size > IMAGE_MAX_BYTES) return "size";
  return null;
}

/** Resolves to the storage path to save in the database. Throws on failure. */
export async function uploadImage(supabase: SupabaseClient, userId: string, file: File): Promise<string> {
  const problem = checkImage(file);
  if (problem) throw new Error(problem === "type" ? "Unsupported image type" : "Image is too large");
  const path = `${userId}/${crypto.randomUUID()}.${EXT[file.type]}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000", // file names are unique, so they never change
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Best effort: removes an uploaded file that ended up unused. */
export async function removeImage(supabase: SupabaseClient, path: string | null | undefined) {
  if (path) await supabase.storage.from("media").remove([path]);
}
