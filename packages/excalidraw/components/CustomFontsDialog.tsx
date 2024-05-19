import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { TextField } from "./TextField";
import DialogActionButton from "./DialogActionButton";
import { KEYS } from "../keys";
import { InlineIcon } from "./InlineIcon";
import { FontFamilyNormalIcon, FontFamilyCodeIcon, FreedrawIcon } from './icons';
import { Paragraph } from "./Paragraph";
import { EDITOR_LS_KEYS } from '../constants';
import { EditorLocalStorage } from "../data/EditorLocalStorage";
import { useI18n } from "../i18n";

import "./CustomFontsDialog.scss";
import { CustomFonts, preloadCustomFonts, getCustomFonts, getDefaultFonts } from "../font";

export type fontUrl = string | null;

export const CustomFontsDialog = (props: {
  onClose: () => void;
}) => {
  const { t } = useI18n();

  const [handwriting, setHandwriting] = useState<string>("https://excalidraw-zh.com/fonts/Xiaolai.woff2");
  const [normal, setNormal] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    const customFonts = getCustomFonts() || getDefaultFonts();
    if (customFonts.handwriting) {
      setHandwriting(customFonts.handwriting);
    }
    if (customFonts.normal) {
      setNormal(customFonts.normal);
    }
    if (customFonts.code) {
      setCode(customFonts.code);
    }
  }, []);

  const onConfirm = () => {
    if (!handwriting && !normal && !code) {
      EditorLocalStorage.delete(EDITOR_LS_KEYS.CUSTOM_FONTS);
      window.location.reload();
      return;
    }
    const customFonts = {
      handwriting,
      normal,
      code,
    } as CustomFonts;   
    setIsSaving(true);
    preloadCustomFonts(customFonts).then(() => {
      setIsSaving(false);
      EditorLocalStorage.set(EDITOR_LS_KEYS.CUSTOM_FONTS, customFonts);
      console.log("Fonts loaded");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }).catch(error => {
      setIsSaving(false);
      console.error(error);
    });
  }

  return (
    <Dialog
      onCloseRequest={() => {
        props.onClose();
      }}
      title={
        <div style={{ display: "flex" }}>
          {`${t("customFontsDialog.subTitle")}  `}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.1rem 0.5rem",
              marginLeft: "1rem",
              fontSize: 14,
              borderRadius: "12px",
              color: "#000",
              background: "pink",
            }}
          >
            Experimental
          </div>
        </div>
      }
      className="CustomFonts"
      autofocus={false}
    >
      <Paragraph>
        {`${t('customFontsDialog.paragraph1')}`}
      </Paragraph>
      {/* <Paragraph>
        {`${t('customFontsDialog.paragraph2')}`}
        <a
          href="https://platform.openai.com/login?launch"
          rel="noopener noreferrer"
          target="_blank"
        >
          {`${t('customFontsDialog.paragraph2Appendix')}`}
        </a>
      </Paragraph> */}
      <Paragraph>
        {`${t('customFontsDialog.paragraph3')}`}
      </Paragraph>
      <p />
      <TextField
        isRedacted={false}
        value={handwriting}
        placeholder={`${t('customFontsDialog.handwriting.placeholder')}`}
        label={`${t('customFontsDialog.handwriting.label')}`}
        labelIcon={<InlineIcon icon={FreedrawIcon} />}
        onChange={(value) => {
          setHandwriting(value);
        }}
        selectOnRender
        onKeyDown={(event) => event.key === KEYS.ENTER && onConfirm()}
      />
      <p />
      <TextField
        isRedacted={false}
        value={normal}
        placeholder={`${t('customFontsDialog.normal.placeholder')}`}
        label={`${t('customFontsDialog.normal.label')}`}
        labelIcon={<InlineIcon icon={FontFamilyNormalIcon} />}
        onChange={(value) => {
          setNormal(value);
        }}
        selectOnRender
        onKeyDown={(event) => event.key === KEYS.ENTER && onConfirm()}
      />
      <p />

      <TextField
        isRedacted={false}
        value={code}
        placeholder={`${t('customFontsDialog.code.placeholder')}`}
        label={`${t('customFontsDialog.code.label')}`}
        labelIcon={<InlineIcon icon={FontFamilyCodeIcon} />}
        onChange={(value) => {
          setCode(value);
        }}
        selectOnRender
        onKeyDown={(event) => event.key === KEYS.ENTER && onConfirm()}
      />
      <p />
      <DialogActionButton
        label={t("customFontsDialog.confirm")}
        actionType="primary"
        isLoading={isSaving}
        onClick={onConfirm}
      />

    </Dialog>
  );
};
