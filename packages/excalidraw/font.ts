
import { EDITOR_LS_KEYS } from './constants';
import { EditorLocalStorage } from './data/EditorLocalStorage';

export type CustomFonts = {
    handwriting: string | null;
    normal: string | null;
    code: string | null;
}

export const getDefaultFonts = () : CustomFonts => {
    return {
        handwriting: "https://excalidraw-zh.com/fonts/Xiaolai.woff2",
        normal: null,
        code: null,
    }
}

export const saveCustomFonts = (customFonts: CustomFonts) => {
    if (customFonts == null) {
        EditorLocalStorage.delete(EDITOR_LS_KEYS.CUSTOM_FONTS);
        return;
    }
    if (customFonts.handwriting == null || customFonts.normal == null || customFonts.code == null) {
        EditorLocalStorage.delete(EDITOR_LS_KEYS.CUSTOM_FONTS);
        return;
    }
    EditorLocalStorage.set(EDITOR_LS_KEYS.CUSTOM_FONTS, customFonts);
}

export const getCustomFonts = () => {
    const customFonts = EditorLocalStorage.get(EDITOR_LS_KEYS.CUSTOM_FONTS) as CustomFonts | null;
    if (customFonts == null) {
        return getDefaultFonts();
    }
    if (customFonts.handwriting == null || customFonts.normal == null || customFonts.code == null) {
        return null;
    }
    return customFonts;
}

export const isCustomFontsSet = () => {
    return EditorLocalStorage.has(EDITOR_LS_KEYS.CUSTOM_FONTS);
}

export const preloadCustomFonts = async (customFonts: CustomFonts) => {
    if (!('fonts' in document)) {
        return;
    }
    const promises = [];
    if (customFonts.handwriting) {
        const handwritingFont = new FontFace('Virgil', `url(${customFonts.handwriting}) format('woff2')`);
        document.fonts.add(handwritingFont);
        promises.push(handwritingFont.load());
    }

    if (customFonts.normal) {
        const normalFont = new FontFace('Helvetica', `url(${customFonts.normal}) format('woff2')`);
        document.fonts.add(normalFont);
        promises.push(normalFont.load());
    }

    if (customFonts.code) {
        const codeFont = new FontFace('Cascadia', `url(${customFonts.code}) format('woff2')`);
        document.fonts.add(codeFont);
        promises.push(codeFont.load());
    }
    await Promise.all(promises);
}
