import type { TextInputProps } from "./types";

export const TextInput = ({
  name,
  placeholder = "",
  id,
  type,
  value,
  onValueChange,
  isDisabled = false,
  isRequired = false,
}: TextInputProps) => {
  return (
    <input
      name={name}
      placeholder={placeholder}
      id={id}
      type={type}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      disabled={isDisabled}
      required={isRequired}
      className="border-light bg-lighter dark:border-darkest block w-full rounded-md border p-3 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-darker"
    />
  );
};
