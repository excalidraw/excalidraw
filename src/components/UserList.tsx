import "./UserList.scss";

import React from "react";
import clsx from "clsx";

type UserListProps = {
  children: React.ReactNode;
  className?: string;
  mobile?: boolean;
};

export const UserList = ({ children, className, mobile }: UserListProps) => {
  return (
    <div className={clsx("UserList", className, { UserList_mobile: mobile })}>
      {children}
    </div>
  );
};
