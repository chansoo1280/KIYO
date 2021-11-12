// #region Global Imports
import { Dispatch, MouseEventHandler, ReactNode, SetStateAction, useEffect, useRef, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./AccountCard.module.scss"
import { Button, Input, Space } from "@Components"
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
    mousePos: {
        x: number
        y: number
    }
    setMousePos: Dispatch<
        SetStateAction<{
            x: number
            y: number
        }>
    >
    setScrollMove: Dispatch<SetStateAction<number>>
    setMoveY: Dispatch<SetStateAction<number>>
}
const AccountCard = (props: Props): JSX.Element => {
    const { idx, isHover, isHoverTop, account, moveItemIdx, children, onClick, onClickDel, onClickMod, dragAccount, setDragAccount, setMoveY, mousePos, setMousePos, setScrollMove } = props
    const wrapRef = useRef<HTMLDivElement>(null)
    const [newPw, setNewPw] = useState(account.pw)
    const [isOpen, setIsOpen] = useState(false)
    const [timer, setTimer] = useState<NodeJS.Timeout | null>(null)
    const [scroller, setScroller] = useState<NodeJS.Timeout | null>(null)
    const [scrollerState, setScrollerState] = useState<number | null>(null)
    const [startPos, setStartPos] = useState({
        x: 0,
        y: 0,
    })

    const [isEditPw, setIsEditPw] = useState(false)
    const { t } = useTranslation("common")
    const handleTouchMove = (e: any) => {
        const wrap = document.querySelector("#wrap") as HTMLDivElement
        if (!wrap) return
        const tempMousePos = {
            x: e.touches[0].pageX,
            y: e.touches[0].pageY,
        }
        setMousePos(tempMousePos)
        if (dragAccount === null) return
        e.preventDefault()
        const itemHeight = 84 + 22
        const offsetTop = e.target.localName === "div" ? e.target.parentElement.offsetTop : e.target.parentElement.parentElement.offsetTop
        setMoveY(Math.floor((e.touches[0].pageY + wrap.scrollTop - offsetTop + itemHeight / 2) / itemHeight))
    }
    useEffect(() => {
        console.log("addEventListener")
        wrapRef.current?.addEventListener("touchmove", handleTouchMove, { passive: false })
        return () => {
            wrapRef.current?.removeEventListener("touchmove", handleTouchMove)
        }
    }, [dragAccount])
    return (
        <div
            ref={wrapRef}
            onClick={onClick}
            onTouchStart={(e: any) => {
                const wrap = document.querySelector("#wrap") as HTMLDivElement
                if (!wrap) return
                setStartPos({
                    x: e.touches[0].pageX,
                    y: e.touches[0].pageY,
                })
                setMousePos({
                    x: e.touches[0].pageX,
                    y: e.touches[0].pageY,
                })
                setTimer(
                    setTimeout(() => {
                        if (Math.abs(startPos.x - mousePos.x) > 60 || Math.abs(startPos.y - mousePos.y) > 60) return
                        wrap.style.touchAction = "none"
                        setDragAccount(idx)
                        setTimer(null)
                        const itemHeight = 84 + 22
                        const offsetTop = e.target.localName === "div" ? e.target.parentElement.offsetTop : e.target.parentElement.parentElement.offsetTop
                        setMoveY(Math.floor((e.touches[0].pageY + wrap.scrollTop - offsetTop + itemHeight / 2) / itemHeight))
                    }, 300),
                )
            }}
            onTouchEnd={(e) => {
                const wrap = document.querySelector("#wrap") as HTMLDivElement
                if (!wrap) return
                wrap.style.touchAction = ""
                console.log(timer)
                if (timer !== null) {
                    clearTimeout(timer)
                    setTimer(null)
                }
                if (scroller !== null) {
                    clearInterval(scroller)
                }
                if ((dragAccount === idx) === true) {
                    setIsOpen(false)
                    moveItemIdx(idx)
                }
                setDragAccount(null)
            }}
            className={classNames(styles["account-card"], {
                [styles["account-card--ghost"]]: dragAccount === idx,
                [styles["account-card--drag-hover"]]: !(dragAccount === idx) && isHover && dragAccount !== idx - 1,
                [styles["account-card--drag-hover-last"]]: !(dragAccount === idx) && isHoverTop,
            })}
        >
            <div
                className={classNames(styles["account-card__header"])}
                // onClick={() => {
                //     setIsOpen(!isOpen)
                // }}
            >
                <h2 className={styles["account-card__title"]}>{account.siteName}</h2>
                <Button
                    onClick={onClickDel}
                    icon={
                        <i className="xi-documents">
                            <span className="ir">copy</span>
                        </i>
                    }
                ></Button>
                <Button
                    onClick={onClickDel}
                    icon={
                        <i className="xi-pen">
                            <span className="ir">modify</span>
                        </i>
                    }
                ></Button>
            </div>
            <div className={classNames(styles["account-card__con"])}>
                {account.id} /{" "}
                {account.pw
                    .split("")
                    .map(() => "*")
                    .join("")}
                {/* <Space vAlign="flex-start" direction="column" padding="10px">
                    <span>최종 수정일: {account.modifiedAt}</span>
                    <Space>
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
                    </Space>
                    <Space>{account.tags.map((tag, idx) => "#" + tag + " ")}</Space>
                </Space> */}
            </div>
        </div>
    )
}
export default AccountCard
