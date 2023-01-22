import Link from "next/link";

export const Logo = () => {
  return (
    <Link href="/" className="font-medium">
      <h2 className="text-3xl hover:underline dark:text-white">Louis Young</h2>
    </Link>
  );
};
