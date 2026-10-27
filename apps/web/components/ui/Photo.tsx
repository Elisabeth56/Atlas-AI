import Image from "next/image";

/**
 * One of Atlas's photographs: rounded, cover-fit, with the 4% grain the design puts on every photo.
 * `drift` adds the slow 1.04 → 1.0 settle used on hero and section photos.
 */
export function Photo({
  src,
  alt,
  className = "",
  position = "50% 50%",
  priority = false,
  drift = false,
  sizes = "(min-width: 768px) 50vw, 100vw",
}: {
  src: string;
  alt: string;
  className?: string;
  position?: string;
  priority?: boolean;
  drift?: boolean;
  sizes?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-surface-2 ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        style={{ objectFit: "cover", objectPosition: position }}
        className={drift ? "motion-safe:animate-[drift_20s_cubic-bezier(0.22,1,0.36,1)_both]" : undefined}
      />
      <div aria-hidden className="grain pointer-events-none absolute inset-0" />
    </div>
  );
}
