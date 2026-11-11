import type { Doc, SlideData } from '../types';

export function collectDocImageIds(doc: Doc, ids = new Set<string>()): Set<string> {
  for (const el of doc.elements) {
    if (el.kind !== 'image') continue;
    ids.add(el.imageId);
    if (el.cutFrom?.imageId) ids.add(el.cutFrom.imageId);
  }
  return ids;
}

export function collectAllImageIds(slides: SlideData[]): Set<string> {
  const ids = new Set<string>();
  for (const slide of slides) collectDocImageIds(slide.doc, ids);
  return ids;
}

export function reconcileAllSlides(
  slides: SlideData[],
  availableIds: Set<string>,
): SlideData[] {
  return slides.map((slide) => ({
    ...slide,
    doc: {
      ...slide.doc,
      elements: slide.doc.elements.filter(
        (el) => el.kind !== 'image' || availableIds.has(el.imageId),
      ),
    },
  }));
}
