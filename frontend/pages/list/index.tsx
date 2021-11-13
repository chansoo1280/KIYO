// #region Global Imports
import { RefObject, useEffect, useMemo, useRef, useState } from "react"
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

const Page = (props: any): JSX.Element => {
    const { t, i18n } = useTranslation("common")
    const router = useRouter()
    const dispatch = useDispatch()
    const { app, acFile } = useSelector(({ appReducer, acFileReducer }: RootState) => ({
        app: appReducer,
        acFile: acFileReducer,
    }))
    const [search, setSearch] = useState("")
    const [filterText, setFilterText] = useState("")
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
    //         idx: 1,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "1",
    //         tags: ["금융"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 2,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "2",
    //         tags: ["게임"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 3,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "3",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 4,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "4",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 5,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "5",
    //         tags: ["금융"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 6,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "6",
    //         tags: ["게임"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 7,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "7",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 8,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "8",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 9,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "9",
    //         tags: ["금융"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 10,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "10",
    //         tags: ["게임"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 11,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "11",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 12,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "12",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 13,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "13",
    //         tags: ["금융"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 14,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "14",
    //         tags: ["게임"],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 15,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "15",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    //     {
    //         idx: 16,
    //         id: "123",
    //         pw: "12341312",
    //         siteName: "16",
    //         tags: [],
    //         modifiedAt: String(new Date()),
    //         createdAt: String(new Date()),
    //     },
    // ]

    const getShowAccountList = (list: Account[]) => {
        const selectedTagList = tagList.filter(({ isSelected }) => isSelected === true)
        return list
            .filter(({ siteName }: Account) => filterText === "" || siteName.includes(filterText) === true)
            .filter(({ tags }: Account) => {
                if (selectedTagList.length === 0) return true
                return !selectedTagList.find(({ name }) => !tags.includes(name))
            })
    }
    return (
        <>
            <Header title={<img src="/static/images/logo.svg" alt="KIYO" />}>
                <Button
                    href="/setting"
                    icon={
                        <i className="xi-cog">
                            <span className="ir">설정</span>
                        </i>
                    }
                ></Button>
            </Header>
            <Space padding="136px 16px 0"></Space>
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

            <Space direction="column" padding="0 16px 36px" gap="22px">
                {!acFile.list || acFile.list.length === 0 ? (
                    filterText === "" ? (
                        <span>아래의 +버튼을 통해 계정을 생성해주세요.</span>
                    ) : (
                        <span>검색된 계정 정보가 없습니다!</span>
                    )
                ) : (
                    getShowAccountList(acFile.list).map((account: Account, idx: number) => (
                        <AccountCard
                            key={account.idx}
                            account={account}
                            onClickMod={(account) => {
                                router.push({
                                    pathname: "/modify",
                                    query: {
                                        idx: account.idx,
                                    },
                                })
                            }}
                        ></AccountCard>
                    ))
                )}

                {/* {getShowAccountList(testList).map((account: Account, idx: number) => (
                    <AccountCard
                        key={account.idx}
                        account={account}
                        onClickMod={(account) => {
                            router.push({
                                pathname: "/modify",
                                query: {
                                    idx: account.idx,
                                },
                            })
                        }}
                    ></AccountCard>
                ))} */}
            </Space>
            <Button
                onClick={() => {
                    router.push("/create", "/create")
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
