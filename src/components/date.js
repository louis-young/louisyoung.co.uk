import React from "react";

const Date = ({ date }) => {
  return <time dateTime={date}>{date}</time>;
};

export default Date;
