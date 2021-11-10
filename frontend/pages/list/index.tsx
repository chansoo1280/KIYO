// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { Header, Search, Title, Space, Button, AccountCard, DragCard, ConfirmModal, Input, Tag, RecommendInput } from "@Components"
import { RootState, AcFileActions } from "@Redux"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useRouter } from "next/router"
import { AcFile, Account } from "@Interfaces"
import { RN_API } from "@Definitions"
import { WebViewMessage } from "@Services"
// #endregion Local Imports

declare global {
    interface Window {
        ReactNativeWebView: any
    }
}
type SetFile = (arg0: Account[] | false) => void

const useAccount = (acFile: AcFile, setFile: SetFile) => {
    const createAccount = async ({ siteName, siteLink, id, pw, tags }: Pick<Account, "siteName" | "siteLink" | "id" | "pw" | "tags">) => {
        const data = await WebViewMessage(RN_API.SET_FILE, {
            contents: [...acFile.list, { siteName, siteLink, id, pw, tags, modifiedAt: new Date(), createdAt: new Date() }],
            pincode: acFile.pincode,
        })
        if (data === null) return
        setFile(data)
    }
    const modifyAccount = async (account: Account) => {
        const newList = acFile.list.filter((acInfo) => acInfo.siteName !== account.siteName || acInfo.id !== account.id)
        const data = await WebViewMessage(RN_API.SET_FILE, {
            contents: [...newList, { ...account, modifiedAt: new Date() }],
            pincode: acFile.pincode,
        })
        if (data === null) return
        setFile(data)
    }
    const deleteAccount = async ({ siteName, id }: Account) => {
        const newList = acFile.list.filter((account) => account.siteName !== siteName || account.id !== id)
        const data = await WebViewMessage(RN_API.SET_FILE, {
            contents: newList,
            pincode: acFile.pincode,
        })
        if (data === null) return
        setFile(data)
    }
    return { createAccount, modifyAccount, deleteAccount }
}

