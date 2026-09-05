export type JobErrorKind =
  | "retryable"
  | "permanent";

export class ImageProcessingJobError extends Error {
  public readonly kind: JobErrorKind;

  public constructor(
    message: string,
    kind: JobErrorKind,
  ) {
    super(message);
    this.name = "ImageProcessingJobError";
    this.kind = kind;
  }
}

export function isRetryableJobError(error: unknown): boolean {
  return (
    error instanceof ImageProcessingJobError &&
    error.kind === "retryable"
  );
}