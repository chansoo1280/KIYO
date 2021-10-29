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
    gap?: string
    cover?: boolean
}

const Space = (props: Props): JSX.Element => {
    const { gap, padding, direction, children, className, cover } = props
    const classes = classNames(
        styles["space"],
        {
            [styles["space--cover"]]: cover,
        },
        className,
    )
    return (
        <div style={{ gap, padding, flexDirection: direction }} className={classes}>
            {children}
        </div>
    )
}
export default Space
