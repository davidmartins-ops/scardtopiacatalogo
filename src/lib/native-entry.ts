// Navigation convenience only: AdminRoute still validates access server-side.
export function nativeStartPath(isNative: boolean): string | null {
  return isNative ? "/admin" : null;
}