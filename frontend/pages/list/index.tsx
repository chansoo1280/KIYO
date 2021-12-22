// #region Global Imports
import { useCallback, useMemo, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
// #endregion Global Imports

// #region Local Imports
import { Header, Search, Space, Button, ConfirmModal, Tag, Radio, Sticky, AccountList } from "@Components"
import { RootState, AcFileActions } from "@Redux"
import { AcFile, Account, sortType } from "@Interfaces"
import { RN_API } from "@Definitions"
import { WebViewMessage } from "@Services"
// #endregion Local Imports

interface Tag {
    name: string
    isSelected: boolean
}
const Page = (): JSX.Element => {
    const { t, i18n } = useTranslation("common")
    const router = useRouter()
    const dispatch = useDispatch()
    const { acFile } = useSelector(({ acFileReducer }: RootState) => ({
        acFile: acFileReducer,
    }))
    const [search, setSearch] = useState("")
    const [filterText, setFilterText] = useState("")
    const [tagList, setTagList] = useState<Tag[]>(
        acFile.tags.map((tag) => ({
            name: tag,
            isSelected: false,
        })),
    )
    const sortList = [
        {
            name: "사이트명",
            value: sortType.siteName,
        },
        {
            name: "최종수정일",
            value: sortType.modifiedAt,
        },
        {
            name: "최종복사일",
            value: sortType.copiedAt,
        },
    ]
    const [sortModal, setSortModal] = useState<{
        show: boolean
        selSortType: sortType
    }>({
        show: false,
        selSortType: acFile.sortType,
    })
    const getShowTagList = (list: Tag[]) => {
        const tags = getShowAccountList(acFile.list).reduce((acc: string[], cur) => acc.concat(cur.tags), [])
        return list
            .filter(({ name }) => tags.includes(name))
            .sort((a, b) => (a.name > b.name ? -1 : a.name < b.name ? 1 : 0)) // 이름순 정렬 ㄱㄴㄷ
            .sort((a, b) => (isNaN(Number(a.name)) ? -1 : isNaN(Number(b.name)) ? 1 : 0)) // 숫자는 뒤로
            .sort((a, b) => Number(b.isSelected) - Number(a.isSelected)) // 선택된 태그를 앞으로
            .slice(0, 6)
    }
    const setSortType = async (sortType: AcFile["sortType"]) => {
        const data = await WebViewMessage<typeof RN_API.SET_SORTTYPE>(RN_API.SET_SORTTYPE, {
            sortType: sortType,
        }).catch(() => null)
        if (data === null) return
        dispatch(
            AcFileActions.setInfo({
                sortType: sortType,
            }),
        )
    }
    // const setFile = (data: Account[]) => {
    //     const tags = data.reduce((acc: string[], cur) => acc.concat(cur.tags), [])
    //     dispatch(
    //         AcFileActions.setInfo({
    //             list: data,
    //             tags: Array.from(new Set(tags)),
    //         }),
    //     )
    // }
    // const reqCopyPw = async (account: Account) => {
    //     const data = await WebViewMessage<typeof RN_API.SET_COPY>(RN_API.SET_COPY, {
    //         text: account.pw,
    //     }).catch(() => null)
    //     if (data === null) return
    //     const data2 = await WebViewMessage<typeof RN_API.SET_FILE>(RN_API.SET_FILE, {
    //         list: [
    //             ...acFile.list.filter(({ idx }) => idx !== account.idx),
    //             {
    //                 ...account,
    //                 copiedAt: String(new Date()),
    //             },
    //         ],
    //         pincode: acFile.pincode,
    //     }).catch(() => null)
    //     if (data2 === null) return
    //     if (data2 === false) {
    //         alert("파일 수정 실패")
    //         return
    //     }
    //     setFile(data2)
    // }
    // const testList = undefined
    const testList: Account[] = [
        {
            idx: 1,
            id: "123",
            pw: "12341312",
            siteName: "구글(Google)",
            tags: ["금융"],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 2,
            id: "123",
            pw: "12341312",
            siteName: "네이버(Naver)",
            tags: ["게임"],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 3,
            id: "123",
            pw: "12341312",
            siteName: "다음(Daum)",
            tags: [],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 4,
            id: "123",
            pw: "12341312",
            siteName: "마이크로소프트(Microsoft)",
            tags: [],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 5,
            id: "123",
            pw: "12341312",
            siteName: "5",
            tags: ["금융"],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 6,
            id: "123",
            pw: "12341312",
            siteName: "6",
            tags: ["게임"],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 7,
            id: "123",
            pw: "12341312",
            siteName: "7",
            tags: [],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 8,
            id: "123",
            pw: "12341312",
            siteName: "8",
            tags: [],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 9,
            id: "123",
            pw: "12341312",
            siteName: "9",
            tags: ["금융"],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 10,
            id: "123",
            pw: "12341312",
            siteName: "10",
            tags: ["게임"],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 11,
            id: "123",
            pw: "12341312",
            siteName: "11",
            tags: [],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 12,
            id: "123",
            pw: "12341312",
            siteName: "12",
            tags: [],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 13,
            id: "123",
            pw: "12341312",
            siteName: "13",
            tags: ["금융"],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 14,
            id: "123",
            pw: "12341312",
            siteName: "14",
            tags: ["게임"],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 15,
            id: "123",
            pw: "12341312",
            siteName: "15",
            tags: [],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
        {
            idx: 16,
            id: "123",
            pw: "12341312",
            siteName: "16",
            tags: [],
            modifiedAt: String(new Date()),
            createdAt: String(new Date()),
            copiedAt: "",
        },
    ]

    const getShowAccountList = (list: Account[]) => {
        const selectedTagList = tagList.filter(({ isSelected }) => isSelected === true)
        const showList = list
            .filter(({ siteName }) => filterText === "" || siteName.toLowerCase().includes(filterText.toLowerCase())) // filterText 체크
            .filter(({ tags }) => !selectedTagList.length || !selectedTagList.find(({ name }) => !tags.includes(name))) // tags 체크
            .sort((a, b) => (a[acFile.sortType] < b[acFile.sortType] ? -1 : a[acFile.sortType] > b[acFile.sortType] ? 1 : 0))
        return acFile.sortType === sortType.modifiedAt || acFile.sortType === sortType.copiedAt ? showList.reverse() : showList
    }
    const accountList = useMemo(() => {
        return getShowAccountList(testList || acFile.list)
    }, [acFile, filterText, tagList])
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
            <Space padding="166px 16px 0" background="url(/static/images/bg_list.png)no-repeat right/auto 165px"></Space>
            <Sticky top="10px">
                <Search id="search" value={search} setValue={setSearch} onSearch={setFilterText} recommendList={acFile.list.map(({ siteName }) => siteName)}>
                    <Button
                        size="lg"
                        type="default"
                        shape="round"
                        onClick={() => {
                            setSortModal({
                                show: true,
                                selSortType: acFile.sortType,
                            })
                        }}
                        icon={
                            <i className="xi-filter">
                                <span className="ir">필터</span>
                            </i>
                        }
                    ></Button>
                </Search>
            </Sticky>
            {acFile.list && acFile.list.length !== 0 && (
                <Tag gap="10px">
                    {getShowTagList(tagList).map(({ name, isSelected }) => (
                        <Tag.Item
                            key={name}
                            onClick={() => {
                                setTagList((prevState) =>
                                    prevState.map((tagInfo) => ({
                                        ...tagInfo,
                                        isSelected: tagInfo.name === name ? !tagInfo.isSelected : tagInfo.isSelected,
                                    })),
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
            <AccountList list={accountList} filterText={filterText}></AccountList>

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
            <ConfirmModal
                title="정렬"
                show={sortModal.show}
                okButtonProps={{
                    onClick: async () => {
                        await setSortType(sortModal.selSortType)
                        setSortModal((prevState) => ({
                            ...prevState,
                            show: false,
                        }))
                    },
                }}
                cancelButtonProps={{
                    onClick: () => {
                        setSortModal((prevState) => ({
                            ...prevState,
                            show: false,
                        }))
                    },
                }}
            >
                <Space align="center" direction="column">
                    {sortList.map(({ name, value }) => (
                        <Radio
                            key={"selSortType_" + value}
                            id={"selSortType_" + value}
                            name="selSortType"
                            value={value}
                            checked={sortModal.selSortType === value}
                            onChange={(e) => {
                                setSortModal((prevState) => ({
                                    ...prevState,
                                    selSortType: value,
                                }))
                            }}
                        >
                            {name}
                        </Radio>
                    ))}
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
