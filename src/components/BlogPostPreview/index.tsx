import Link from "next/link";
import { Spacer } from "../Spacer";
import { Subtitle } from "../Subtitle";
import { BlogPostPreviewProps } from "./types";

export const BlogPostPreview = ({
  link,
  image,
  title,
  date,
}: BlogPostPreviewProps) => {
  return (
    <article>
      <Link href={link} className="transition-opacity hover:opacity-80">
        <figure>
          <img src={image} alt={title} className="w-full rounded-md" />

          <Spacer size="small" />

          <figcaption>
            <h2 className="text-2xl font-medium leading-tight text-slate-900">
              {title}
            </h2>

            <Spacer size="minute" />

            <time>{date}</time>
          </figcaption>
        </figure>
      </Link>
    </article>
  );
};
