// Atlantix Finance — logo component
// Uses the official atlantixfinancelogowhite.svg brand asset directly.

import logoSvg from "@/assets/atlantixfinancelogowhite.svg";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const heights: Record<string, string> = {
    sm: "h-[22px]",
    md: "h-[30px]",
    lg: "h-[42px]",
  };

  return (
    <img
      src={logoSvg}
      alt="Atlantix Finance"
      className={`${heights[size]} w-auto shrink-0`}
      draggable={false}
    />
  );
}
