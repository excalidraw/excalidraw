import React from "react";
import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
  downloadIcon,
} from "../../packages/excalidraw/components/icons";
import type { Theme } from "../../packages/excalidraw/element/types";
import { Excalidraw, MainMenu } from "../../packages/excalidraw/index";
import { isExcalidrawPlusSignedUser } from "../app_constants";
import { LanguageList } from "../app-language/LanguageList";
import { saveDebugState } from "./DebugCanvas";

import { jsPDF } from "jspdf";
import { useExcalidrawElements } from "../../packages/excalidraw/components/App";
import { useExcalidrawAppState } from "../../packages/excalidraw/components/App";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
}> = React.memo((props) => {

  // Get the current elements in the scene
  const elements = useExcalidrawElements();

  const handleExportToPDF = () => {

    // Get the current canvas
    const canvas = document.querySelector("canvas");

    // Create a new A4 pdf document
    const pdf = new jsPDF("landscape", "px", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;

    // Add a title to the PDF
    pdf.setFontSize(18);
    pdf.text("Excalidraw Whiteboard Export", margin, margin + 10);

    if (elements && elements.length > 0) {
      let yPos = margin + 40;

      // Group elements by type
      const groupedElements = elements.reduce((acc: Record<string, typeof elements>, element) => {
        console.log(element);
        acc[element.type] = acc[element.type] ? [...acc[element.type], element] : [element];
        return acc;
      }, {} as Record<string, typeof elements>);

      // Render each group of elements
      for (const [type, group] of Object.entries(groupedElements)) {
        // Add a heading for each group
        pdf.setFontSize(14);
        pdf.text(`Section: ${type.toUpperCase()}`, margin, yPos);
        yPos += 20;

        // Add elements to the PDF
        (group as typeof elements).forEach((element) => {
          pdf.setFontSize(12);

          switch (element.type) {
            case "text":
              pdf.text(element.text, margin, yPos);
              break;
            // case "diamond":
            // case "rectangle":
            //   pdf.rect(element.x, element.y, 100, 100);
            //   break;
            // case "ellipse":
            //   pdf.ellipse(element.x, element.y, 50, 50);
            //   break;
            // case "arrow":
            //   pdf.line(element.x, element.y, element.points[1][0], element.points[1][1]);
            //   break;
            // case "line":
            //   pdf.line(element.x, element.y, element.points[1][0], element.points[1][1]);
            //   break;
            // case "freedraw":
            //   element.points.forEach((point, index) => {
            //     if (index === 0) {
            //       pdf.moveTo(point[0]/3, point[1]/3);
            //     } else {
            //       pdf.lineTo(point[0]/3, point[1]/3);
            //     }
            //   });
            //   pdf.stroke();
            //   break;
            default:
              pdf.text(`- An element of type ${element.type}`, margin, yPos);
              break;
          }

          yPos += 20;

          if (yPos >= pageHeight - margin) {
            pdf.addPage();
            yPos = margin;
          }
        });

        yPos += 10; // Add spacing after each section
      }

      console.log(yPos, pageHeight - margin);

      // Check if comments can fit on the current page
      if (yPos + 60 >= pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }

      // Add a placeholder for optional comments
      pdf.setFontSize(14);
      pdf.text("Comments:", margin, yPos);
      yPos += 20;
      pdf.setFontSize(12);
      pdf.text("______________________________", margin, yPos);
      yPos += 20;
      pdf.text("______________________________", margin, yPos);
      yPos += 20;
      pdf.text("______________________________", margin, yPos);



      // Capture whiteboard content as an image
      if (canvas) {
        // Add a new page for the whiteboard content
        pdf.addPage();
        yPos = margin;
        pdf.setFontSize(18);
        // Add a title for the whiteboard content
        pdf.text("Captured Whiteboard Content", margin, margin + 10);
        pdf.setFontSize(12);

        yPos += 20;

        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const imgWidth = pageWidth - 2 * margin;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        // Check if the image fits on the page
        if (imgHeight > pageHeight - 2 * margin) {
          // If the image is too large, scale it down
          pdf.addImage(imgData, "JPEG", margin, yPos, imgWidth, imgHeight);
        } else {
          // If the image fits on the page, center it
          pdf.addImage(imgData, "JPEG", margin, yPos, imgWidth, imgHeight);
        }
      }

    } else {
      // If there are no elements in the scene, display a message
      pdf.setFontSize(14);
      pdf.text("No elements in the scene", margin, margin + 50);
    }

    // Save the PDF
    pdf.save("excalidraw-export.pdf");
  }

  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.Item onClick={handleExportToPDF} icon={downloadIcon}>Export To PDF</MainMenu.Item>
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.ItemLink
        icon={ExcalLogo}
        href={`${import.meta.env.VITE_APP_PLUS_LP
          }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`}
        className=""
      >
        Excalidraw+
      </MainMenu.ItemLink>
      <MainMenu.DefaultItems.Socials />
      <MainMenu.ItemLink
        icon={loginIcon}
        href={`${import.meta.env.VITE_APP_PLUS_APP}${isExcalidrawPlusSignedUser ? "" : "/sign-up"
          }?utm_source=signin&utm_medium=app&utm_content=hamburger`}
        className="highlighted"
      >
        {isExcalidrawPlusSignedUser ? "Sign in" : "Sign up"}
      </MainMenu.ItemLink>
      {import.meta.env.DEV && (
        <MainMenu.Item
          icon={eyeIcon}
          onClick={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme
        allowSystemTheme
        theme={props.theme}
        onSelect={props.setTheme}
      />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
