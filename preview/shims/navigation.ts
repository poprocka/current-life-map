import { navigate, usePath } from "./router";
export function useRouter() { return { push: navigate, replace: navigate, refresh: () => undefined }; }
export function useSearchParams() {
  const p = usePath();
  return new URLSearchParams(p.includes("?") ? p.split("?")[1] : "");
}
export function redirect(to: string) { navigate(to); }
export function notFound() { navigate("/admin"); }
export function usePathname() { return usePath().split("?")[0]; }
