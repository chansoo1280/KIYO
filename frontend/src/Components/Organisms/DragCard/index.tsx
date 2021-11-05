// #region Global Imports
import { Dispatch, MouseEventHandler, ReactNode, SetStateAction, TouchEventHandler, useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./DragCard.module.scss"
import { Button, Input } from "@Components"
import classNames from "classnames"
import { useTranslation } from "next-i18next"
import { Account } from "@Interfaces"
import { RN_API } from "@Definitions"

// #endregion Local Imports
interface Props {
    isShow: boolean
    mousePos: {
        x: number
        y: number
    }
}
const DragCard = (props: Props): JSX.Element => {
    const { isShow, mousePos } = props

    return (
        <div
            className={classNames(styles["drag-card"], {
                [styles["drag-card--show"]]: isShow,
            })}
            style={{ left: mousePos.x + "px", top: mousePos.y + "px" }}
        ></div>
    )
}
export default DragCard