const useDragable = () => {
    const [dragAccount, setDragAccount] = useState<number | null>(null)
    const [moveY, setMoveY] = useState<number>(0)
    const [mousePos, setMousePos] = useState({
        x: 0,
        y: 0,
    })
    const isHover = (idx: number) => {
        if (dragAccount === null) return false
        const newIdx = dragAccount + moveY
        if (newIdx < 0) return 0 === idx
        return newIdx === idx
    }
    const getMovedList = (from: number, to: number, [...array]: any[], on = 1) => {
        array.splice(to, 0, ...array.splice(from, on))
        return array
    }
    return { dragAccount, moveY, mousePos, setDragAccount, setMoveY, setMousePos, isHover, getMovedList }
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
    interface ModelCreateAccount extends Pick<Account, "siteName" | "siteLink" | "id" | "pw" | "tags"> {
        show: boolean
        inputTag: string
    }
    const [modelCreateAccount, setModelCreateAccount] = useState<ModelCreateAccount>({
        show: false,
        inputTag: "",
        siteName: "",
        siteLink: "",
        id: "",
        pw: "",
        tags: [],
    })
    const setFile = (data: Account[] | false) => {
        if (data === false) {
            alert("파일 수정 실패")
            return
        }
        const tags = (data as Account[]).reduce((acc: string[], cur) => acc.concat(cur.tags), [])
        dispatch(
            AcFileActions.setInfo({
                list: data,
                tags: Array.from(new Set(tags)),
            }),
        )
    }
    const { createAccount, modifyAccount, deleteAccount } = useAccount(acFile, setFile)
    const { dragAccount, moveY, mousePos, setDragAccount, setMoveY, setMousePos, isHover, getMovedList } = useDragable()

    const [tagList, setTagList] = useState(
        acFile.tags
            .map((tag) => ({
                name: tag,
                isSelected: false,
            }))
            .sort((a, b) => Number(b.isSelected) - Number(a.isSelected))
            .slice(0, 5),
    )

    useEffect(() => {
        setTagList(
            acFile.tags
                .map((tag) => {
                    const info = tagList.find(({ name }) => name === tag)
                    return {
                        name: tag,
                        isSelected: (info && info.isSelected) || false,
                    }
                })
                .sort((a, b) => Number(b.isSelected) - Number(a.isSelected))
                .slice(0, 5),
        )
    }, [acFile.tags])

    // const testList = [
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "1",
    //         tags: ["금융"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "2",
    //         tags: ["게임"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "3",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "4",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "1",
    //         tags: ["금융"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "2",
    //         tags: ["게임"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "3",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "4",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "1",
    //         tags: ["금융"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "2",
    //         tags: ["게임"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "3",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "4",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "1",
    //         tags: ["금융"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "2",
    //         tags: ["게임"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "3",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "4",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    // ]

    const moveItemIdx = async (idx: number) => {
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
        if (!account || !moveAccount) return

        const fromIdx = acFile.list.findIndex(({ siteName, id }) => siteName === account.siteName && id === account.id)
        const toIdx = acFile.list.findIndex(({ siteName, id }) => siteName === moveAccount.siteName && id === moveAccount.id)
        // console.log(getMovedList(fromIdx, toIdx, acFile.list))
        const data = await WebViewMessage(RN_API.SET_FILE, {
            contents: getMovedList(fromIdx, toIdx, acFile.list),
            pincode: acFile.pincode,
        })
        if (data === null) return
        setFile(data)
    }
    const getShowAccountList = (list: Account[]) => {
        const selectedTagList = tagList.filter(({ isSelected }) => isSelected === true)
        return list
            .filter(({ siteName }: Account) => {
                if (filterText === "") return true
                return siteName.includes(filterText) === true
            })
            .filter(({ tags }: Account) => {
                if (selectedTagList.length === 0) return true
                return !selectedTagList.find(({ name }) => !tags.includes(name))
            })
    }
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
            <Search value={search} setValue={setSearch} searchValue={filterText} onSearch={setFilterText} />
            {acFile.list && acFile.list.length !== 0 && (
                <Tag gap="10px">
                    {tagList.map(({ name, isSelected }: { name: string; isSelected: boolean }) => (
                        <Tag.Item
                            key={name}
                            onClick={() => {
                                setTagList(
                                    tagList
                                        .map((tagInfo) => ({
                                            ...tagInfo,
                                            isSelected: tagInfo.name === name ? !tagInfo.isSelected : tagInfo.isSelected,
                                        }))
                                        .sort((a, b) => Number(b.isSelected) - Number(a.isSelected))
                                        .slice(0, 5),
                                )
                            }}
                            onDelete={
                                isSelected
                                    ? () => {
                                          true
                                      }
                                    : undefined
                            }
                            isSelected={isSelected}
                        >
                            {name}
                        </Tag.Item>
                    ))}
                </Tag>
            )}

            <Space direction="column" padding="10px">
                {!acFile.list || acFile.list.length === 0 ? (
                    filterText === "" ? (
                        <span>아래의 +버튼을 통해 계정을 생성해주세요.</span>
                    ) : (
                        <span>검색된 계정 정보가 없습니다!</span>
                    )
                ) : (
                    getShowAccountList(acFile.list).map((account: Account, idx: number) => (
                        <AccountCard
                            key={account.siteName + "_" + account.id}
                            idx={idx}
                            isHover={isHover(idx)}
                            isHoverTop={isHover(idx + 1) && idx === getShowAccountList(acFile.list).length - 1}
                            moveItemIdx={moveItemIdx}
                            account={account}
                            setMoveY={setMoveY}
                            dragAccount={dragAccount}
                            setDragAccount={setDragAccount}
                            mousePos={mousePos}
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
                    ))
                )}

                {/* {getShowAccountList(testList).map((account: Account, idx: number) => (
                    <AccountCard
                        idx={idx}
                        isHover={isHover(idx)}
                        isHoverTop={isHover(idx + 1) && idx === getShowAccountList(testList).length - 1}
                        moveItemIdx={moveItemIdx}
                        account={account}
                        setMoveY={setMoveY}
                        dragAccount={dragAccount}
                        setDragAccount={setDragAccount}
                        mousePos={mousePos}
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
                ))} */}
            </Space>
            <DragCard mousePos={mousePos} isShow={dragAccount !== null}></DragCard>
            <Button
                onClick={() => {
                    setModelCreateAccount({
                        ...modelCreateAccount,
                        show: true,
                        inputTag: "",
                        siteName: "",
                        siteLink: "",
                        id: "",
                        pw: "",
                        tags: [],
                    })
                    // const siteName = prompt("사이트명 입력")
                    // if (siteName === null) return
                    // const id = prompt("id 입력")
                    // if (id === null) return
                    // const pw = prompt("pw 입력")
                    // if (pw === null) return
                    // createAccount({ siteName, id, pw })
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
            <ConfirmModal
                show={modelCreateAccount.show}
                title="계정 정보 생성"
                onClickOk={() => {
                    createAccount(modelCreateAccount)
                    setModelCreateAccount({
                        ...modelCreateAccount,
                        show: false,
                    })
                }}
                onClickCancel={() => {
                    setModelCreateAccount({
                        ...modelCreateAccount,
                        show: false,
                    })
                }}
            >
                <Space direction="column" vAlign="flex-start" cover padding="20px 10px 0">
                    <div>
                        <label htmlFor="inputSiteName">사이트명</label>
                        <RecommendInput
                            onClick={(word) => {
                                setModelCreateAccount({
                                    ...modelCreateAccount,
                                    siteName: word,
                                })
                            }}
                            value={modelCreateAccount.siteName}
                            recommendList={Array.from(
                                new Set(
                                    ["구글(google)", "네이버(naver)", "다음(daum)", "카카오(kakao)", "네이트(nate)"].concat(
                                        acFile.list.map((account) => {
                                            return account.siteName
                                        }),
                                    ),
                                ),
                            )}
                        >
                            <Input
                                id="inputSiteName"
                                value={modelCreateAccount.siteName}
                                onChange={(e) => {
                                    setModelCreateAccount({
                                        ...modelCreateAccount,
                                        siteName: e.target.value,
                                    })
                                }}
                            />
                        </RecommendInput>
                    </div>
                    <div>
                        <label htmlFor="inputSiteLink">사이트링크</label>
                        <Input
                            id="inputSiteLink"
                            value={modelCreateAccount.siteLink}
                            onChange={(e) => {
                                setModelCreateAccount({
                                    ...modelCreateAccount,
                                    siteLink: e.target.value,
                                })
                            }}
                        />
                    </div>
                    <div>
                        <label htmlFor="inputId">아이디</label>
                        <Input
                            id="inputId"
                            value={modelCreateAccount.id}
                            onChange={(e) => {
                                setModelCreateAccount({
                                    ...modelCreateAccount,
                                    id: e.target.value,
                                })
                            }}
                        />
                    </div>
                    <div>
                        <label htmlFor="inputPw">비밀번호</label>
                        <Input
                            id="inputPw"
                            value={modelCreateAccount.pw}
                            onChange={(e) => {
                                setModelCreateAccount({
                                    ...modelCreateAccount,
                                    pw: e.target.value,
                                })
                            }}
                        />
                    </div>
                    <Button
                        onClick={() => {
                            const chars = ["0123456789", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz", "!@#$%^&*()-_=+"]
                            const charsStr = chars.join("")
                            const getRandomIdx = (length: number) => Math.floor(Math.random() * (length - 1))
                            const length = 12
                            const createdPw = ((): string => {
                                const str = []
                                for (let i = 0; i < chars.length; i++) {
                                    const innerChars = chars[i]
                                    str.push(innerChars[getRandomIdx(innerChars.length)])
                                }
                                for (let i = 0; i < chars.length; i++) {
                                    const innerChars = chars[i]
                                    str.push(innerChars[getRandomIdx(innerChars.length)])
                                }
                                const lestLen = length - str.length
                                for (let i = 0; i < lestLen; i++) {
                                    str.push(charsStr[getRandomIdx(charsStr.length)])
                                }
                                return str
                                    .sort(() => {
                                        return Math.random() - 0.5
                                    })
                                    .join("")
                            })()
                            setModelCreateAccount({
                                ...modelCreateAccount,
                                pw: createdPw,
                            })
                        }}
                    >
                        비밀번호 자동 생성
                    </Button>
                    <Button
                        onClick={() => {
                            const charsStr = "0123456789".split("")
                            const getRandomIdx = (length: number) => Math.floor(Math.random() * (length - 1))
                            const length = 6
                            const createdPw = ((): string => {
                                const str = []
                                for (let i = 0; i < length; i++) {
                                    const idx = getRandomIdx(charsStr.length)
                                    str.push(charsStr.splice(idx, 1))
                                    console.log(charsStr)
                                }
                                return str
                                    .sort(() => {
                                        return Math.random() - 0.5
                                    })
                                    .join("")
                            })()
                            setModelCreateAccount({
                                ...modelCreateAccount,
                                pw: createdPw,
                            })
                        }}
                    >
                        핀번호
                    </Button>
                    <Space direction="column" vAlign="flex-start" gap="0" margin="0">
                        <label htmlFor="inputTag">태그</label>
                        <Space>
                            <RecommendInput
                                onClick={(word) => {
                                    setModelCreateAccount({
                                        ...modelCreateAccount,
                                        inputTag: word,
                                    })
                                }}
                                value={modelCreateAccount.inputTag}
                                recommendList={Array.from(new Set(["즐겨찾기"].concat(acFile.tags)))}
                            >
                                <Input
                                    id="inputTag"
                                    value={modelCreateAccount.inputTag}
                                    onChange={(e) => {
                                        setModelCreateAccount({
                                            ...modelCreateAccount,
                                            inputTag: e.target.value,
                                        })
                                    }}
                                    onEnter={() => {
                                        if (modelCreateAccount.inputTag === "") return
                                        const isExist = modelCreateAccount.tags.find((tag) => modelCreateAccount.inputTag === tag)
                                        if (isExist) return
                                        setModelCreateAccount({
                                            ...modelCreateAccount,
                                            tags: [...(modelCreateAccount.tags || []), modelCreateAccount.inputTag],
                                            inputTag: "",
                                        })
                                    }}
                                />
                            </RecommendInput>
                            <Button
                                onClick={() => {
                                    if (modelCreateAccount.inputTag === "") return
                                    const isExist = modelCreateAccount.tags.find((tag) => modelCreateAccount.inputTag === tag)
                                    if (isExist) return
                                    setModelCreateAccount({
                                        ...modelCreateAccount,
                                        tags: [...(modelCreateAccount.tags || []), modelCreateAccount.inputTag],
                                        inputTag: "",
                                    })
                                }}
                                icon={
                                    <i className="xi-tag">
                                        <span className="ir">태그 추가</span>
                                    </i>
                                }
                            ></Button>
                        </Space>
                    </Space>
                    <div>
                        <Tag>
                            {modelCreateAccount.tags.map((tag, idx) => {
                                return (
                                    <Tag.Item
                                        key={tag}
                                        onDelete={() => {
                                            const list = modelCreateAccount.tags
                                            list.splice(idx, 1)
                                            setModelCreateAccount({
                                                ...modelCreateAccount,
                                                tags: list,
                                            })
                                        }}
                                    >
                                        {tag}
                                    </Tag.Item>
                                )
                            })}
                        </Tag>
                    </div>
                </Space>
            </ConfirmModal>
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
    },
})
export default Page
