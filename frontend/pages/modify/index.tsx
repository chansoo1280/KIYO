// #region Global Imports
import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
// #endregion Global Imports

// #region Local Imports
import { Header, Space, Button, RecommendInput, Input, Tag } from "@Components"
import { AcFileActions, RootState } from "@Redux"
import { Account } from "@Interfaces"
import { RN_API, siteNameRecommendList, tagRecommendList } from "@Definitions"
import { WebViewMessage } from "@Services"
// #endregion Local Imports

const Page = (): JSX.Element => {
    const { t, i18n } = useTranslation("common")
    const router = useRouter()
    const dispatch = useDispatch()
    const { app, acFile } = useSelector(({ appReducer, acFileReducer }: RootState) => ({
        app: appReducer,
        acFile: acFileReducer,
    }))
    const newIdx = Number(router.query.idx)
    const account = acFile.list.find(({ idx }) => idx === newIdx)

    const [siteName, setSiteName] = useState(account?.siteName || "")
    const [siteLink, setSiteLink] = useState(account?.siteLink || "")
    const [id, setId] = useState(account?.id || "")
    const [pw, setPw] = useState(account?.pw || "")

    const [inputTag, setInputTag] = useState("")
    const [tags, setTags] = useState<string[]>(account?.tags || [])

    const setFile = (data: Account[]) => {
        const tags = data.reduce((acc: string[], cur) => acc.concat(cur.tags), [])
        dispatch(
            AcFileActions.setInfo({
                list: data,
                tags: Array.from(new Set(tags)),
            }),
        )
    }

    const deleteAccount = async () => {
        if (confirm("삭제하시겠습니까?") === false) {
            return
        }
        const data = await WebViewMessage<typeof RN_API.SET_FILE>(RN_API.SET_FILE, {
            list: [...acFile.list.filter(({ idx }) => idx !== newIdx)],
            pincode: acFile.pincode,
        })
        if (data === null) return
        if (data === false) {
            alert("파일 수정 실패")
            return
        }
        setFile(data)
        router.back()
    }

    const modifyAccount = async () => {
        if (siteName === "") {
            alert("사이트 명을 입력해주세요.")
            return
        }
        if (id === "") {
            alert("id를 입력해주세요.")
            return
        }
        if (pw === "") {
            alert("비밀번호를 입력해주세요.")
            return
        }
        const data = await WebViewMessage<typeof RN_API.SET_FILE>(RN_API.SET_FILE, {
            list: [
                ...acFile.list.filter(({ idx }) => idx !== newIdx),
                {
                    idx: newIdx,
                    siteName: siteName,
                    siteLink: siteLink,
                    id: id,
                    pw: pw,
                    tags: tags,
                    modifiedAt: new Date(),
                },
            ],
            pincode: acFile.pincode,
        })
        if (data === null) return
        if (data === false) {
            alert("파일 수정 실패")
            return
        }
        setFile(data)
        router.back()
    }

    return (
        <>
            <Header prefix={<Button onClick={() => router.back()} icon={<i className="xi-angle-left-min"></i>}></Button>} title="계정 정보 수정" centerTitle>
                <Button
                    type="text"
                    onClick={() => {
                        deleteAccount()
                    }}
                >
                    삭제
                </Button>
                <Button
                    type="text"
                    onClick={() => {
                        modifyAccount()
                    }}
                >
                    수정
                </Button>
            </Header>
            <Space direction="column" vAlign="flex-start" cover padding="20px 10px 0">
                <label htmlFor="inputSiteName">사이트명</label>
                <RecommendInput
                    cover
                    onClick={(word) => {
                        setSiteName(word)
                    }}
                    value={siteName}
                    recommendList={Array.from(new Set(siteNameRecommendList.concat(acFile.list.map(({ siteName }) => siteName))))}
                    inputProps={{
                        id: "inputSiteName",
                        value: siteName,
                        onChange: (e) => {
                            setSiteName(e.target.value)
                        },
                    }}
                ></RecommendInput>
                <label htmlFor="inputSiteLink">사이트링크</label>
                <Input
                    cover
                    id="inputSiteLink"
                    value={siteLink}
                    onChange={(e) => {
                        setSiteLink(e.target.value)
                    }}
                />
                <label htmlFor="inputId">아이디</label>
                <Input
                    cover
                    type="email"
                    id="inputId"
                    value={id}
                    onChange={(e) => {
                        setId(e.target.value)
                    }}
                />
                <label htmlFor="inputPw">비밀번호</label>
                <Input
                    cover
                    type="password"
                    id="inputPw"
                    value={pw}
                    onChange={(e) => {
                        setPw(e.target.value)
                    }}
                />
                <Button
                    onClick={() => {
                        const chars = ["0123456789", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz", "!@#$%^&*()-_=+"]
                        const charsLen = chars.length
                        const charsStr = chars.join("")
                        const charsStrLen = charsStr.length
                        const getRandomIdx = (length: number) => Math.floor(Math.random() * (length - 1))
                        setPw(
                            new Array(12)
                                .fill(null)
                                .map((_, idx) => (idx < 9 ? chars[idx % charsLen][getRandomIdx(chars[idx % charsLen].length)] : charsStr[getRandomIdx(charsStrLen)]))
                                .sort(() => Math.random() - 0.5)
                                .join(""),
                        )
                    }}
                >
                    비밀번호 자동 생성
                </Button>
                <Button
                    onClick={() => {
                        const charsStr = "0123456789".split("")
                        const getRandomIdx = (length: number) => Math.floor(Math.random() * (length - 1))
                        setPw(
                            new Array(6)
                                .fill(null)
                                .map(() => charsStr.splice(getRandomIdx(charsStr.length), 1)) //한개씩 빼서 넣기
                                .sort(() => Math.random() - 0.5)
                                .join(""),
                        )
                    }}
                >
                    핀번호
                </Button>
                <label htmlFor="inputTag">태그</label>
                <Space cover>
                    <RecommendInput
                        cover
                        onClick={(word) => {
                            setInputTag(word)
                        }}
                        value={inputTag}
                        recommendList={Array.from(new Set(tagRecommendList.concat(acFile.tags)))}
                        inputProps={{
                            id: "inputTag",
                            value: inputTag,
                            onChange: (e) => {
                                setInputTag(e.target.value)
                            },
                            onEnter: () => {
                                if (inputTag === "") return
                                const isExist = tags.find((tag) => inputTag === tag)
                                if (isExist) return
                                setTags((prevState) => [...prevState, inputTag])
                                setInputTag("")
                            },
                        }}
                    ></RecommendInput>
                    <Button
                        onClick={() => {
                            if (inputTag === "") return
                            const isExist = tags.find((tag) => inputTag === tag)
                            if (isExist) return
                            setTags((prevState) => [...prevState, inputTag])
                            setInputTag("")
                        }}
                        icon={
                            <i className="xi-tag">
                                <span className="ir">태그 추가</span>
                            </i>
                        }
                    ></Button>
                </Space>
                <Tag>
                    {tags.map((tag, idx) => (
                        <Tag.Item
                            key={tag}
                            onDelete={() => {
                                tags.splice(idx, 1)
                                setTags(tags)
                            }}
                        >
                            {tag}
                        </Tag.Item>
                    ))}
                </Tag>
            </Space>
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
        transition: "slide",
    },
})
export default Page
