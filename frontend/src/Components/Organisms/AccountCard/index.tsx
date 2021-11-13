// #region Global Imports
import { ReactNode, useContext, useRef } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./AccountCard.module.scss"
import classNames from "classnames"
import { useTranslation } from "next-i18next"
import { Account } from "@Interfaces"
import { ThemeContext } from "styled-components"

// #endregion Local Imports
interface Props {
    children?: ReactNode
    account: Account
}
const AccountCard = (props: Props): JSX.Element => {
    const { children, account } = props
    const wrapRef = useRef<HTMLDivElement>(null)
    const { t } = useTranslation("common")

    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-account-card"

    return (
        <div ref={wrapRef} className={classNames(styles[prefixCls], {})}>
            <div className={classNames(styles[`${prefixCls}__header`])}>
                <h2 className={styles[`${prefixCls}__title`]}>{account.siteName}</h2>
                {children}
            </div>
            <div className={classNames(styles[`${prefixCls}__con`])}>
                {account.id} /{" "}
                {account.pw
                    .split("")
                    .map(() => "*")
                    .join("")}
            </div>
        </div>
    )
}
export default AccountCard
