import React from "react";
import { navigate } from "./router";
export default function Link({ href, children, ...rest }: any) {
  return <a href="#" {...rest} onClick={(e) => { e.preventDefault(); navigate(href); }}>{children}</a>;
}
