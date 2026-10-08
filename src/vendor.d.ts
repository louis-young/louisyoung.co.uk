/** `reading-time`'s core function, imported directly so browsers don't pull in its Node stream helper. */
declare module "reading-time/lib/reading-time" {
  import readingTime from "reading-time";

  export default readingTime;
}
