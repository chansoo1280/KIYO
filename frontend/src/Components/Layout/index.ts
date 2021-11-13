import { ForwardRefExoticComponent, RefAttributes } from "react"
import { Default } from "./Default"
export interface LayoutProps {
    children?: React.ReactNode
}
export enum LayoutCode {
    "Default",
}
const TheLayout: {
    [key: number]: (({ children }: LayoutProps) => JSX.Element) | ForwardRefExoticComponent<RefAttributes<HTMLDivElement>>
} = {
    [LayoutCode.Default]: Default,
}
export default TheLayout
