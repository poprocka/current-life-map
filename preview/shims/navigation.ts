import { navigate, usePath } from "./router";
export function useRouter() { return { push: navigate, replace: navigate }; }
export function useSearchParams() {
  const p = usePath();
  return new URLSearchParams(p.includes("?") ? p.split("?")[1] : "");
}
