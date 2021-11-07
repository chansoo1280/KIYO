// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { Title, Header, Space, Button, SettingList, SettingTitle, ConfirmModal, Input } from "@Components"
import { RootState, AcFileActions } from "@Redux"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { AcFile } from "@Interfaces"
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
    const { app, acFile } = useSelector(({ appReducer, acFileReducer }: RootState) => ({
        app: appReducer,
        acFile: acFileReducer,
    }))

    const [modalSetPincode, setModalSetPincode] = useState({
        show: false,
        inputPincode: "",
    })

    const editFilename = (filename: AcFile["filename"]) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_FILENAME,
                data: {
                    myFilename: filename,
                    pincode: acFile.pincode,
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

    const setPincode = (newPincode: AcFile["pincode"]) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_PINCODE,
                data: {
                    newPincode,
                    pincode: acFile.pincode,
                },
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
                    pincode: acFile.pincode,
                },
            }),
        )
    }

    const listener = (event: any) => {
        const { data, type } = JSON.parse(event.data)
        switch (type) {
            case RN_API.SET_FILENAME: {
                // alert(data + "/" + typeof data)
                if (data === false) {
                    alert("파일 수정 실패")
                    return
                }
                dispatch(
                    AcFileActions.setInfo({
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
                    AcFileActions.setInfo({
                        list: data,
                    }),
                )
                break
            }
            case RN_API.SET_PINCODE: {
                if (data === false) {
                    alert("pincode 수정 실패")
                    return
                }
                dispatch(
                    AcFileActions.setInfo({
                        pincode: data,
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
            <Header
                title={
                    <>
                        <Button onClick={() => router.replace("/list", "/list")} icon={<i className="xi-angle-left-min"></i>}></Button>
                        <span>설정</span>
                    </>
                }
                noMargin
            ></Header>
            <SettingTitle as="h2">앱</SettingTitle>
            <SettingList>
                <SettingList.Item>
                    <Title as="h3">앱 평가</Title>
                </SettingList.Item>
                <SettingList.Item>
                    <Title as="h3">공지사항</Title>
                </SettingList.Item>
                <SettingList.Item>
                    <Title as="h3">문의하기</Title>
                </SettingList.Item>
            </SettingList>
            <SettingTitle as="h2">파일 관리</SettingTitle>
            <SettingList>
                <SettingList.Item
                    onClick={() => {
                        const newFilename = prompt("파일이름 입력")
                        if (!newFilename) {
                            return
                        }
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
                        setModalSetPincode({
                            show: true,
                            inputPincode: "",
                        })
                        // const newPincode = prompt("새로운 핀코드 입력")
                        // if (!newPincode) {
                        //     return
                        // }
                    }}
                >
                    <Title as="h3">핀코드 변경</Title>
                </SettingList.Item>
                <SettingList.Item
                    onClick={() => {
                        if (!confirm("초기화하시겠습니까?")) return
                        resetFile()
                    }}
                >
                    <Title as="h3">초기화</Title>
                </SettingList.Item>
            </SettingList>
            <SettingList>
                <SettingList.Item>
                    <Title as="h3">이용약관</Title>
                </SettingList.Item>
                <SettingList.Item>
                    <Title as="h3">개인정보처리방침</Title>
                </SettingList.Item>
            </SettingList>
            <SettingTitle as="h2">앱정보</SettingTitle>
            <SettingList>
                <SettingList.Item>
                    <Title as="h3">개발자</Title>
                    김찬수
                </SettingList.Item>
                <SettingList.Item>
                    <Title as="h3">앱버전</Title>
                    0.0.1
                </SettingList.Item>
            </SettingList>
            <ConfirmModal
                title="핀코드 변경"
                show={modalSetPincode.show}
                onClickCancel={() => {
                    setModalSetPincode({
                        ...modalSetPincode,
                        show: false,
                    })
                }}
                onClickOk={() => {
                    setModalSetPincode({
                        ...modalSetPincode,
                        show: false,
                    })
                    if (modalSetPincode.inputPincode.replace(/[^0-9]/g, "").length !== 6) {
                        alert("6자리의 숫자로 핀코드를 입력해주세요.")
                        return
                    }
                    setPincode(modalSetPincode.inputPincode)
                }}
            >
                <Input
                    type="number"
                    value={modalSetPincode.inputPincode}
                    onChange={(e) => {
                        setModalSetPincode({
                            ...modalSetPincode,
                            inputPincode: e.target.value.slice(0, 6),
                        })
                    }}
                ></Input>
            </ConfirmModal>
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
