// #region Global Imports
import { Dispatch, MouseEventHandler, ReactNode, SetStateAction, useContext, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./Search.module.scss"
import { Button, Input, Space, RecommendInput } from "@Components"
import classNames from "classnames"
import { useTranslation } from "next-i18next"
import { Account } from "@Interfaces"
import { RN_API } from "@Definitions"
import { useSelector } from "react-redux"
import { RootState } from "@Reducers"
import { ThemeContext } from "styled-components"

// #endregion Local Imports
interface Props {
    children?: ReactNode
    searchValue?: string
    onSearch?: (arg1: string) => void
    value?: string
    setValue?: Dispatch<SetStateAction<string>>
    onReset?: () => void
}
const Search = (props: Props): JSX.Element => {
    const { searchValue, value, setValue, children, onSearch, onReset } = props
    const { acFile } = useSelector(({ acFileReducer }: RootState) => ({
        acFile: acFileReducer,
    }))
    const { t } = useTranslation("common")
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-search"
    return (
        <Space padding="0 16px" gap="16px" className={styles[prefixCls]}>
            <RecommendInput
                className={styles[`${prefixCls}__input-box`]}
                onClick={(word) => {
                    setValue && setValue(word)
                    onSearch && onSearch(word)
                }}
                hide={value === searchValue}
                value={value}
                recommendList={acFile.list.map(({ siteName }) => siteName)}
            >
                <Input
                    prefix={
                        <i className="xi-search">
                            <span className="ir">검색</span>
                        </i>
                    }
                    size="lg"
                    type="search"
                    value={value}
                    setValue={setValue}
                    className={styles[`${prefixCls}__input`]}
                    onEnter={() => {
                        onSearch && onSearch(value || "")
                    }}
                    onReset={() => {
                        setValue && setValue("")
                        onSearch && onSearch("")
                    }}
                />
            </RecommendInput>
            <Button
                size="lg"
                onClick={() => {
                    onSearch && onSearch(value || "")
                }}
                icon={
                    <i className="xi-filter">
                        <span className="ir">필터</span>
                    </i>
                }
            ></Button>
        </Space>
    )
}
export default Search
