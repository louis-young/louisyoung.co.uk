import Link from "next/link";
import type { DesktopNavigationProps } from "./types";

export const DesktopNavigation = ({ links }: DesktopNavigationProps) => {
  return (
    <nav>
      <ul className="flex items-center justify-between gap-4">
        {links.map(({ name, link }) => (
          <li key={name}>
            <Link
              href={link}
              className="p-4 text-lg font-normal opacity-80 hover:underline"
            >
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};
