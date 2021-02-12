import React from "react";

const Social = ({ title, link, icon }) => {
  return (
    <li>
      <a href={link} target="_blank" rel="noopnener noreferrer">
        <img className="w-5 hover:opacity-80 transition duration-200" src={icon} alt={title} />
      </a>
    </li>
  );
};

export default Social;
