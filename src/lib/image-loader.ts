"use client";

// next/image loader. For Wikimedia Commons originals, return a Commons
// thumbnail URL. Commons only serves a fixed set of widths, so we round up to
// the nearest one. Any other src (e.g. /images/foo.jpg in public/) is returned as is.

const COMMONS = "https://upload.wikimedia.org/wikipedia/commons/";
const COMMONS_WIDTHS = [250, 330, 500, 960, 1280, 1920];

export default function imageLoader({ src, width }: { src: string; width: number }) {
  if (!src.startsWith(COMMONS) || src.includes("/thumb/")) return src;

  const path = src.slice(COMMONS.length); // "a/ab/File_name.jpg"
  const fileName = path.split("/").pop();
  const w = COMMONS_WIDTHS.find((cw) => cw >= width) ?? COMMONS_WIDTHS.at(-1);
  return `${COMMONS}thumb/${path}/${w}px-${fileName}`;
}
