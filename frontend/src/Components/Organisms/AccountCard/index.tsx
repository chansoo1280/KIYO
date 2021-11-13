// #region Global Imports
import { Dispatch, MouseEventHandler, ReactNode, RefObject, SetStateAction, useContext, useEffect, useRef, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./AccountCard.module.scss"
import { Button, Input, Space } from "@Components"
import classNames from "classnames"
import { useTranslation } from "next-i18next"
import { Account } from "@Interfaces"
import { RN_API } from "@Definitions"
import { WebViewMessage } from "@Services"
import { ThemeContext } from "styled-components"

// #endregion Local Imports
interface Props {
    account: Account
    onClickMod: (arg0: Account) => void
}
const AccountCard = (props: Props): JSX.Element => {
    const { account, onClickMod } = props
    const wrapRef = useRef<HTMLDivElement>(null)
    const { t } = useTranslation("common")

    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-account-card"

    const reqCopyPw = async () => {
        const data = await WebViewMessage(RN_API.SET_COPY, {
            text: account.pw,
        })
        if (data === null) return
    }
    return (
        <div ref={wrapRef} className={classNames(styles[prefixCls], {})}>
            <div className={classNames(styles[`${prefixCls}__header`])}>
                <h2 className={styles[`${prefixCls}__title`]}>{account.siteName}</h2>
                <Button
                    onClick={() => {
                        reqCopyPw()
                    }}
                    icon={
                        <i className="xi-documents">
                            <span className="ir">copy</span>
                        </i>
                    }
                ></Button>
                <Button
                    onClick={() => {
                        onClickMod(account)
                    }}
                    icon={
                        <i className="xi-pen">
                            <span className="ir">modify</span>
                        </i>
                    }
                ></Button>
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
