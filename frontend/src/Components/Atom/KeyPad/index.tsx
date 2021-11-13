// #region Global Imports
import { Button } from "@Components"
import classNames from "classnames"
import React, { ChangeEvent, Dispatch, KeyboardEventHandler, MouseEventHandler, MutableRefObject, ReactNode, RefObject, SetStateAction, useCallback, useContext, useEffect, useState } from "react"
import { ThemeContext } from "styled-components"
// #endregion Global Imports

// #region Local Imports
import styles from "./KeyPad.module.scss"
// #endregion Local Imports
interface Props {
    value: string
    setValue?: Dispatch<SetStateAction<string | null>>
    onChange?: () => void
    onEnter?: () => void
    maxLength?: number
}

const KeyPad = (props: Props): JSX.Element => {
    const { maxLength = 20, value, setValue, onChange, onEnter, ...rest } = props
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-key-pad"
    const shuffleArray = (array: string[]) => {
        for (let i = 0; i < array.length; i++) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[array[i], array[j]] = [array[j], array[i]]
        }
        return array
    }
    const [activeKey, setActiveKey] = useState<string>("")
    const [keyList, setKeyList] = useState(
        (() => {
            const list = shuffleArray(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"])
            list.splice(2, 0, "delete")
            list.splice(11, 0, "입력")
            return list
        })(),
    )
    useEffect(() => {
        onChange && onChange()
    }, [value])
    return (
        <div className={styles[prefixCls]}>
            {keyList.map((key) => (
                <button
                    key={key}
                    className={classNames(styles[`${prefixCls}__btn`], {
                        [styles[`${prefixCls}__btn--active`]]: key === activeKey,
                        [styles[`${prefixCls}__btn--confirm`]]: key === "입력",
                    })}
                    onTouchStart={() => {
                        if (key === "입력") {
                            onEnter && onEnter()
                            setActiveKey(key)
                        } else if (key === "delete") {
                            setValue && setValue((value && value.slice(0, -1)) || "")
                            setActiveKey(key)
                        } else {
                            const newValue = value + String(key)
                            setValue && setValue(newValue.slice(0, maxLength))
                            setActiveKey(String(Math.floor(Math.random() * 10)))
                        }
                    }}
                    onTouchEnd={() => {
                        setActiveKey("")
                    }}
                >
                    {key === "delete" ? <i className="xi-long-arrow-left"></i> : key === "입력" ? <i className="xi-unlock-o"></i> : key}
                </button>
            ))}
        </div>
    )
}

export default KeyPad
