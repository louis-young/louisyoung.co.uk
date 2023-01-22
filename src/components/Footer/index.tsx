import { icons } from "@/assets/icons";
import Link from "next/link";
import { Container } from "../Container";
import { Logo } from "../Logo";
import { SocialMediaLinks } from "../SocialMediaLinks";
import { Spacer } from "../Spacer";
import { SubscribeToNewsletter } from "../SubscribeToNewsletter";

const FOOTER_NAVIGATION_LINKS = [
  { link: "", text: "Home" },
  { link: "", text: "Work" },
  { link: "", text: "Blog" },
  { link: "", text: "About" },
  { link: "", text: "Contact" },
];

export const Footer = () => {
  return (
    <footer className="border-t border-gray-200">
      <Spacer size="large" />
      <Container>
        <div className="grid grid-cols-2 gap-16">
          <div>
            <Logo />

            <Spacer size="small" />

            <p>
              Software developer with a passion for React, TypeScript, testing
              and educating.
            </p>

            <Spacer size="small" />

            <SocialMediaLinks />
          </div>

          <SubscribeToNewsletter />
        </div>

        <Spacer size="large" />

        <p>© {new Date().getFullYear()} Louis Young. All Rights Reserved.</p>
      </Container>
      <Spacer size="large" />
    </footer>
  );
};
