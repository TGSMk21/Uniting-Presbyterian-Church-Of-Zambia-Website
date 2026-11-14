// The app's motion vocabulary (apple-design skill). Springs everywhere a finger can touch;
// critically damped by default, a little bounce only after a flick or a throw.

export const SPRING = { type: "spring", bounce: 0, duration: 0.38 };
export const SPRING_SNAPPY = { type: "spring", bounce: 0, duration: 0.26 };
export const SPRING_SHEET = { type: "spring", bounce: 0.12, duration: 0.42 };
export const SPRING_TAB = { type: "spring", bounce: 0.18, duration: 0.36 };

// Reduced motion: the same change, as a short cross-fade with no movement.
export const FADE = { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] };

// Tab change: Android's "fade through": the new screen rises in slightly.
export const TAB_ENTER = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };
export const TAB_ENTER_TRANSITION = { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] };
