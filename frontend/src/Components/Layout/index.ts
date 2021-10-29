import { Default } from "./Default"
export interface LayoutProps {
    children?: React.ReactNode
}
export enum LayoutCode {
    "Default",
}
const TheLayout: {
    [key: number]: ({ children }: LayoutProps) => JSX.Element
} = {
    [LayoutCode.Default]: Default,
}
export default TheLayout
