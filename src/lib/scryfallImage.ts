/**
 * Cards store Scryfall's "normal" art (488×680) — right for a board full of
 * thumbnails, soft when blown up full screen and the wrong shape for a banner.
 *
 * Scryfall's CDN serves every size from the same path with only the leading
 * segment swapped:
 *   https://cards.scryfall.io/normal/front/9/1/<id>.jpg?<ts>
 *   https://cards.scryfall.io/large/front/9/1/<id>.jpg?<ts>
 *   https://cards.scryfall.io/art_crop/front/9/1/<id>.jpg?<ts>
 *
 * So we can derive a variant on the client instead of storing several URLs per
 * card. Anything that doesn't match the expected shape is returned untouched,
 * and <img> consumers should fall back to the original on error.
 */

const SCRYFALL_IMAGE = /^(https:\/\/cards\.scryfall\.io\/)([a-z_]+)(\/.+)$/;

export type ImageVariant = "small" | "normal" | "large" | "png" | "art_crop";

export function imageVariant(
  url: string | undefined,
  variant: ImageVariant,
): string | undefined {
  if (!url) return undefined;
  const match = url.match(SCRYFALL_IMAGE);
  if (!match) return url;

  // png lives under a .png extension; the rest are .jpg.
  const path =
    variant === "png"
      ? match[3].replace(/\.jpg(\?|$)/, ".png$1")
      : match[3].replace(/\.png(\?|$)/, ".jpg$1");

  return `${match[1]}${variant}${path}`;
}
