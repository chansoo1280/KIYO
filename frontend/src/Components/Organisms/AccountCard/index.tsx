// #region Global Imports
import { Dispatch, MouseEventHandler, ReactNode, SetStateAction, TouchEventHandler, useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./AccountCard.module.scss"
import { Button, Input } from "@Components"
import classNames from "classnames"
import { useTranslation } from "next-i18next"
import { Account } from "@Interfaces"
import { RN_API } from "@Definitions"

// #endregion Local Imports
interface Props {
    idx: number
    isHover: boolean
    isHoverTop: boolean
    moveItemIdx: (idx: number) => void
    children?: ReactNode
    onClick?: MouseEventHandler
    onClickDel: MouseEventHandler
    onClickMod: (arg0: Account) => void
    account: Account
    dragAccount: number | null
    setDragAccount: Dispatch<SetStateAction<number | null>>
    setMousePos: Dispatch<
        SetStateAction<{
            x: number
            y: number
        }>
    >
    setMoveY: Dispatch<SetStateAction<number>>
}
const AccountCard = (props: Props): JSX.Element => {
    const { idx, isHover, isHoverTop, account, moveItemIdx, children, onClick, onClickDel, onClickMod, dragAccount, setDragAccount, setMoveY, setMousePos } = props
    const [newPw, setNewPw] = useState(account.pw)
    const [isOpen, setIsOpen] = useState(false)
    const getIsDrag = () => dragAccount === idx
    const [isDrag, setIsDrag] = useState(getIsDrag())
    const [timer, setTimer] = useState<NodeJS.Timeout | null>(null)

    const [isEditPw, setIsEditPw] = useState(false)
    const { t } = useTranslation("common")
    useEffect(() => {
        setIsDrag(getIsDrag())
    }, [dragAccount])
    return (
        <div
            onTouchStart={(e: any) => {
                setMousePos({
                    x: e.touches[0].pageX,
                    y: e.touches[0].pageY,
                })
                setTimer(
                    setTimeout(() => {
                        setDragAccount(idx)
                        setTimer(null)
                        const itemHeight = 56 + 10
                        setMoveY(Math.floor((e.touches[0].pageY - e.target.parentElement.offsetTop + itemHeight / 2) / itemHeight))
                    }, 300),
                )
            }}
            onTouchMove={(e: any) => {
                setMousePos({
                    x: e.touches[0].pageX,
                    y: e.touches[0].pageY,
                })
                const itemHeight = 56 + 10
                setMoveY(Math.floor((e.touches[0].pageY - e.target.parentElement.offsetTop + itemHeight / 2) / itemHeight))
            }}
            onTouchEnd={(e) => {
                if (timer !== null) {
                    clearTimeout(timer)
                    setTimer(null)
                }
                if (isDrag === true) {
                    setIsOpen(false)
                    moveItemIdx(idx)
                }
                setDragAccount(null)
            }}
            className={classNames(styles["account-card"], {
                [styles["account-card--drag-hover"]]: !isDrag && isHover && dragAccount !== idx - 1,
                [styles["account-card--drag-hover-last"]]: !isDrag && isHoverTop,
            })}
        >
            <div
                className={classNames(styles["account-card__header"], {
                    [styles["account-card__header--ghost"]]: isDrag,
                })}
                onClick={() => {
                    setIsOpen(!isOpen)
                }}
            >
                <h2 className={styles["account-card__title"]}>
                    {account.id} / {account.address}
                </h2>
                <Button
                    onClick={onClickDel}
                    icon={
                        <i className="xi-trash">
                            <span className="ir">delete</span>
                        </i>
                    }
                ></Button>
            </div>
            <div
                className={classNames(styles["account-card__con"], {
                    [styles["account-card__con--show"]]: isOpen && dragAccount === null,
                })}
            >
                <span>최종 수정일: {account.modifiedAt}</span>
                <Input
                    type="password"
                    onClick={(e) => {
                        if (!isEditPw) {
                            if (!window.ReactNativeWebView) {
                                alert("ReactNativeWebView 객체가 없습니다.")
                                return
                            }
                            window.ReactNativeWebView.postMessage(
                                JSON.stringify({
                                    type: RN_API.SET_COPY,
                                    data: {
                                        text: account.pw,
                                    },
                                }),
                            )
                            // if (navigator.clipboard && window.isSecureContext) {
                            //     navigator.clipboard.writeText(account.pw).then(() => {
                            //         alert("copy!")
                            //     }).catch((e)=>{
                            //         alert(e)
                            //     })
                            // } else {
                            //     alert("navigator.clipboard 메소드가 없습니다.")
                            // }
                        }
                    }}
                    onChange={(e) => {
                        setNewPw(e.target.value || "")
                    }}
                    value={newPw}
                    readOnly={!isEditPw}
                />
                <Button
                    onClick={() => {
                        setNewPw(account.pw)
                        setIsEditPw(!isEditPw)
                    }}
                    show={isEditPw}
                    icon={<i className="xi-close-circle"></i>}
                ></Button>
                <Button
                    onClick={() => {
                        onClickMod({
                            ...account,
                            pw: newPw,
                        })
                        setIsEditPw(!isEditPw)
                    }}
                    show={isEditPw}
                    icon={<i className="xi-save"></i>}
                ></Button>
                <Button
                    onClick={() => {
                        setIsEditPw(!isEditPw)
                    }}
                    show={!isEditPw}
                    icon={<i className="xi-pen"></i>}
                ></Button>
            </div>
        </div>
    )
}
export default AccountCard
