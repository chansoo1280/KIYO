// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { Header, Title, Space, Button, RecommendInput, Input, Tag } from "@Components"
import { RootState } from "@Redux"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { AcFile } from "@Interfaces"
import { RN_API } from "@Definitions"
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

    const [siteName, setSiteName] = useState("")
    const [siteLink, setSiteLink] = useState("")
    const [id, setId] = useState("")
    const [pw, setPw] = useState("")
    const [inputTag, setInputTag] = useState("")
    const [tags, setTags] = useState<string[]>([])

    return (
        <>
            <Header
                title={
                    <>
                        <Button onClick={() => router.back()} icon={<i className="xi-angle-left-min"></i>}></Button>
                        <span>계정 정보 생성</span>
                    </>
                }
            >
                <Button
                    type="text"
                    onClick={() => {
                        router.push("/start", "/start")
                    }}
                >
                    생성
                </Button>
            </Header>
            <Space direction="column" vAlign="flex-start" cover padding="20px 10px 0">
                <label htmlFor="inputSiteName">사이트명</label>
                <RecommendInput
                    onClick={(word) => {
                        setSiteName(word)
                    }}
                    value={siteName}
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
                        value={siteName}
                        onChange={(e) => {
                            setSiteName(e.target.value)
                        }}
                    />
                </RecommendInput>
                <label htmlFor="inputSiteLink">사이트링크</label>
                <Input
                    id="inputSiteLink"
                    value={siteLink}
                    onChange={(e) => {
                        setSiteLink(e.target.value)
                    }}
                />
                <label htmlFor="inputId">아이디</label>
                <Input
                    id="inputId"
                    value={id}
                    onChange={(e) => {
                        setId(e.target.value)
                    }}
                />
                <label htmlFor="inputPw">비밀번호</label>
                <Input
                    id="inputPw"
                    value={pw}
                    onChange={(e) => {
                        setPw(e.target.value)
                    }}
                />
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
                        setPw(createdPw)
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
                        setPw(createdPw)
                    }}
                >
                    핀번호
                </Button>
                <Space direction="column" vAlign="flex-start" gap="0" margin="0">
                    <label htmlFor="inputTag">태그</label>
                    <Space>
                        <RecommendInput
                            onClick={(word) => {
                                setInputTag(word)
                            }}
                            value={inputTag}
                            recommendList={Array.from(new Set(["즐겨찾기"].concat(acFile.tags)))}
                        >
                            <Input
                                id="inputTag"
                                value={inputTag}
                                onChange={(e) => {
                                    setInputTag(e.target.value)
                                }}
                                onEnter={() => {
                                    if (inputTag === "") return
                                    const isExist = tags.find((tag) => inputTag === tag)
                                    if (isExist) return
                                    setTags([...(tags || []), inputTag])
                                    setInputTag("")
                                }}
                            />
                        </RecommendInput>
                        <Button
                            onClick={() => {
                                if (inputTag === "") return
                                const isExist = tags.find((tag) => inputTag === tag)
                                if (isExist) return
                                setTags([...(tags || []), inputTag])
                                setInputTag("")
                            }}
                            icon={
                                <i className="xi-tag">
                                    <span className="ir">태그 추가</span>
                                </i>
                            }
                        ></Button>
                    </Space>
                </Space>
                <Tag>
                    {tags.map((tag, idx) => {
                        return (
                            <Tag.Item
                                key={tag}
                                onDelete={() => {
                                    const list = tags
                                    list.splice(idx, 1)
                                    setTags(list)
                                }}
                            >
                                {tag}
                            </Tag.Item>
                        )
                    })}
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
