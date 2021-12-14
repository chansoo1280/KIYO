// #region Global Imports
import { Button } from "@Components"
import classNames from "classnames"
import React, {
    ChangeEvent,
    Dispatch,
    FocusEventHandler,
    ForwardedRef,
    forwardRef,
    KeyboardEventHandler,
    MouseEventHandler,
    MutableRefObject,
    ReactNode,
    RefObject,
    SetStateAction,
    useCallback,
    useState,
} from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./Input.module.scss"
// #endregion Local Imports
export interface InputProps {
    children?: ReactNode
    type?: "text" | "email" | "password" | "search" | "number"
    size?: "sm" | "lg"
    onClick?: MouseEventHandler
    value?: string
    setValue?: Dispatch<SetStateAction<string>>
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void
    onEnter?: KeyboardEventHandler
    onFocus?: FocusEventHandler
    onBlur?: (e: any) => void
    onReset?: () => void
    readOnly?: boolean
    cover?: boolean
    className?: string
    id?: string
    prefix?: ReactNode
    placeholder?: string
}

const Input = forwardRef((props: InputProps, ref: ForwardedRef<HTMLInputElement>): JSX.Element => {
    const { id, prefix, className, value, onClick, setValue, onChange, onEnter, onReset, type, size, readOnly, cover, placeholder, ...rest } = props
    const [isShowPw, setIsShowPw] = useState(false)
    const onChangeInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value: string = e.target.value || ""
        setValue && setValue(value)
    }, [])
    return (
        <div
            className={classNames(
                styles["input-wrap"],
                {
                    [styles[`input-wrap--${size}`]]: size,
                    [styles["input-wrap--readOnly"]]: readOnly,
                    [styles["input-wrap--cover"]]: cover,
                },
                className,
            )}
        >
            {prefix && (
                <label
                    htmlFor={id}
                    className={classNames(styles["input__prefix"], {
                        [styles[`input__prefix--icon-only`]]: !prefix.hasOwnProperty("length"),
                    })}
                >
                    {prefix}
                </label>
            )}
            <input
                id={id}
                ref={ref}
                type={type === "password" ? (isShowPw ? "text" : "password") : type}
                className={classNames(styles["input"])}
                value={value}
                readOnly={readOnly}
                onChange={onChange || onChangeInput}
                onClick={onClick}
                onKeyPress={(e) => {
                    if (e.key === "Enter") {
                        onEnter && onEnter(e)
                    }
                }}
                placeholder={placeholder}
                {...rest}
            />
            <Button
                type="text"
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
                type="text"
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
})

export default Input
