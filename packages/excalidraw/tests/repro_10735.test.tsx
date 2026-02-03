import React from "react";
import { Excalidraw } from "../index";
import { render } from "./test-utils";
import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { expect } from "chai";

describe("Issue 10735: Drawing over text", () => {
    it("should allow drawing an arrow over a text element", async () => {
        await render(<Excalidraw />);

        // 1. Create a text element
        const textElement = API.createElement({
            type: "text",
            text: "Hello World",
            x: 100,
            y: 100,
            width: 100,
            height: 50,
        });

        // 2. Add text element to scene
        API.setElements([textElement]);

        // 3. Select arrow tool
        UI.clickTool("arrow");

        // 4. Draw arrow over text
        // Instantiate pointer
        const mouse = new Pointer("mouse");

        // Start drawing at (110, 110) which is inside text bounding box
        const startPoint = { x: 110, y: 110 };
        const endPoint = { x: 200, y: 200 };

        mouse.downAt(startPoint.x, startPoint.y);
        mouse.moveTo(endPoint.x, endPoint.y);
        mouse.upAt(endPoint.x, endPoint.y);

        // 5. Verify arrow is created
        // @ts-ignore
        const elements = window.h.elements;
        const arrow = elements.find((el: any) => el.type === "arrow");

        expect(arrow, "Arrow element should be created").to.not.be.undefined;
        expect(arrow?.x).to.be.closeTo(startPoint.x, 1);
        expect(arrow?.y).to.be.closeTo(startPoint.y, 1);
    });
});
