// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { Title, Button } from "@Components"
import { RootState, AcActions } from "@Redux"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useRouter } from "next/router"
import { RN_API } from "@Definitions"
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
    const [pincode, setPincode] = useState("")

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
            <Title as="h2">핀번호 입력</Title>
            <input value={pincode} onChange={(e: any) => setPincode(e.target.value.slice(0, 4))} type="number" />
            <Button onClick={() => getFile()} type="primary">
                제출
            </Button>
            <Button onClick={() => shareFile()} type="primary">
                파일공유
            </Button>
            <Button
                onClick={() => {
                    router.replace("/create", "/create")
                }}
                type="primary"
            >
                새로 만들기
            </Button>
            <span>{ac.filename}</span>
            <span>{ac.pincode}</span>
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
    },
})
export default Page
