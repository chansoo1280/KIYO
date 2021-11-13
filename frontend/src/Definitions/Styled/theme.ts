// #region Global Imports
// #endregion Global Imports
export interface Theme {
    name: string
}
export const ThemeType: { [x: string]: number } = {
    WHITE: 0,
    DARK: 1,
} as const
export type ThemeType = typeof ThemeType[keyof typeof ThemeType]

export const ThemeObj: { [x: number]: Theme } = {
    [ThemeType.DEFAULT]: { name: "default" },
    [ThemeType.DARK]: { name: "dark" },
}
