import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const GO_MAP = {
  d: "/",
  m: "/map",
  e: "/expeditions",
  c: "/cargo",
  i: "/inventory",
  p: "/personnel",
  x: "/emergency",
};

export function useKeyboardShortcuts({ onOpenCommandPalette }) {
  const navigate = useNavigate();
  const pendingGRef = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenCommandPalette();
        return;
      }

      if (isTyping) return;

      if (pendingGRef.current) {
        pendingGRef.current = false;
        clearTimeout(timeoutRef.current);
        const path = GO_MAP[event.key.toLowerCase()];
        if (path) {
          event.preventDefault();
          navigate(path);
        }
        return;
      }

      if (event.key.toLowerCase() === "g") {
        pendingGRef.current = true;
        timeoutRef.current = setTimeout(() => {
          pendingGRef.current = false;
        }, 600);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeoutRef.current);
    };
  }, [navigate, onOpenCommandPalette]);
}
