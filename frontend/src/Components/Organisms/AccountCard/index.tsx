// #region Global Imports
import { Dispatch, MouseEventHandler, ReactNode, SetStateAction, TouchEventHandler, useEffect, useState } from "react"
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
    setMoveY: Dispatch<SetStateAction<number>>
}
const AccountCard = (props: Props): JSX.Element => {
    const { idx, isHover, isHoverTop, account, moveItemIdx, children, onClick, onClickDel, onClickMod, dragAccount, setDragAccount, setMoveY, mousePos, setMousePos } = props
    const [newPw, setNewPw] = useState(account.pw)
    const [isOpen, setIsOpen] = useState(false)
    const getIsDrag = () => dragAccount === idx
    const [isDrag, setIsDrag] = useState(getIsDrag())
    const [timer, setTimer] = useState<NodeJS.Timeout | null>(null)
    const [scroller, setScroller] = useState<NodeJS.Timeout | null>(null)
    const [scrollerState, setScrollerState] = useState<number | null>(null)
    const [startPos, setStartPos] = useState({
        x: 0,
        y: 0,
    })

    const [isEditPw, setIsEditPw] = useState(false)
    const { t } = useTranslation("common")
    useEffect(() => {
        setIsDrag(getIsDrag())
    }, [dragAccount])
    return (
        <div
            onTouchStart={(e: any) => {
                const wrap = document.querySelector(".l_wrap") as HTMLDivElement
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
                        if (Math.abs(startPos.x - mousePos.x) > 0 || Math.abs(startPos.y - mousePos.y) > 0) return
                        wrap.style.touchAction = "none"
                        setDragAccount(idx)
                        setTimer(null)
                        const itemHeight = 56 + 10
                        const offsetTop = e.target.localName === "div" ? e.target.parentElement.offsetTop : e.target.parentElement.parentElement.offsetTop
                        setMoveY(Math.floor((e.touches[0].pageY + wrap.scrollTop - offsetTop + itemHeight / 2) / itemHeight))
                    }, 300),
                )
            }}
            onTouchMove={(e: any) => {
                const wrap = document.querySelector(".l_wrap") as HTMLDivElement
                if (!wrap) return
                setMousePos({
                    x: e.touches[0].pageX,
                    y: e.touches[0].pageY,
                })
                if (dragAccount === null) return
                const itemHeight = 56 + 10
                const offsetTop = e.target.localName === "div" ? e.target.parentElement.offsetTop : e.target.parentElement.parentElement.offsetTop
                setMoveY(Math.floor((e.touches[0].pageY + wrap.scrollTop - offsetTop + itemHeight / 2) / itemHeight))

                if (wrap) {
                    console.log(scrollerState)
                    if (mousePos.y < window.outerHeight * 0.2) {
                        if (scrollerState !== 1) {
                            if (scroller !== null) {
                                clearInterval(scroller)
                            }
                            setScrollerState(1)
                            setScroller(
                                setInterval(() => {
                                    wrap.scrollTop -= 8
                                }, 10),
                            )
                        }
                    } else if (mousePos.y < window.outerHeight * 0.4) {
                        if (scrollerState !== 2) {
                            if (scroller !== null) {
                                clearInterval(scroller)
                            }
                            setScrollerState(2)
                            setScroller(
                                setInterval(() => {
                                    wrap.scrollTop -= 2
                                }, 10),
                            )
                        }
                    } else if (window.outerHeight * 0.8 < mousePos.y) {
                        if (scrollerState !== 3) {
                            if (scroller !== null) {
                                clearInterval(scroller)
                            }
                            setScrollerState(3)
                            setScroller(
                                setInterval(() => {
                                    wrap.scrollTop += 8
                                }, 10),
                            )
                        }
                    } else if (window.outerHeight * 0.6 < mousePos.y) {
                        if (scrollerState !== 4) {
                            if (scroller !== null) {
                                clearInterval(scroller)
                            }
                            setScrollerState(4)
                            setScroller(
                                setInterval(() => {
                                    wrap.scrollTop += 2
                                }, 10),
                            )
                        }
                    } else if (scrollerState !== null) {
                        setScrollerState(null)
                        if (scroller !== null) {
                            clearInterval(scroller)
                        }
                    }
                }
            }}
            onTouchEnd={(e) => {
                const wrap = document.querySelector(".l_wrap") as HTMLDivElement
                if (!wrap) return
                wrap.style.touchAction = ""
                if (timer !== null) {
                    clearTimeout(timer)
                    setTimer(null)
                }
                if (scroller !== null) {
                    clearInterval(scroller)
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
                    {account.id} / {account.siteName}
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
                <Space vAlign="flex-start" direction="column" padding="10px">
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
                </Space>
            </div>
        </div>
    )
}
export default AccountCard
