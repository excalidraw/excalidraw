
import { embeddableURLValidator } from "../src/embeddable";

describe("embeddableURLValidator", () => {
    it("should validate app.botmockups.com", () => {
        const url = "https://app.botmockups.com/chat/123";
        expect(embeddableURLValidator(url, undefined)).toBe(true);
    });

    it("should not validate unknown domains", () => {
        const url = "https://unknown-domain.com/something";
        expect(embeddableURLValidator(url, undefined)).toBe(false);
    });
});
