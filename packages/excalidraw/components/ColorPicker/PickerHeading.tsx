import type { ReactNode } from "react";

const PickerHeading = ({ children }: { children: ReactNode }) => (
  <div className="color-picker__heading">{children}</div>
);

export default PickerHeading;
