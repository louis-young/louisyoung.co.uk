import { icons } from "@/assets/icons";
import Link from "next/link";

const SOCIAL_MEDIA_LINKS = [
  {
    link: "https://github.com/louis-young",
    icon: icons.github,
  },
  {
    link: "https://twitter.com/louis_r_young",
    icon: icons.twitter,
  },
  {
    link: "#!",
    icon: icons.rss,
  },
];

export const SocialMediaLinks = () => {
  return (
    <ul className="flex items-center gap-3">
      {SOCIAL_MEDIA_LINKS.map(({ link, icon }) => (
        <li key={link}>
          <Link href={link} className="transition-opacity hover:opacity-80">
            {icon}
          </Link>
        </li>
      ))}
    </ul>
  );
};
