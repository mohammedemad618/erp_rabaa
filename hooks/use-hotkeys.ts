"use client";

import { useEffect } from "react";

type HotkeyHandler = (event: KeyboardEvent) => void;

interface HotkeyDefinition {
  key: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  handler: HotkeyHandler;
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

export function useHotkeys(hotkeys: HotkeyDefinition[]): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const activeElement = document.activeElement as HTMLElement | null;
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.isContentEditable;

      for (const hotkey of hotkeys) {
        if (
          normalizeKey(event.key) === normalizeKey(hotkey.key) &&
          Boolean(hotkey.alt) === event.altKey &&
          Boolean(hotkey.ctrl) === event.ctrlKey &&
          Boolean(hotkey.shift) === event.shiftKey
        ) {
          if (!isInputFocused || hotkey.key === "/") {
            event.preventDefault();
            hotkey.handler(event);
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hotkeys]);
}
