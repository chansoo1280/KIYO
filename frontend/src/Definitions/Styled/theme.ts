// #region Global Imports
import { DefaultTheme } from "styled-components"
// #endregion Global Imports
declare module "styled-components" {
    export interface DefaultTheme {
        colors: {
            primary: string
        }
    }
}
export const ThemeType: { [x: string]: number } = {
    WHITE: 0,
    DARK: 1,
} as const
export type ThemeType = typeof ThemeType[keyof typeof ThemeType]

const theme: DefaultTheme = {
    colors: {
        primary: "#2c3e50",
    },
}

export const ThemeObj: { [x: number]: any } = {
    [ThemeType.WHITE]: theme,
    [ThemeType.DARK]: theme,
}
