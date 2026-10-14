import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const positions = new Map<string, number>();

/** New pages open at the top; "back" restores the previous position. */
export default function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  useLayoutEffect(() => {
    const key = location.key;
    const save = () => positions.set(key, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });

    if (location.hash) return () => window.removeEventListener("scroll", save);

    const target = navType === "POP" ? positions.get(key) ?? 0 : 0;
    window.scrollTo(0, target);
    let tries = 0;
    let raf = 0;
    const retry = () => {
      if (Math.abs(window.scrollY - target) < 2 || tries++ > 40) return;
      window.scrollTo(0, target);
      raf = requestAnimationFrame(retry);
    };
    if (target > 0) raf = requestAnimationFrame(retry);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", save);
    };
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
