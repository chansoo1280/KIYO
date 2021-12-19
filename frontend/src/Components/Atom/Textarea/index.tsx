// #region Global Imports
import classNames from "classnames"
import React, { ChangeEvent, Dispatch, FocusEventHandler, KeyboardEventHandler, MouseEventHandler, ReactNode, SetStateAction, useCallback } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./Textarea.module.scss"
// #endregion Local Imports
export interface TextareaProps {
    children?: ReactNode
    type?: "text" | "email" | "password" | "search" | "number"
    size?: "sm" | "lg"
    onClick?: MouseEventHandler
    value?: string
    setValue?: Dispatch<SetStateAction<string>>
    onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void
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

const Textarea = (props: TextareaProps): JSX.Element => {
    const { id, prefix, className, value, onClick, setValue, onChange, onEnter, onReset, readOnly, cover, placeholder, ...rest } = props
    const onChangeTextarea = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value: string = e.target.value || ""
        setValue && setValue(value)
    }, [])
    return (
        <div
            className={classNames(
                styles["textarea-wrap"],
                {
                    [styles["textarea-wrap--cover"]]: cover,
                    [styles["textarea-wrap--readOnly"]]: readOnly,
                },
                className,
            )}
        >
            <textarea
                id={id}
                className={classNames(styles["textarea"])}
                value={value}
                readOnly={readOnly}
                onChange={onChange || onChangeTextarea}
                onClick={onClick}
                onKeyPress={(e) => {
                    if (e.key === "Enter") {
                        onEnter && onEnter(e)
                    }
                }}
                placeholder={placeholder}
                {...rest}
            />
        </div>
    )
}

export default Textarea
