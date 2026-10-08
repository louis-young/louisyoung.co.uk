import { enquiryMailto, type Enquiry } from "../lib/hire";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * The message to show under a field, from its `data-error-missing` and `data-error-type`
 * attributes, or an empty string when the field is valid.
 */
export const fieldMessage = (control: Control) => {
  const { validity, dataset } = control;
  if (validity.valid) return "";
  if (validity.valueMissing && dataset["errorMissing"]) return dataset["errorMissing"];
  if (validity.typeMismatch && dataset["errorType"]) return dataset["errorType"];
  return control.validationMessage;
};

/** Shows or clears a field's inline error (the element `#<id>-error`) and returns whether it is valid. */
const report = (control: Control) => {
  const message = fieldMessage(control);
  const error = control.ownerDocument.getElementById(`${control.id}-error`);
  if (error) {
    error.textContent = message;
    error.hidden = !message;
  }
  if (message) control.setAttribute("aria-invalid", "true");
  else control.removeAttribute("aria-invalid");
  return !message;
};

/**
 * Progressive enhancement for the `/hire/` enquiry form. Without JavaScript the browser's own
 * validation and the `mailto:` action still work. With it, errors appear inline under each field
 * (tied with `aria-describedby`), a summary is announced on a failed submit, and a success panel
 * explains what happens once the visitor's email app opens.
 */
export const initEnquiry = (
  form = document.querySelector<HTMLFormElement>("[data-enquiry]"),
  navigate = (href: string) => {
    window.location.href = href;
  },
) => {
  if (!form) return;
  form.noValidate = true;
  const controls = [...form.querySelectorAll<Control>("input, select, textarea")];
  const errors = form.querySelector<HTMLElement>("[data-enquiry-errors]");
  const success = form.querySelector<HTMLElement>("[data-enquiry-success]");

  // Pressing the submit button blurs the field first. Showing its error then would push the button
  // out from under the pointer and swallow the click, so leave it to the submit handler instead.
  let submitting = false;
  form.addEventListener("pointerdown", (event) => {
    submitting = event.target instanceof Element && event.target.closest("[type=submit]") !== null;
  });

  for (const control of controls) {
    // Judge a field once someone has had a go at it, then keep the message in step as they type.
    control.addEventListener("blur", () => {
      if (control.value && !submitting) report(control);
    });
    control.addEventListener("input", () => {
      if (
        control.hasAttribute("aria-invalid") &&
        report(control) &&
        errors &&
        controls.every((item) => item.validity.valid)
      )
        errors.hidden = true;
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitting = false;
    const invalid = controls.filter((control) => !report(control));
    if (errors) errors.hidden = invalid.length === 0;
    if (success) success.hidden = invalid.length > 0;
    if (invalid.length > 0) {
      invalid[0]?.focus();
      return;
    }
    const data = Object.fromEntries(new FormData(form)) as unknown as Enquiry;
    const labels = JSON.parse(form.dataset["labels"] ?? "{}") as Record<keyof Enquiry, string>;
    const href = enquiryMailto(form.dataset["to"] ?? "", data, labels, form.dataset["subject"] ?? "");
    // Kept on the form too, so the composed email can be inspected (and tested) without a mail client.
    form.dataset["mailto"] = href;
    navigate(href);
  });
};
