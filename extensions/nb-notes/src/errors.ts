import { showToast, Toast } from "@vicinae/api";

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}

// Every command wraps nb calls in the same failure toast; centralize it so the
// title is the only thing each call site has to vary.
export async function showError(title: string, e: unknown): Promise<void> {
  await showToast({ style: Toast.Style.Failure, title, message: errorMessage(e) });
}
