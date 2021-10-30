// #region Global Imports
import { useEffect } from "react"
// #endregion Global Imports

// #region Local Imports
import { Title, Space, Button, AccountCard, SettingList, SettingTitle } from "@Components"
import { RootState, AcActions } from "@Redux"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useRouter } from "next/router"
import { Account } from "@Interfaces"
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

    const listener = (event: any) => {
        const { data, type } = JSON.parse(event.data)
        switch (type) {
            // case RN_API.SET_FILE: {
            //     // alert(data + "/" + typeof data)
            //     if (data === false) {
            //         alert("파일 수정 실패")
            //         return
            //     }
            //     dispatch(
            //         AcActions.setInfo({
            //             list: data,
            //         }),
            //     )
            //     break
            // }

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
            <Space>
                <Button onClick={() => router.replace("/list", "/list")} icon={<i className="xi-angle-left-min" ></i>}></Button>
                <Title as="h1">설정</Title>
            </Space>
            <SettingTitle as="h2">사용성</SettingTitle>
            <SettingList>
                <SettingList.Item><Title as="h3">asd</Title></SettingList.Item>
            </SettingList>
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
    },
})
export default Page
