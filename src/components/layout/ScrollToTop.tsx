import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    const scroll = () => {
      const main = document.querySelector("main");
      if (main) {
        (main as HTMLElement).scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    requestAnimationFrame(scroll);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
