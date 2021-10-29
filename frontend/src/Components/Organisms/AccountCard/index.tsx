// #region Global Imports
import { MouseEventHandler, ReactNode } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./AccountCard.module.scss"
import { Button } from "@Components"
import classNames from "classnames"
import { useTranslation } from "next-i18next"
import { Account } from "@Interfaces"

// #endregion Local Imports
interface Props {
    children?: ReactNode
    onClick?: MouseEventHandler
    onClickDel?: MouseEventHandler
    account: Account
    isOpen?: boolean
}
const AccountCard = (props: Props): JSX.Element => {
    const { account, isOpen, children, onClick, onClickDel } = props
    const { t } = useTranslation("common")
    return (
        <div className={styles["account-card"]}>
            <div className={styles["account-card__con"]} onClick={onClick}>
                <div className={styles["account-card__header"]}>
                    <h2 className={styles["account-card__title"]}>
                        {account.id} / {account.address}
                    </h2>
                    <Button onClick={onClickDel}>delete</Button>
                </div>
            </div>
            {/* <div
                className={classNames({
                    [styles["account-card__chart"]]: true,
                    [styles["account-card__chart--show"]]: isOpen,
                })}
            >
                {children}
            </div> */}
        </div>
    )
}
export default AccountCard
