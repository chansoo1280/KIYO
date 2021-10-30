// #region Global Imports
import classNames from "classnames"
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
    flex?: boolean
}

const Title = (props: Props): JSX.Element => {
    const { as = "h1", flex, ...rest } = props
    const TitleNode = `${as}` as keyof JSX.IntrinsicElements
    const classes = classNames(styles["title"], {
        [styles["title--flex"]]: flex,
    })
    return <TitleNode className={classes} {...rest} />
}
export default Title
