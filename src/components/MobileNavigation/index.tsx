import Link from "next/link";
import type { MobileNavigationProps } from "./types";

export const MobileNavigation = ({ links }: MobileNavigationProps) => {
  return (
    <nav className="absolute top-full left-0 h-screen w-full bg-white">
      <ul className="flex flex-col border-t border-gray-200">
        {links.map(({ name, link }) => (
          <li key={name}>
            <Link
              href={link}
              className="block border-b border-gray-200 py-9 px-5 text-lg font-normal opacity-80  hover:underline"
            >
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};
