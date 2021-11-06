// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { Header, Search, Title, Space, Button, AccountCard, DragCard } from "@Components"
import { RootState, AcFileActions } from "@Redux"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useRouter } from "next/router"
import { AcFile, Account } from "@Interfaces"
import { RN_API } from "@Definitions"
// #endregion Local Imports

declare global {
    interface Window {
        ReactNativeWebView: any
    }
}

const Page = (): JSX.Element => {
    const { t, i18n } = useTranslation("common")
    const router = useRouter()
    const dispatch = useDispatch()
    const { app, acFile } = useSelector(({ appReducer, acFileReducer }: RootState) => ({
        app: appReducer,
        acFile: acFileReducer,
    }))
    const [search, setSearch] = useState("")
    const [filterText, setFilterText] = useState("")
    const [dragAccount, setDragAccount] = useState<number | null>(null)
    const [moveY, setMoveY] = useState<number>(0)
    const [mousePos, setMousePos] = useState({
        x: 0,
        y: 0,
    })

    // const testList = [
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         address: "1",
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         address: "2",
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         address: "3",
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         address: "4",
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    // ]

    const createAccount = ({ address, id, pw }: Pick<Account, "address" | "id" | "pw">) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_FILE,
                data: {
                    contents: [...acFile.list, { address, id, pw, modifiedAt: new Date(), createdAt: new Date() }],
                    pincode: acFile.pincode,
                },
            }),
        )
    }
    const modifyAccount = (account: Account) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        const newList = acFile.list.filter((acInfo) => {
            return acInfo.address !== account.address || acInfo.id !== account.id
        })
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_FILE,
                data: {
                    contents: [...newList, { ...account, modifiedAt: new Date() }],
                    pincode: acFile.pincode,
                },
            }),
        )
    }
    const deleteAccount = ({ address, id }: Account) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        const newList = acFile.list.filter((account) => {
            return account.address !== address || account.id !== id
        })
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_FILE,
                data: {
                    contents: newList,
                    pincode: acFile.pincode,
                },
            }),
        )
    }

    const moveItemIdx = (idx: number) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        if (dragAccount === null) return
        const moveIdx = (() => {
            const newIdx = dragAccount + moveY
            if (newIdx < 0) return 0
            if (acFile.list.length <= newIdx) return acFile.list.length - 1
            if (idx < newIdx) return newIdx - 1
            return newIdx
        })()
        // console.log(idx, moveIdx)
        if (idx === moveIdx) return
        const account = getShowAccountList(acFile.list)[idx]
        const moveAccount = getShowAccountList(acFile.list)[moveIdx]

        const fromIdx = acFile.list.findIndex(({ address, id }) => address === account.address && id === account.id)
        const toIdx = acFile.list.findIndex(({ address, id }) => address === moveAccount.address && id === moveAccount.id)
        const moved = function (from: number, to: number, [...array]: any[], on = 1) {
            array.splice(to, 0, ...array.splice(from, on))
            return array
        }
        // console.log(moved(fromIdx, toIdx, acFile.list))
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_FILE,
                data: {
                    contents: moved(fromIdx, toIdx, acFile.list),
                    pincode: acFile.pincode,
                },
            }),
        )
    }
    const getShowAccountList = (list: Account[]) => {
        return list.filter(({ address, id }: Account) => {
            if (filterText === "") return true
            return address.includes(filterText) === true || id.includes(filterText) === true
        })
    }
    const isHover = (idx: number) => {
        if (dragAccount === null) return false
        const newIdx = dragAccount + moveY
        if (newIdx < 0) return 0 === idx
        return newIdx === idx
    }

    const listener = (event: any) => {
        const { data, type } = JSON.parse(event.data)
        switch (type) {
            case RN_API.SET_FILE: {
                // alert(data + "/" + typeof data)
                if (data === false) {
                    alert("파일 수정 실패")
                    return
                }
                dispatch(
                    AcFileActions.setInfo({
                        list: data,
                    }),
                )
                break
            }
            case RN_API.SET_COPY: {
                if (data === false) {
                    alert("복사 실패")
                    return
                }
                break
            }

            default: {
                break
            }
        }
    }
    useEffect(() => {
        if (window.ReactNativeWebView) {
            /** android */
            document.addEventListener("message", listener)
            /** ios */
            window.addEventListener("message", listener)
        } else {
            // 모바일이 아니라면 모바일 아님을 alert로 띄웁니다.
            // alert("모바일이 아닙니다.")
            console.log("모바일이 아닙니다.")
        }
        return () => {
            /** android */
            document.removeEventListener("message", listener)
            /** ios */
            window.removeEventListener("message", listener)
        }
    }, [])
    return (
        <>
            <Header title="계정 목록">
                <Button
                    href="/setting"
                    icon={
                        <i className="xi-cog">
                            <span className="ir">설정</span>
                        </i>
                    }
                ></Button>
            </Header>
            <Search
                value={search}
                setValue={setSearch}
                onSearch={() => {
                    setFilterText(search)
                }}
                onReset={() => {
                    setFilterText("")
                }}
            />
            <Space direction="column" padding="10px">
                {!acFile.list || acFile.list.length === 0 ? (
                    filterText === "" ? (
                        <span>아래의 +버튼을 통해 계정을 생성해주세요.</span>
                    ) : (
                        <span>검색된 계정 정보가 없습니다!</span>
                    )
                ) : (
                    getShowAccountList(acFile.list).map((account: Account, idx: number) => {
                        return (
                            <AccountCard
                                idx={idx}
                                isHover={isHover(idx)}
                                isHoverTop={isHover(idx + 1)}
                                moveItemIdx={moveItemIdx}
                                account={account}
                                setMoveY={setMoveY}
                                dragAccount={dragAccount}
                                setDragAccount={setDragAccount}
                                setMousePos={setMousePos}
                                onClickDel={(e) => {
                                    e.stopPropagation()
                                    if (confirm("삭제하시겠습니까?") === false) {
                                        return
                                    }
                                    deleteAccount(account)
                                }}
                                onClickMod={(newAccount) => {
                                    modifyAccount(newAccount)
                                }}
                            ></AccountCard>
                        )
                    })
                )}

                {/* {getShowAccountList(testList).map((account: Account, idx: number) => {
                    return (
                        <AccountCard
                            idx={idx}
                            isHover={isHover(idx)}
                            isHoverTop={isHover(idx + 1) && idx === getShowAccountList(testList).length - 1}
                            moveItemIdx={moveItemIdx}
                            account={account}
                            setMoveY={setMoveY}
                            dragAccount={dragAccount}
                            setDragAccount={setDragAccount}
                            setMousePos={setMousePos}
                            onClickDel={(e) => {
                                e.stopPropagation()
                                if (confirm("삭제하시겠습니까?") === false) {
                                    return
                                }
                                deleteAccount(account)
                            }}
                            onClickMod={(newAccount) => {
                                modifyAccount(newAccount)
                            }}
                        ></AccountCard>
                    )
                })} */}
            </Space>
            <DragCard mousePos={mousePos} isShow={dragAccount !== null}></DragCard>
            <Button
                onClick={() => {
                    const address = prompt("사이트명 입력")
                    if (address === null) return
                    const id = prompt("id 입력")
                    if (id === null) return
                    const pw = prompt("pw 입력")
                    if (pw === null) return
                    createAccount({ address, id, pw })
                }}
                type="primary"
                shape="circle"
                size="lg"
                fixed
                icon={
                    <i className="xi-plus-min">
                        <span className="ir">새로 만들기</span>
                    </i>
                }
            ></Button>
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
    },
})
export default Page
