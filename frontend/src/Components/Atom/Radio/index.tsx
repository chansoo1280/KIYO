// #region Global Imports
import classNames from "classnames"
import React, { ChangeEvent, Dispatch, ReactNode, SetStateAction, useCallback } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./Radio.module.scss"
// #endregion Local Imports
interface Props {
    children?: ReactNode
    id: string
    name: string
    value?: string
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void
    checked: boolean
}

const Radio = (props: Props): JSX.Element => {
    const { id, name, checked, onChange, children } = props
    return (
        <div>
            <input
                style={{ position: "absolute" }}
                id={id}
                name={name}
                type="radio"
                onChange={(e) => {
                    onChange && onChange(e)
                }}
                checked={checked}
            />
            <label htmlFor={id} className={classNames(styles["radio"])}>
                <i className={classNames(styles["radio__icon"], checked ? "xi-radiobox-checked" : "xi-radiobox-blank")}></i>
                {children}
            </label>
        </div>
    )
}

export default Radio
