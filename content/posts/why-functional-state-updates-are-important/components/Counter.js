import React, { useState } from "react";

const Counter = () => {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount((previousCount) => previousCount + 1);

    setCount((previousCount) => previousCount + 1);
  };

  return (
    <section className="bg-gray-50 p-4 rounded">
      <span className="text-3xl font-bold block">{count}</span>

      <button
        className="mt-6 bg-black hover:bg-white hover:text-black border border-black text-white font-bold py-3 px-12 lg:px-8 duration-200 transition-colors mb-6 lg:mb-0"
        onClick={handleClick}
      >
        Increment
      </button>
    </section>
  );
};

export default Counter;
