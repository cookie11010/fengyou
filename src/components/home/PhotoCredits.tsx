import { Container } from "@/components/ui/Container";
import type { Photo } from "@/types/content";

/** CC licences require crediting each photo's author and licence. */
export function PhotoCredits({ photos, title }: { photos: Photo[]; title: string }) {
  const unique = [...new Map(photos.map((p) => [p.src, p])).values()];
  return (
    <Container className="pb-10">
      <details className="text-xs text-muted">
        <summary className="cursor-pointer py-2">{title}</summary>
        <ul className="mt-2 space-y-1">
          {unique.map(({ src, credit }) => (
            <li key={src}>
              <a href={credit.sourceUrl} className="underline hover:text-brand-700" rel="noopener" target="_blank">
                {credit.author}
              </a>{" "}
              · {credit.license} · Wikimedia Commons
            </li>
          ))}
        </ul>
      </details>
    </Container>
  );
}
