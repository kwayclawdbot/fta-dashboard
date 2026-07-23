"use client";
/**
 * LazyMotion barrel — the "diet" path for framer-motion.
 *
 * Import `m` (not `motion`) and other primitives from here so the heavy
 * animation feature set is code-split into a single lazily-loaded chunk
 * instead of being statically bundled into every page's JS.
 *
 * Mount <MotionProvider> once near the root so every `m.*` element has a
 * LazyMotion feature context above it.
 *
 * The domAnimation bundle covers: animations, exit (AnimatePresence),
 * hover/press/focus gestures, and whileInView. It does NOT cover `drag`
 * or `layout` animations — files that need those keep importing the full
 * `motion` primitive directly from framer-motion.
 */
import { LazyMotion, domAnimation, m, AnimatePresence, useReducedMotion, useInView } from "framer-motion";
import { createElement, type ReactNode } from "react";
import type { PanInfo } from "framer-motion";

export { m, AnimatePresence, useReducedMotion, useInView, LazyMotion, domAnimation };
export type { PanInfo };

export function MotionProvider({ children }: { children: ReactNode }) {
  return createElement(LazyMotion, { features: domAnimation }, children);
}
