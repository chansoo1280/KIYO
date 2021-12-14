// #region Global Imports
import { Dispatch, ForwardedRef, forwardRef, MouseEventHandler, ReactNode, SetStateAction, useEffect, useRef, useState } from "react"
import * as Hangul from "hangul-js"
// #endregion Global Imports

// #region Local Imports
import styles from "./RecommendInput.module.scss"
import { Input } from "@Components"
import classNames from "classnames"
import { useTranslation } from "next-i18next"
import { InputProps } from "@Components/Atom/Input"

// #endregion Local Imports
interface InputPropsWithRef extends InputProps {
    ref?: ForwardedRef<HTMLInputElement>
}
interface Props {
    children?: ReactNode
    value?: string
    onClick?: (value: string) => void
    recommendList?: string[]
    className?: string
    inputProps?: InputPropsWithRef
    cover?: boolean
}
const RecommendInput = (props: Props): JSX.Element => {
    const { value, onClick, className, inputProps, recommendList = [], cover } = props
    const { t } = useTranslation("common")
    const [isFocus, setIsFocus] = useState(false)
    const [showWordList, setShowWordList] = useState<string[]>([])
    useEffect(() => {
        const searcher = new Hangul.Searcher(value || "")
        setShowWordList(
            recommendList
                .filter((info) => {
                    return value && info !== value && searcher.search(info) !== -1
                })
                .slice(0, 4),
        )
    }, [value])
    return (
        <div
            className={classNames(className, styles["recommend-input"], {
                [styles["recommend-input--cover"]]: cover,
            })}
        >
            <Input
                onFocus={() => {
                    setIsFocus(true)
                }}
                onBlur={() => {
                    setTimeout(() => {
                        setIsFocus(false)
                    }, 100) // onClick 지원
                }}
                cover={cover}
                {...inputProps}
            />
            <ul
                className={classNames(styles["recommend-input__con"], {
                    [styles["recommend-input__con--hide"]]: isFocus === false || showWordList.length === 0,
                })}
            >
                {showWordList.map((word, idx) => (
                    <li
                        key={word}
                        className={classNames(styles["recommend-input__list"])}
                        onClick={() => {
                            onClick && onClick(word)
                        }}
                    >
                        {word}
                    </li>
                ))}
            </ul>
        </div>
    )
}
export default RecommendInput
