// #region Global Imports
import { Dispatch, MouseEventHandler, ReactNode, SetStateAction, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./Search.module.scss"
import { Button, Input, Space } from "@Components"
import classNames from "classnames"
import { useTranslation } from "next-i18next"
import { Account } from "@Interfaces"
import { RN_API } from "@Definitions"

// #endregion Local Imports
interface Props {
    children?: ReactNode
    onSearch?: MouseEventHandler
    value?: string
    setValue?: Dispatch<SetStateAction<string>>
    onReset?: () => void
}
const Search = (props: Props): JSX.Element => {
    const { value, setValue, children, onSearch, onReset } = props
    const { t } = useTranslation("common")
    return (
        <Space padding="0 10px" gap="5px" className={styles["search"]}>
            <Input className={styles["search__input"]} type="search" value={value} setValue={setValue} onReset={onReset} />
            <Button
                onClick={onSearch}
                icon={
                    <i className="xi-search">
                        <span className="ir">검색</span>
                    </i>
                }
            ></Button>
        </Space>
    )
}
export default Search
