"use client";
import { useEffect, useRef } from "react";
import { useAppState } from "../_state/useAppState";
export function NatureBackground() {
  const moving = useAppState((s) => s.ambientMotion);
  const entering = useAppState((s) => s.entering);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.playbackRate = 0.65;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (moving && !reduced.matches && !document.hidden) {
        void element.play().catch(() => {});
      } else element.pause();
    };
    update();
    reduced.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      reduced.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      element.pause();
    };
  }, [moving]);
  return (
    <div
      className={`nature-background photo-nature ${entering ? "is-entering" : ""}`}
      aria-hidden="true"
    >
      <video
        ref={video}
        className="forest-video"
        src="/backgrounds/meadow-dusk.mp4"
        poster="/backgrounds/meadow-dusk-poster.jpg"
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        tabIndex={-1}
      />
      <div className="forest-video-shade" />
    </div>
  );
}
