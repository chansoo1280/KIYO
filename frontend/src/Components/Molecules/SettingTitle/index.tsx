// #region Global Imports
import React, { ReactNode } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./SettingTitle.module.scss"
// #endregion Local Imports

interface Props {
    as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
    children: ReactNode
}
const SettingTitle = (props: Props): JSX.Element => {
    const { children, as } = props
    const TitleNode = `${as}` as keyof JSX.IntrinsicElements
    return <TitleNode className={styles["setting-title"]}>{children}</TitleNode>
}
export default SettingTitle
