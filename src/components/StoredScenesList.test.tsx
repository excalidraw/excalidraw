import React from "react";
import Enzyme, { shallow } from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import { StoredScenesList } from "./StoredScenesList";
import { PreviousScene } from "../scene/types";

Enzyme.configure({ adapter: new Adapter() });

function setup(props: any) {
  const currentProps = {
    ...props,
    onChange: jest.fn(),
  };
  return {
    wrapper: shallow(<StoredScenesList {...currentProps} />),
    props: currentProps,
  };
}

describe("<StoredScenesList/>", () => {
  const scenes: PreviousScene[] = [
    {
      id: "123",
      timestamp: Date.now(),
    },
    {
      id: "234",
      timestamp: Date.now(),
    },
    {
      id: "345",
      timestamp: Date.now(),
    },
  ];

  const { wrapper, props } = setup({ scenes });

  describe("Renders the ids correctly when", () => {
    it("select options and ids length are the same", () => {
      expect(wrapper.find("option").length).toBe(scenes.length);
    });
  });

  describe("Can handle id selection when", () => {
    it("onChange method is called when select option has changed", async () => {
      const select = wrapper.find("select") as any;
      const mockedEvenet = { currentTarget: { value: "1" } };
      await select.invoke("onChange")(mockedEvenet);
      expect(props.onChange.mock.calls.length).toBe(1);
    });
  });
});
