import { PAGE_PATHS } from "@/constants/pagePaths";
import { useState } from "react";
import { Button } from "../Button";
import { Container } from "../Container";
import { Logo } from "../Logo";
import { DesktopNavigation } from "../DesktopNavigation";
import { MobileNavigation } from "../MobileNavigation";

const NAVIGATION_LINKS = [
  { name: "Home", link: PAGE_PATHS.home },
  { name: "Work", link: PAGE_PATHS.work },
  { name: "Blog", link: PAGE_PATHS.blog },
  { name: "About", link: PAGE_PATHS.about },
];

export const Header = () => {
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);

  return (
    <header className="relative py-12">
      <Container size="large" className="flex items-center justify-between">
        <Logo />

        <div className="lg:hidden">
          {isMobileNavigationOpen && (
            <MobileNavigation links={NAVIGATION_LINKS} />
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            setIsMobileNavigationOpen(
              (previousIsMobileNavigationOpen) =>
                !previousIsMobileNavigationOpen,
            )
          }
          className="lg:hidden"
        >
          <svg
            width={52}
            height={52}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x={6}
              y={9}
              width={20}
              height={2}
              rx={1}
              fill="currentColor"
              style={{
                transformOrigin: "0 0",
              }}
            />
            <rect
              x={6}
              y={15}
              width={20}
              height={2}
              rx={1}
              fill="currentColor"
            />
            <rect
              x={6}
              y={21}
              width={20}
              height={2}
              rx={1}
              fill="currentColor"
              style={{
                transformOrigin: "0 0",
              }}
            />
          </svg>
        </button>

        <div className="hidden lg:block">
          <DesktopNavigation links={NAVIGATION_LINKS} />
        </div>

        <div className="hidden lg:block">
          <Button>Contact</Button>
        </div>
      </Container>
    </header>
  );
};
