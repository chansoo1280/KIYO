// #region Global Imports
import { Dispatch, ReactNode, SetStateAction, useContext, useRef } from "react"
import { useTranslation } from "next-i18next"
import { useSelector } from "react-redux"
import { ThemeContext } from "styled-components"
// #endregion Global Imports

// #region Local Imports
import styles from "./Search.module.scss"
import { Space, RecommendInput } from "@Components"
import { RootState } from "@Reducers"
import { Account } from "@Interfaces"

// #endregion Local Imports
interface Props {
    children?: ReactNode
    id: string
    onSearch?: (arg1: string) => void
    value?: string
    setValue?: Dispatch<SetStateAction<string>>
    onReset?: () => void
    recommendList?: Account["siteName"][]
}
const Search = (props: Props): JSX.Element => {
    const { id, value, setValue, children, onSearch, onReset, recommendList = [] } = props
    const { acFile } = useSelector(({ acFileReducer }: RootState) => ({
        acFile: acFileReducer,
    }))
    const { t } = useTranslation("common")
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-search"
    const ref = useRef<HTMLInputElement>(null)
    return (
        <Space padding="0 16px" gap="16px" className={styles[prefixCls]}>
            <RecommendInput
                className={styles[`${prefixCls}__input-box`]}
                onClick={(word) => {
                    setValue && setValue(word)
                    onSearch && onSearch(word)
                }}
                value={value}
                recommendList={recommendList}
                inputProps={{
                    id: id,
                    ref: ref,
                    prefix: (
                        <i className="xi-search">
                            <span className="ir">검색</span>
                        </i>
                    ),
                    size: "lg",
                    type: "search",
                    value: value,
                    setValue: setValue,
                    className: styles[`${prefixCls}__input`],
                    onEnter: () => {
                        onSearch && onSearch(value || "")
                        ref.current?.blur()
                    },
                    onReset: () => {
                        setValue && setValue("")
                        onSearch && onSearch("")
                        onReset && onReset()
                    },
                }}
            ></RecommendInput>
            {children}
        </Space>
    )
}
export default Search
