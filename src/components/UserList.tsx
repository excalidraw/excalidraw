import "./UserList.scss";

import React from "react";

type UserListProps = {
  children: React.ReactNode;
  className?: string;
  mobile?: boolean;
};

export const UserList = ({ children, className, mobile }: UserListProps) => {
  let compClassName = "UserList";

  if (className) {
    compClassName += ` ${className}`;
  }

  if (mobile) {
    compClassName += " UserList_mobile";
  }

  return <div className={compClassName}>{children}</div>;
};
