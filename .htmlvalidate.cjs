/** @type {import("html-validate").ConfigData} */
module.exports = {
  extends: ["html-validate:recommended", "html-validate:a11y"],
  rules: {
    // Expressive Code renders each code line as a <div> inside <code>, and its copy button
    // wraps <div>s and is labelled by `title`. Browsers handle this fine, and axe (which
    // checks accessible names properly) passes it. We can't change third-party markup.
    "element-permitted-content": "off",
    "no-implicit-button-type": "off",
    "text-content": "off",
    // `role="list"` restores list semantics Safari drops when `list-style: none` is set.
    "no-redundant-role": "off",
    "prefer-native-element": ["error", { exclude: ["list"] }],
    // Style attributes are permitted by the CSP (docs/adr/0002-csp-style-attributes.md).
    "no-inline-style": "off",
    "attribute-boolean-style": "off",
    "void-style": "off",
    "long-title": "off",
  },
};
