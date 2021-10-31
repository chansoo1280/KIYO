// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { Title, Button, SlideTab, IconList, MainHeader } from "@Components"
import { AppActions, RootState, AcActions } from "@Redux"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useRouter } from "next/router"
import { Ac } from "@Interfaces"
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
    const { app, ac } = useSelector(({ appReducer, acReducer }: RootState) => ({
        app: appReducer,
        ac: acReducer,
    }))
    const [pincode, setPincode] = useState<Ac["pincode"]>("")
    const [filename, setFilename] = useState<Ac["filename"]>("")

    const reqCreateFile = () => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        if (filename === "") {
            alert("filename 없음")
            return
        }
        if (pincode === "") {
            alert("pincode 없음")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.CREATE_FILE,
                data: {
                    pincode,
                    filename,
                    contents: [],
                },
            }),
        )
    }

    const listener = (event: any) => {
        const { data, type } = JSON.parse(event.data)
        switch (type) {
            case RN_API.CREATE_FILE: {
                if (data === false) {
                    alert("생성 실패")
                    return
                }
                dispatch(
                    AcActions.setInfo({
                        ...data,
                    }),
                )
                alert("생성 성공")
                router.replace("/", "/")
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
            <Title as="h2">파일 생성</Title>
            핀번호
            <input value={pincode || ""} onChange={(e: any) => setPincode(e.target.value.slice(0, 4))} type="number" />
            파일이름
            <input value={filename || ""} onChange={(e: any) => setFilename(e.target.value.slice(0, 20))} type="text" />
            <Button onClick={() => reqCreateFile()} type="primary">
                제출
            </Button>
            <Button onClick={() => router.push("/files", "/files")} type="primary">
                파일이 이미 있습니다.
            </Button>
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
    },
})
export default Page
