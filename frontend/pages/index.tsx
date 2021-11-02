// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { Header, KeyPad, PinCode, Title, Button, Input, Space } from "@Components"
import { RootState, AcActions } from "@Redux"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useRouter } from "next/router"
import { RN_API } from "@Definitions"
import { Ac } from "@Interfaces"
// #endregion Local Imports

declare global {
    interface Window {
        ReactNativeWebView: any
    }
}

// window.ReactNativeWebView.postMessage(
//     JSON.stringify({
//         type: RN_API_GET_STAR,
//     }),
// )
const Page = (): JSX.Element => {
    const { t, i18n } = useTranslation("common")
    const router = useRouter()
    const dispatch = useDispatch()
    const { app, ac } = useSelector(({ appReducer, acReducer }: RootState) => ({
        app: appReducer,
        ac: acReducer,
    }))
    const [pincode, setPincode] = useState<Ac["pincode"]>("")

    const getFile = () => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.GET_FILE,
                data: {
                    pincode,
                },
            }),
        )
    }
    const shareFile = () => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SHARE_FILE,
            }),
        )
    }

    const listener = (event: any) => {
        const { data, type } = JSON.parse(event.data)
        switch (type) {
            case RN_API.GET_FILENAME: {
                if (data === false) {
                    alert("파일이 없습니다.")
                    router.replace("/create", "/create")
                } else {
                    dispatch(
                        AcActions.setInfo({
                            filename: data,
                            pincode: "",
                        }),
                    )
                }
                break
            }
            case RN_API.GET_FILE: {
                if (data.contents === false) {
                    alert("올바르지 않은 핀번호입니다.")
                    return
                }
                // alert(data.pincode + "/" + data.filename + "/" + data.contents.length)
                dispatch(
                    AcActions.setInfo({
                        pincode: data.pincode,
                        filename: data.filename,
                        list: data.contents || [],
                    }),
                )
                router.push("/list", "/list")
                break
            }
            case RN_API.SHARE_FILE: {
                // alert(data)
                break
            }

            default: {
                break
            }
        }
    }
    useEffect(() => {
        if (app.sel_lang !== i18n.language) {
            router.replace("/", "/", { locale: app.sel_lang || "ko" })
        }
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(
                JSON.stringify({
                    type: RN_API.GET_FILENAME,
                }),
            )
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
            <Header title={ac.filename ? ac.filename + " - 핀번호 입력" : "핀번호 입력"}></Header>
            <PinCode value={pincode || ""} length={6}></PinCode>
            <Space align="flex-end">
                <Button type="link" onClick={() => router.push("/files", "/files")}>
                    파일 목록으로 이동
                </Button>
            </Space>
            <KeyPad maxLength={6} onEnter={() => getFile()} value={pincode || ""} setValue={setPincode}></KeyPad>
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
    },
})
export default Page
