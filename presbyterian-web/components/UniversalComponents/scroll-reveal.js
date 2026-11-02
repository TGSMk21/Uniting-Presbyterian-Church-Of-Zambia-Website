'use client';
import { useEffect, useRef } from "react";

export function ScrollReveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const delayClass = delay > 0 ? `reveal-delay-${delay}` : "";

  return (
    <div ref={ref} className={`reveal ${delayClass} ${className}`}>
      {children}
    </div>
  );
}

export function useProgressObserver() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const fill = entry.target;
            const width = fill.style.width;
            fill.style.width = "0%";
            setTimeout(() => { fill.style.width = width; }, 100);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    document.querySelectorAll(".project-progress-fill").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}
