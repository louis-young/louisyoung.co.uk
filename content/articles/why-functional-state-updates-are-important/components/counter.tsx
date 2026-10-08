import { useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => undefined;

/** False during server rendering and before hydration, so the buttons never look clickable while inert. */
const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

interface CounterProps {
  /** `stale` reads `count` from the render closure; `functional` uses the updater form. */
  strategy: "stale" | "functional";
}

/** The article's live example. Article copy, so it is written in the article's language. */
export default function Counter({ strategy }: CounterProps) {
  const [count, setCount] = useState(0);
  const hydrated = useHydrated();

  const incrementTwice = () => {
    if (strategy === "stale") {
      setCount(count + 1);
      setCount(count + 1);
    } else {
      setCount((previousCount) => previousCount + 1);
      setCount((previousCount) => previousCount + 1);
    }
  };

  return (
    <div className="demo-counter">
      <output className="demo-counter__value" aria-live="polite" aria-label={`Count: ${count}`}>
        {count}
      </output>
      <div className="demo-counter__actions">
        <button type="button" className="button button--primary" onClick={incrementTwice} disabled={!hydrated}>
          Increment
        </button>
        <button
          type="button"
          className="button"
          onClick={() => {
            setCount(0);
          }}
          disabled={!hydrated || count === 0}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
