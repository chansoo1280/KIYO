// #region Global Imports
import { Button } from "@Components"
import classNames from "classnames"
import React, { ChangeEvent, Dispatch, KeyboardEventHandler, MouseEventHandler, MutableRefObject, ReactNode, RefObject, SetStateAction, useCallback, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./Input.module.scss"
// #endregion Local Imports
interface Props {
    children?: ReactNode
    type?: "text" | "password"
    onClick?: MouseEventHandler
    value?: string
    setValue?: Dispatch<SetStateAction<string>>
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void
    onEnter?: KeyboardEventHandler
    readOnly?: boolean
    ref?: RefObject<HTMLInputElement>
}

const Input = (props: Props): JSX.Element => {
    const { ref, onClick, setValue, onChange, onEnter, type, readOnly, ...rest } = props
    const [isShowPw, setIsShowPw] = useState(type !== "password")
    const onChangeInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setValue!(e.target.value || "")
    }, [])
    return (
        <div className={styles["input-wrap"]}>
            <input
                ref={ref}
                type={type === "password" ? (isShowPw ? "text" : "password") : type}
                className={classNames(styles["input"], {
                    [styles["input--readOnly"]]: readOnly,
                })}
                readOnly={readOnly}
                onChange={onChange || onChangeInput}
                onClick={onClick}
                onKeyPress={(e) => {
                    if (e.key === "Enter") {
                        onEnter && onEnter(e)
                    }
                }}
                {...rest}
            />
            <Button
                className={styles["input__btn-eye"]}
                show={type === "password"}
                onClick={() => setIsShowPw(!isShowPw)}
                icon={
                    <i className={isShowPw ? "xi-eye-off" : "xi-eye"}>
                        <span className="ir">{isShowPw ? "패스워드 가리기" : "패스워드 보기"}</span>
                    </i>
                }
            ></Button>
        </div>
    )
}

export default Input
