import React from "react";
import Enzyme, { shallow } from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import { StoredIdsList } from "./StoredIdsList";

Enzyme.configure({ adapter: new Adapter() });

function setup(props: any) {
  const currentProps = {
    ...props,
    onChange: jest.fn(),
  };
  return {
    wrapper: shallow(<StoredIdsList {...currentProps} />),
    props: currentProps,
  };
}

describe("<StoredIdsList/>", () => {
  const ids = ["123", "234", "345"];
  const { wrapper, props } = setup({ ids });

  describe("Renders the ids correctly when", () => {
    it("select options and ids length are the same", () => {
      expect(wrapper.find("option").length).toBe(ids.length);
    });
  });

  describe("Can handle id selection when", () => {
    it("onChange method is called when select option has changed", async () => {
      const select = wrapper.find("select") as any;
      const mockedEvenet = { target: { value: "1" } };
      await select.invoke("onChange")(mockedEvenet);
      expect(props.onChange.mock.calls.length).toBe(1);
    });
  });
});
