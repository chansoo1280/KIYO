// #region Global Imports
import classNames from "classnames"
import { ReactNode } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./Space.module.scss"

// #endregion Local Imports
interface Props {
    children?: ReactNode
    padding?: string
    className?: string
    direction?: "row" | "row-reverse" | "column" | "column-reverse"
    align?: "flex-start" | "center" | "flex-end"
    gap?: string
    cover?: boolean
    flex?: boolean
}

const Space = (props: Props): JSX.Element => {
    const { flex, gap, padding, direction, align, children, className, cover } = props
    const classes = classNames(
        styles["space"],
        {
            [styles["space--cover"]]: cover,
            [styles["space--flex"]]: flex,
            // [styles["space--" + direction]]: direction,
        },
        className,
    )
    return (
        <>
            <div style={{ gap, padding, flexDirection: direction, justifyContent: align }} className={classes}>
                {children}
            </div>
        </>
    )
}
export default Space
