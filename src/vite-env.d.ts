/// <reference types="vite/client" />

// vite-plugin-svgr type declarations
// See: https://www.npmjs.com/package/vite-plugin-svgr
declare module "*.svg?react" {
  import type { FC, SVGProps } from "react";
  const ReactComponent: FC<SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}
