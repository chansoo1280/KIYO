// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { Header, KeyPad, PinCode, Title, Button, Input, Space, AlertModal } from "@Components"
import { RootState, AcFileActions } from "@Redux"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useRouter } from "next/router"
import { RN_API } from "@Definitions"
import { Account, AcFile } from "@Interfaces"
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
    const [pincode, setPincode] = useState<AcFile["pincode"]>("")
    const [showDescBanner, setShowDescBanner] = useState(false)

    const getFile = () => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        if (!pincode || pincode.length !== 6) {
            alert("핀코드를 입력해주세요.")
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
    const setDir = () => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_DIR,
            }),
        )
    }
    // const shareFile = () => {
    //     if (!window.ReactNativeWebView) {
    //         alert("ReactNativeWebView 객체가 없습니다.")
    //         return
    //     }
    //     window.ReactNativeWebView.postMessage(
    //         JSON.stringify({
    //             type: RN_API.SHARE_FILE,
    //         }),
    //     )
    // }

    const listener = (event: any) => {
        const { data, type } = JSON.parse(event.data)
        switch (type) {
            case RN_API.GET_FILENAME: {
                if (data === "no-folder") {
                    setShowDescBanner(true)
                } else if (data === false) {
                    router.replace("/files", "/files")
                } else {
                    dispatch(
                        AcFileActions.setInfo({
                            filename: data,
                            pincode: "",
                        }),
                    )
                }
                break
            }
            case RN_API.SET_DIR: {
                setShowDescBanner(false)
                router.replace("/create", "/create")
                break
            }

            case RN_API.GET_FILE: {
                if (data.contents === false) {
                    alert("올바르지 않은 핀번호입니다.")
                    setPincode("")
                    return
                }
                // alert(data.pincode + "/" + data.filename + "/" + data.contents.length)
                const list: Account[] =
                    data.contents.map((account: any) => ({
                        ...account,
                        siteName: account.siteName || account.address,
                        tags: account.tags || [],
                    })) || []
                const tags = list.reduce((acc: string[], cur) => acc.concat(cur.tags), [])
                dispatch(
                    AcFileActions.setInfo({
                        pincode: data.pincode,
                        filename: data.filename,
                        list: list,
                        tags: Array.from(new Set(tags)),
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
            <Header title={acFile.filename ? acFile.filename + " - 핀번호 입력" : "핀번호 입력"}></Header>
            <PinCode value={pincode || ""} length={6}></PinCode>
            <Space align="flex-end">
                <Button type="link" onClick={() => router.push("/files", "/files")}>
                    파일 목록으로 이동
                </Button>
            </Space>
            <KeyPad
                onChange={() => {
                    if (pincode && pincode.length === 6) {
                        getFile()
                    }
                }}
                maxLength={6}
                onEnter={() => getFile()}
                value={pincode || ""}
                setValue={setPincode}
            ></KeyPad>
            <AlertModal
                show={showDescBanner}
                onClick={() => {
                    setDir()
                }}
            >
                사용하실 폴더를 선택해주세요!
            </AlertModal>
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
    },
})
export default Page
