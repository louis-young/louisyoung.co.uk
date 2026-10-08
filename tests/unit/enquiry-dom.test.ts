// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fieldMessage, initEnquiry } from "../../src/scripts/enquiry";

afterEach(() => {
  document.body.innerHTML = "";
});

const setup = () => {
  document.body.innerHTML = `
    <form data-enquiry data-to="me@example.com" data-subject="Enquiry"
      data-labels='{"name":"Name","email":"Email","company":"Company","message":"Message"}'>
      <div data-enquiry-errors hidden>Fix the fields</div>
      <input id="f-name" name="name" type="text" required data-error-missing="Add your name" />
      <p id="f-name-error" hidden></p>
      <input id="f-email" name="email" type="email" required data-error-missing="Add your email"
        data-error-type="Check your email" />
      <p id="f-email-error" hidden></p>
      <input id="f-company" name="company" type="text" />
      <textarea id="f-message" name="message" required></textarea>
      <p id="f-message-error" hidden></p>
      <div data-enquiry-success hidden>Sent</div>
      <button type="submit">Send</button>
    </form>`;
  const navigate = vi.fn();
  initEnquiry(document.querySelector("form"), navigate);
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  return {
    navigate,
    form: get("form") as HTMLFormElement,
    name: get("#f-name") as HTMLInputElement,
    email: get("#f-email") as HTMLInputElement,
    message: get("#f-message") as HTMLTextAreaElement,
    errors: get("[data-enquiry-errors]"),
    success: get("[data-enquiry-success]"),
  };
};

const submit = (form: HTMLFormElement) => form.dispatchEvent(new Event("submit", { cancelable: true }));
const type = (control: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  control.value = value;
  control.dispatchEvent(new Event("input"));
};
const error = (id: string) => document.querySelector<HTMLElement>(`#${id}-error`)!;

describe("fieldMessage", () => {
  it("is empty for a valid field and falls back to the browser’s message", () => {
    const input = document.createElement("input");
    expect(fieldMessage(input)).toBe("");
    input.required = true;
    expect(fieldMessage(input)).toBe(input.validationMessage);
  });
});

describe("initEnquiry", () => {
  it("does nothing without a form", () => {
    expect(() => {
      initEnquiry(null);
    }).not.toThrow();
  });

  it("takes over validation from the browser", () => {
    const { form } = setup();
    expect(form.noValidate).toBe(true);
  });

  it("shows inline errors and a summary, and focuses the first invalid field", () => {
    const { form, name, errors, success, navigate } = setup();
    submit(form);
    expect(errors.hidden).toBe(false);
    expect(success.hidden).toBe(true);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(error("f-name").textContent).toBe("Add your name");
    expect(error("f-name").hidden).toBe(false);
    expect(error("f-message").textContent).not.toBe("");
    expect(document.activeElement).toBe(name);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("explains a mistyped email once the field loses focus, and clears it as it is fixed", () => {
    const { email, errors } = setup();
    email.dispatchEvent(new Event("blur"));
    expect(email.hasAttribute("aria-invalid")).toBe(false);
    email.value = "ada";
    email.dispatchEvent(new Event("blur"));
    expect(error("f-email").textContent).toBe("Check your email");
    type(email, "ada@example.com");
    expect(email.hasAttribute("aria-invalid")).toBe(false);
    expect(error("f-email").hidden).toBe(true);
    expect(errors.hidden).toBe(true);
  });

  it("leaves a blur caused by pressing submit to the submit handler, so the button stays put", () => {
    const { form, email } = setup();
    email.value = "ada";
    form.querySelector("button")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    email.dispatchEvent(new Event("blur"));
    expect(error("f-email").hidden).toBe(true);
    submit(form);
    expect(error("f-email").textContent).toBe("Check your email");
    email.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    email.dispatchEvent(new Event("blur"));
    expect(email.getAttribute("aria-invalid")).toBe("true");
  });

  it("hides the summary once every field is fixed", () => {
    const { form, name, email, message, errors } = setup();
    submit(form);
    type(name, "Ada");
    expect(errors.hidden).toBe(false);
    type(email, "ada@example.com");
    type(message, "Hello");
    expect(errors.hidden).toBe(true);
  });

  it("composes the email and shows the success state", () => {
    const { form, name, email, message, errors, success, navigate } = setup();
    name.value = "Ada";
    email.value = "ada@example.com";
    message.value = "We need a hand.";
    submit(form);
    expect(errors.hidden).toBe(true);
    expect(success.hidden).toBe(false);
    expect(navigate).toHaveBeenCalledWith(form.dataset["mailto"]);
    expect(form.dataset["mailto"]).toMatch(/^mailto:me@example\.com\?subject=Enquiry&body=Name%3A%20Ada/u);
  });

  it("works without the optional panels, error elements or data attributes", () => {
    document.body.innerHTML = `<form><textarea id="m" name="message" required></textarea></form>`;
    const navigate = vi.fn();
    initEnquiry(document.querySelector("form"), navigate);
    const form = document.querySelector("form")!;
    submit(form);
    expect(navigate).not.toHaveBeenCalled();
    type(document.querySelector("textarea")!, "Hello");
    submit(form);
    expect(navigate).toHaveBeenCalledWith("mailto:?subject=&body=%0AHello");
  });

  it("navigates to the composed email by default", () => {
    document.body.innerHTML = `<form data-enquiry><textarea name="message">Hi</textarea></form>`;
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        set href(value: string) {
          assign(value);
        },
      },
    });
    initEnquiry();
    submit(document.querySelector("form")!);
    Object.defineProperty(window, "location", { configurable: true, value: original });
    expect(assign).toHaveBeenCalledOnce();
  });
});
