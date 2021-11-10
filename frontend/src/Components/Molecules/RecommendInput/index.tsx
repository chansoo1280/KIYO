// #region Global Imports
import { Dispatch, MouseEventHandler, ReactNode, SetStateAction, useEffect, useState } from "react"
import * as Hangul from "hangul-js"
// #endregion Global Imports

// #region Local Imports
import styles from "./RecommendInput.module.scss"
import { Button, Input, Space } from "@Components"
import classNames from "classnames"
import { useTranslation } from "next-i18next"

// #endregion Local Imports
interface Props {
    children?: ReactNode
    hide?: boolean
    value?: string
    onClick?: (value: string) => void
    recommendList?: string[]
    className?: string
}
const RecommendInput = (props: Props): JSX.Element => {
    const { hide, value, onClick, className, children, recommendList = [] } = props
    const { t } = useTranslation("common")
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
        <div className={classNames(className, styles["recommend-input"])}>
            {children}
            <ul
                className={classNames(styles["recommend-input__con"], {
                    [styles["recommend-input__con--hide"]]: hide === true,
                })}
            >
                {showWordList.map((word, idx) => (
                    <li
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
