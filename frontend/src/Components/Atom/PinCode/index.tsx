// #region Global Imports
import { Button } from "@Components"
import classNames from "classnames"
import React, { ChangeEvent, Dispatch, KeyboardEventHandler, MouseEventHandler, MutableRefObject, ReactNode, RefObject, SetStateAction, useCallback, useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./PinCode.module.scss"
// #endregion Local Imports
interface Props {
    length?: number
    value?: string
}

const PinCode = (props: Props): JSX.Element => {
    const { length = 0, value = "" } = props
    const [list, setList] = useState(
        (() => {
            const list = []
            for (let i = 0; i < length; i++) {
                list.push("_")
            }
            return list
        })(),
    )
    return (
        <div className={styles["pin-code"]}>
            {list.map((item, idx) => {
                return (
                    <span className={styles["pin-code__num"]} key={idx}>
                        {value[idx] ? "*" : "_"}
                    </span>
                )
            })}
        </div>
    )
}

export default PinCode
