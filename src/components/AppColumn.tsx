import React from "react";

/** The app's frame: the whole screen on the phone. (On a computer the website keeps it to a phone's width; see AppColumn.web.tsx.) */
export function AppColumn({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
