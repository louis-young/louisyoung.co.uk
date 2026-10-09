import { type JsonError, parseJson } from "./json-tool";

export interface TypeOptions {
  /** The name of the top-level type; anything that isn’t a valid name is PascalCased. */
  rootName: string;
  style: "interface" | "type";
  readonly: boolean;
  export: boolean;
}

export type TypesResult = { output: string; count: number } | { error: JsonError };

type Primitive = "string" | "number" | "boolean";

/** Every type a position has held, merged: a union of primitives, one object shape and one array shape. */
interface Union {
  primitives: Set<Primitive>;
  nullable: boolean;
  object?: ObjectShape;
  array?: Union;
  /** An empty array’s element: nothing is known about it. */
  empty: boolean;
}

interface Field {
  union: Union;
  optional: boolean;
}

type ObjectShape = Map<string, Field>;

const emptyUnion = (): Union => ({ primitives: new Set(), nullable: false, empty: false });

const infer = (value: unknown): Union => {
  const union = emptyUnion();
  if (value === null) union.nullable = true;
  else if (Array.isArray(value)) {
    union.array = value.length === 0 ? { ...emptyUnion(), empty: true } : value.map(infer).reduce(merge);
  } else if (typeof value === "object") {
    union.object = new Map(
      Object.entries(value).map(([key, item]) => [key, { union: infer(item), optional: false }] as const),
    );
  } else union.primitives.add(typeof value as Primitive);
  return union;
};

/** Merges two objects’ fields: a key only one of them has becomes optional. */
const mergeObjects = (a: ObjectShape, b: ObjectShape): ObjectShape => {
  const merged: ObjectShape = new Map();
  for (const [key, field] of a) {
    const other = b.get(key);
    merged.set(
      key,
      other
        ? { union: merge(field.union, other.union), optional: field.optional || other.optional }
        : { union: field.union, optional: true },
    );
  }
  for (const [key, field] of b) if (!a.has(key)) merged.set(key, { union: field.union, optional: true });
  return merged;
};

const merge = (a: Union, b: Union): Union => {
  const object = a.object && b.object ? mergeObjects(a.object, b.object) : (a.object ?? b.object);
  const array = a.array && b.array ? merge(a.array, b.array) : (a.array ?? b.array);
  return {
    primitives: new Set([...a.primitives, ...b.primitives]),
    nullable: a.nullable || b.nullable,
    // An empty array adds nothing once another array says what the elements are.
    empty: (a.empty || b.empty) && a.primitives.size + b.primitives.size === 0 && !object && !array,
    ...(object && { object }),
    ...(array && { array }),
  };
};

/** Splits a key into words at separators and case changes: `user_id`, `userID`, `HTTPStatus2`. */
const words = (text: string) =>
  text.match(/\p{Lu}+(?=\p{Lu}\p{Ll})|\p{Lu}?[\p{Ll}\p{Lo}\p{M}]+\p{N}*|\p{Lu}+\p{N}*|\p{N}+[\p{Ll}\p{Lo}]*/gu) ?? [];

/** `first-name` → `FirstName`. Names that would start with a digit get a `T` in front. */
export const pascalCase = (text: string) => {
  const name = words(text)
    .map((word) => {
      const [first = "", ...rest] = word;
      return first.toUpperCase() + rest.join("").toLowerCase();
    })
    .join("");
  return /^\p{N}/u.test(name) ? `T${name}` : name;
};

/** A name for one element of a list: `users` → `User`, `categories` → `Category`, `data` → `DataItem`. */
export const singular = (name: string) => {
  if (/[^aeiou]ies$/u.test(name)) return `${name.slice(0, -3)}y`;
  if (/(?:ss|x|ch|sh)es$/u.test(name)) return name.slice(0, -2);
  if (/[^su]s$/u.test(name) && name.length > 3) return name.slice(0, -1);
  return `${name}Item`;
};

const identifier = /^[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*$/u;

/** A property name, quoted when it isn’t a valid identifier: `id`, `"first-name"`, `"2fa"`. */
export const propertyKey = (key: string) => (identifier.test(key) ? key : JSON.stringify(key));

const primitiveOrder: Primitive[] = ["string", "number", "boolean"];

interface Declaration {
  base: string;
  name: string;
  body: string;
}

/** Turns parsed JSON into TypeScript declarations, the root first. */
export const generateTypes = (value: unknown, options: TypeOptions) => {
  const declarations: (Declaration | undefined)[] = [];
  const taken = new Set<string>();
  const indent = "  ";
  const modifier = options.readonly ? "readonly " : "";
  const exported = options.export ? "export " : "";

  const claim = (base: string) => {
    let name = base;
    for (let suffix = 2; taken.has(name); suffix++) name = `${base}${suffix}`;
    taken.add(name);
    return name;
  };

  const printObject = (shape: ObjectShape, base: string): string => {
    if (shape.size === 0) return "Record<string, unknown>";
    const slot = declarations.length;
    const name = claim(base);
    declarations.push(undefined);
    const lines = [...shape].map(([key, field]) => {
      const type = printUnion(field.union, pascalCase(key) || "Field");
      return `${indent}${modifier}${propertyKey(key)}${field.optional ? "?" : ""}: ${type};`;
    });
    const body = lines.join("\n");
    // The same shape under the same name (an `address` in two places) is declared once.
    const twin = declarations.find((declaration) => declaration?.base === base && declaration.body === body);
    if (twin) {
      taken.delete(name);
      declarations.splice(slot, 1);
      return twin.name;
    }
    declarations[slot] = { base, name, body };
    return name;
  };

  const unionParts = (union: Union, base: string): string[] => {
    const parts = primitiveOrder.filter((primitive) => union.primitives.has(primitive)) as string[];
    if (union.object) parts.push(printObject(union.object, base));
    if (union.array) {
      const element = unionParts(union.array, singular(base));
      const text = element.join(" | ");
      // `readonly` binds looser than `[]`, so a readonly element needs brackets as much as a union does.
      const wrapped = element.length > 1 || text.startsWith("readonly ") ? `(${text})` : text;
      parts.push(`${modifier}${wrapped}[]`);
    }
    if (union.empty) parts.push("unknown");
    if (union.nullable) parts.push("null");
    return parts;
  };

  const printUnion = (union: Union, base: string) => unionParts(union, base).join(" | ");

  const root = pascalCase(options.rootName) || "Root";
  const union = infer(value);
  if (union.object && union.object.size > 0) {
    // Claimed first so a nested key with the same name gets the suffix, not the root.
    printUnion(union, root);
  } else {
    const slot = declarations.length;
    const name = claim(root);
    declarations.push(undefined);
    declarations[slot] = { base: root, name, body: printUnion(union, root) };
  }

  return declarations
    .filter((declaration) => declaration !== undefined)
    .map(({ name, body }, index) => {
      const isAlias = index === 0 && !(union.object && union.object.size > 0);
      if (isAlias) return `${exported}type ${name} = ${body};`;
      return options.style === "interface"
        ? `${exported}interface ${name} {\n${body}\n}`
        : `${exported}type ${name} = {\n${body}\n};`;
    });
};

/** Parses JSON and generates TypeScript types for it. */
export const jsonToTypes = (input: string, options: TypeOptions): TypesResult => {
  if (input.trim() === "") return { output: "", count: 0 };
  const parsed = parseJson(input);
  if ("error" in parsed) return parsed;
  const declarations = generateTypes(parsed.value, options);
  return { output: `${declarations.join("\n\n")}\n`, count: declarations.length };
};
