import "./FixedUserList.css";

import React from "react";

type FixedUserListProps = {
  children: React.ReactNode;
  className?: string;
};

export const FixedUserList = ({ children, className }: FixedUserListProps) => (
  <div className={`FixedUserList ${className}`}>{children}</div>
);
