// #region Global Imports
import classNames from "classnames"
import React, { ChangeEvent, Dispatch, ReactNode, SetStateAction, useCallback } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./CheckBox.module.scss"
// #endregion Local Imports
interface Props {
    children?: ReactNode
    value?: string
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void
}

const CheckBox = (props: Props): JSX.Element => {
    const { onChange } = props
    return (
        <div className={styles["check-box-wrap"]}>
            <input
                className={classNames(styles["check-box"])}
                type="checkbox"
                onChange={(e) => {
                    onChange && onChange(e)
                }}
            />
        </div>
    )
}

export default CheckBox
