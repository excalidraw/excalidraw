import { queryFocusableElements } from "../src/utils";

const render = (html: string) => {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
};

const idsOf = (html: string) =>
  queryFocusableElements(render(html)).map((element) => element.id);

describe("queryFocusableElements", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns natively focusable controls in document order", () => {
    expect(
      idsOf(`
        <button id="button">b</button>
        <input id="input" />
        <select id="select"></select>
        <textarea id="textarea"></textarea>
        <a id="link" href="#x">a</a>
      `),
    ).toEqual(["button", "input", "select", "textarea", "link"]);
  });

  it("includes any element made focusable via tabindex, not just div and label", () => {
    expect(
      idsOf(`
        <div id="div" tabindex="0"></div>
        <label id="label" tabindex="0"></label>
        <span id="span" tabindex="0"></span>
        <li id="li" tabindex="0"></li>
      `),
    ).toEqual(["div", "label", "span", "li"]);
  });

  it("includes a details summary", () => {
    expect(
      idsOf(`<details><summary id="summary">s</summary></details>`),
    ).toEqual(["summary"]);
  });

  it("skips an anchor without href, which is not focusable", () => {
    expect(idsOf(`<a id="no-href">a</a><a id="href" href="#x">a</a>`)).toEqual([
      "href",
    ]);
  });

  it("skips negative tabindex, disabled and aria-disabled", () => {
    expect(
      idsOf(`
        <button id="ok">b</button>
        <button id="negative" tabindex="-1">b</button>
        <button id="disabled" disabled>b</button>
        <button id="aria-disabled" aria-disabled="true">b</button>
      `),
    ).toEqual(["ok"]);
  });

  it("skips hidden elements", () => {
    expect(
      idsOf(`
        <button id="ok">b</button>
        <button id="display-none" style="display: none">b</button>
        <button id="visibility-hidden" style="visibility: hidden">b</button>
        <button id="hidden-attr" hidden>b</button>
        <button id="aria-hidden" aria-hidden="true">b</button>
      `),
    ).toEqual(["ok"]);
  });

  it("skips elements inside a hidden ancestor", () => {
    expect(
      idsOf(`
        <button id="ok">b</button>
        <div hidden><button id="in-hidden">b</button></div>
        <div aria-hidden="true"><button id="in-aria-hidden">b</button></div>
      `),
    ).toEqual(["ok"]);
  });

  it("returns an empty array for a null container", () => {
    expect(queryFocusableElements(null)).toEqual([]);
  });
});
