import { Label } from "../Label";
import { TextInput } from "../TextInput";
import type { LabelledTextInputProps } from "./types";

export const LabelledTextInput = ({
  label,
  placeholder = "",
  name,
  id,
  type,
  value,
  onValueChange,
  isDisabled = false,
  isRequired = false,
}: LabelledTextInputProps) => {
  return (
    <Label htmlFor={id} label={label}>
      <TextInput
        name={name}
        placeholder={placeholder}
        id={id}
        type={type}
        value={value}
        onValueChange={onValueChange}
        isDisabled={isDisabled}
        isRequired={isRequired}
      />
    </Label>
  );
};
