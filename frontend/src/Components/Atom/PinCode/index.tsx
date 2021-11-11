// #region Global Imports
import { Button } from "@Components"
import classNames from "classnames"
import React, { ChangeEvent, Dispatch, KeyboardEventHandler, MouseEventHandler, MutableRefObject, ReactNode, RefObject, SetStateAction, useCallback, useContext, useEffect, useState } from "react"
import { ThemeContext } from "styled-components"
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
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-pin-code"
    const [list, setList] = useState(
        (() => {
            const list = []
            for (let i = 0; i < length; i++) {
                list.push(undefined)
            }
            return list
        })(),
    )
    return (
        <>
            <div className={styles[prefixCls]}>
                <h1 className={styles[`${prefixCls}__title`]}>pincode</h1>
                <ol className={styles[`${prefixCls}__con`]}>
                    {list.map((item, idx) => {
                        return (
                            <li
                                className={classNames(styles[`${prefixCls}__num`], {
                                    [styles[`${prefixCls}__num--active`]]: value[idx] !== undefined,
                                })}
                                key={idx}
                            ></li>
                        )
                    })}
                </ol>
            </div>
        </>
    )
}

export default PinCode
