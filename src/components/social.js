import React from "react";

const Social = ({ link, icon }) => {
  return (
    <li>
      <a
        href={link}
        target="_blank"
        rel="noopnener noreferrer"
        className="block w-5 text-black dark:text-white fill-current hover:opacity-80 transition duration-200"
      >
        {icon}
      </a>
    </li>
  );
};

export default Social;
