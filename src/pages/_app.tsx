import { Header } from "@/components/Header";
import "@/stylesheets/index.css";
import classNames from "classnames";
import type { AppProps } from "next/app";
import { Lexend } from "@next/font/google";
import { Footer } from "@/components/Footer";

const lexend = Lexend({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  preload: false,
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div
      className={classNames({
        dark: false,
        [lexend.className]: true,
      })}
    >
      <div className="dark:bg-dark dark:text-white">
        <Header />

        <Component {...pageProps} />

        <Footer />
      </div>
    </div>
  );
}
