// #region Global Imports
import React, { MouseEventHandler } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./Title.module.scss"
// #endregion Local Imports

interface Props {
    children?: React.ReactNode
    as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
    className?: string
    onClick?: MouseEventHandler
}

const Title = (props: Props): JSX.Element => {
    const { as = "h1", ...rest } = props
    const TitleNode = `${as}` as keyof JSX.IntrinsicElements
    return <TitleNode className={styles["title"]} {...rest} />
}
export default Title
