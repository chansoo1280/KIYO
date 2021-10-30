// #region Global Imports
import { MouseEventHandler, ReactNode, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./AccountCard.module.scss"
import { Button, Input } from "@Components"
import classNames from "classnames"
import { useTranslation } from "next-i18next"
import { Account } from "@Interfaces"

// #endregion Local Imports
interface Props {
    children?: ReactNode
    onClick?: MouseEventHandler
    onClickDel: MouseEventHandler
    onClickMod: (arg0: Account) => void
    account: Account
}
const AccountCard = (props: Props): JSX.Element => {
    const { account, children, onClick, onClickDel, onClickMod } = props
    const [newPw, setNewPw] = useState(account.pw)
    const [isOpen, setIsOpen] = useState(false)

    const [isEditPw, setIsEditPw] = useState(false)
    const { t } = useTranslation("common")
    return (
        <div className={styles["account-card"]}>
            <div className={styles["account-card__header"]} onClick={e => {
                setIsOpen(!isOpen)
            }}>
                <h2 className={styles["account-card__title"]}>
                    {account.id} / {account.address}
                </h2>
                <Button onClick={onClickDel}>delete</Button>
            </div>
            <div
                className={classNames({
                    [styles["account-card__con"]]: true,
                    [styles["account-card__con--show"]]: isOpen,
                })}
            >
                <span>최종 수정일: {account.modifiedAt}</span>
                <Input type={"password"}
                    onClick={(e) => {
                        if (!isEditPw) {
                            if (navigator.clipboard && window.isSecureContext) {
                                navigator.clipboard.writeText(account.pw).then(() => {
                                    alert("copy!")
                                })
                            } else {
                                alert("navigator.clipboard 메소드가 없습니다.")
                            }
                        }
                    }}
                    onChange={(e) => { setNewPw(e.target.value || '') }} value={newPw} readOnly={!isEditPw} />
                <Button onClick={() => {
                    setNewPw(account.pw)
                    setIsEditPw(!isEditPw)
                }} show={isEditPw} icon={<i className="xi-close-circle"></i>}></Button>
                <Button onClick={() => {
                    onClickMod({
                        ...account,
                        pw: newPw
                    })
                    setIsEditPw(!isEditPw)
                }} show={isEditPw} icon={<i className="xi-save"></i>}></Button>
                <Button onClick={() => {
                    setIsEditPw(!isEditPw)
                }} show={!isEditPw} icon={<i className="xi-pen"></i>}></Button>
            </div>
        </div>
    )
}
export default AccountCard
