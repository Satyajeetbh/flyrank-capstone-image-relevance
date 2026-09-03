/**
 * Image understanding output after validation at an application boundary.
 * Subject and category are intentionally provider-neutral strings; category
 * values are controlled by the current application contract, not an ontology.
 */
export type ImageSubject = string;
export type ImageCategory = string;

export interface ImageMetadata {
  subject: ImageSubject;
  category: ImageCategory;
  attributes: string[];
  caption: string;
  confidence: number;
}
