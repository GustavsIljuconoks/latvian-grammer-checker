import type { NavigateFunction } from "react-router";

export function goTo(url: string, navigate: NavigateFunction): void {
  if (url.startsWith("http")) window.location.href = url;
  else navigate(url);
}
