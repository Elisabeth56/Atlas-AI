"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The signature motion: content comes up from blur to sharp, item by item, like a print in the tray.
 * Mount it when data arrives (a stage finished), never on a timer. Change `key` to develop again.
 * `inline` is for headline words; otherwise each item is its own line.
 */
export function Develop({
  items,
  inline = false,
  stagger = 0.06,
  className = "",
}: {
  items: ReactNode[];
  inline?: boolean;
  stagger?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const Item = inline ? motion.span : motion.div;
  return (
    <span className={inline ? className : `block ${className}`}>
      {items.map((item, i) => (
        <Item
          key={i}
          className={inline ? "inline-block whitespace-pre" : "block"}
          initial={reduced ? { opacity: 0 } : { opacity: 0.4, filter: "blur(6px)", y: 4 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={reduced ? { duration: 0.2 } : { duration: 0.9, ease: EASE, delay: i * stagger }}
        >
          {item}
        </Item>
      ))}
    </span>
  );
}

/** Splits a headline into words for <Develop inline>, keeping the spaces. */
export function words(text: string): string[] {
  return text.split(/(?<=\s)/);
}
