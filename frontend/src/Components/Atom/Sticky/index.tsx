// #region Global Imports
import classNames from "classnames"
import React, { ReactNode } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./Sticky.module.scss"
// #endregion Local Imports
interface Props {
    children?: ReactNode
    top?: string
    left?: string
    bottom?: string
    right?: string
}

const Sticky = (props: Props): JSX.Element => {
    const { children, ...rest } = props
    return (
        <div className={classNames(styles["sticky"])} style={{ ...rest }}>
            {children}
        </div>
    )
}

export default Sticky
