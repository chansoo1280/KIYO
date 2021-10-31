// #region Global Imports
import { useEffect } from "react"
// #endregion Global Imports

// #region Local Imports
import { Title, Space, Button, SettingList, SettingTitle } from "@Components"
import { RootState, AcActions } from "@Redux"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
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

    const editFilename = (filename: Ac["filename"]) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_FILENAME,
                data: {
                    myFilename: filename,
                    pincode: ac.pincode,
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

    const resetFile = () => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_FILE,
                data: {
                    contents: [],
                    pincode: ac.pincode,
                },
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
                }
                break
            }
            case RN_API.SET_FILENAME: {
                // alert(data + "/" + typeof data)
                if (data === false) {
                    alert("파일 수정 실패")
                    return
                }
                dispatch(
                    AcActions.setInfo({
                        filename: data,
                    }),
                )
                break
            }
            case RN_API.SET_FILE: {
                // alert(data + "/" + typeof data)
                if (data === false) {
                    alert("파일 수정 실패")
                    return
                }

                dispatch(
                    AcActions.setInfo({
                        list: data,
                    }),
                )
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
            <Space>
                <Button onClick={() => router.replace("/list", "/list")} icon={<i className="xi-angle-left-min"></i>}></Button>
                <Title as="h1">설정</Title>
            </Space>
            <SettingTitle as="h2">사용성</SettingTitle>
            <SettingList>
                <SettingList.Item
                    onClick={() => {
                        const newFilename = prompt("파일이름 입력")
                        editFilename(newFilename)
                    }}
                >
                    <Title as="h3">파일이름변경</Title>
                </SettingList.Item>
                <SettingList.Item onClick={() => shareFile()}>
                    <Title as="h3">파일 내보내기(공유)</Title>
                </SettingList.Item>
                <SettingList.Item onClick={() => router.push("/files", "/files")}>
                    <Title as="h3">파일 가져오기</Title>
                </SettingList.Item>
                <SettingList.Item
                    onClick={() => {
                        if (confirm("초기화하시겠습니까?") === false) return
                        resetFile()
                    }}
                >
                    <Title as="h3">초기화</Title>
                </SettingList.Item>
                <SettingList.Item>
                    <Title as="h3">개발자</Title>
                </SettingList.Item>
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
