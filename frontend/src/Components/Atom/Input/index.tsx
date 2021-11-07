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
    type?: "text" | "password" | "search" | "number"
    onClick?: MouseEventHandler
    value?: string
    setValue?: Dispatch<SetStateAction<string>>
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void
    onEnter?: KeyboardEventHandler
    onReset?: () => void
    readOnly?: boolean
    ref?: RefObject<HTMLInputElement>
    className?: string
    id?: string
}

const Input = (props: Props): JSX.Element => {
    const { className, ref, value, onClick, setValue, onChange, onEnter, onReset, type, readOnly, ...rest } = props
    const [isShowPw, setIsShowPw] = useState(type !== "password")
    const onChangeInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value: string = e.target.value || ""
        setValue && setValue(value)
    }, [])
    return (
        <div className={classNames(className, styles["input-wrap"])}>
            <input
                ref={ref}
                type={type === "password" ? (isShowPw ? "text" : "password") : type}
                className={classNames(styles["input"], {
                    [styles["input--readOnly"]]: readOnly,
                })}
                value={value}
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
                className={styles["input__btn"]}
                show={type === "password"}
                onClick={() => setIsShowPw(!isShowPw)}
                icon={
                    <i className={isShowPw ? "xi-eye-off" : "xi-eye"}>
                        <span className="ir">{isShowPw ? "패스워드 가리기" : "패스워드 보기"}</span>
                    </i>
                }
            ></Button>
            <Button
                className={styles["input__btn"]}
                show={type === "search" && value !== ""}
                onClick={() => {
                    onReset && onReset()
                    setValue && setValue("")
                }}
                icon={
                    <i className="xi-close-circle">
                        <span className="ir">내용 지우기</span>
                    </i>
                }
            ></Button>
        </div>
    )
}

export default Input
