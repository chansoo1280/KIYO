// #region Global Imports
import classNames from "classnames"
import { ReactNode, useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./Tooltip.module.scss"

// #endregion Local Imports
interface Props {
    children?: ReactNode
    contents?: ReactNode
    posY?: "top" | "bottom"
    posX?: "left" | "right" | "center"
}

const Tooltip = (props: Props): JSX.Element => {
    const { contents, children, posY = "bottom", posX = "center" } = props
    const [show, setShow] = useState(false)
    useEffect(() => {
        if (show === true)
            setTimeout(() => {
                if (show === true) setShow(false)
            }, 500)
    }, [show])
    return (
        <div
            className={styles["tooltip-wrap"]}
            onClick={() => {
                setShow(true)
            }}
        >
            {children}
            <div
                className={classNames({
                    [styles["tooltip"]]: true,
                    [styles["tooltip--show"]]: show,
                    [styles[`tooltip--${posY}-${posX}`]]: true,
                })}
            >
                {contents}
            </div>
        </div>
    )
}
export default Tooltip
