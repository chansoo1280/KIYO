// #region Global Imports
import { useEffect, useRef, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { Header, PinCode, Space, KeyPad, Title, Button, Input, SlideTab, IconList, MainHeader } from "@Components"
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
const STEP = {
    INPUT_PINCODE: "INPUT_PINCODE",
    CONFIRM_PINCODE: "CONFIRM_PINCODE",
    INPUT_FILENAME: "INPUT_FILENAME",
} as const
type STEP = typeof STEP[keyof typeof STEP]
const Page = (): JSX.Element => {
    const { t, i18n } = useTranslation("common")
    const [step, setStep] = useState<STEP>(STEP.INPUT_PINCODE)
    const router = useRouter()
    const dispatch = useDispatch()
    const { app, ac } = useSelector(({ appReducer, acReducer }: RootState) => ({
        app: appReducer,
        ac: acReducer,
    }))
    const [pincode, setPincode] = useState<Ac["pincode"]>("")
    const [pincodeConfirm, setPincodeConfirm] = useState<Ac["pincode"]>("")
    const [filename, setFilename] = useState<Ac["filename"]>("my-list")
    const pincodeInput = useRef<HTMLInputElement>(null)

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
    const nextStep = () => {
        if (step === STEP.INPUT_PINCODE) {
            setStep(STEP.CONFIRM_PINCODE)
        } else if (step === STEP.CONFIRM_PINCODE) {
            setStep(STEP.INPUT_FILENAME)
        }
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
            <Header
                title={
                    <>
                        <Button
                            onClick={() => {
                                if (step === STEP.INPUT_PINCODE) {
                                    router.back()
                                } else if (step === STEP.CONFIRM_PINCODE) {
                                    setPincodeConfirm("")
                                    setStep(STEP.INPUT_PINCODE)
                                } else if (step === STEP.INPUT_FILENAME) {
                                    setFilename("")
                                    setStep(STEP.CONFIRM_PINCODE)
                                }
                            }}
                            icon={
                                <i className="xi-angle-left-min">
                                    <span className="ir">뒤로가기</span>
                                </i>
                            }
                        ></Button>
                        <span>
                            파일 생성 / {step === STEP.INPUT_PINCODE ? "1. 핀코드 입력" : step === STEP.CONFIRM_PINCODE ? "2. 핀코드 확인" : step === STEP.INPUT_FILENAME ? "3. 파일명 입력" : ""}
                        </span>
                    </>
                }
            ></Header>
            {step === STEP.INPUT_PINCODE ? (
                <>
                    <PinCode value={pincode || ""} length={6}></PinCode>
                    <Space align="flex-end">
                        <Button type="link" onClick={() => router.push("/files", "/files")}>
                            파일 목록으로 이동
                        </Button>
                    </Space>
                    <KeyPad
                        maxLength={6}
                        onEnter={() => {
                            if (pincode === null || pincode.length < 6) {
                                alert("핀코드를 입력해주세요.")
                                return
                            }
                            nextStep()
                        }}
                        value={pincode || ""}
                        setValue={setPincode}
                    ></KeyPad>
                </>
            ) : step === STEP.CONFIRM_PINCODE ? (
                <>
                    <PinCode value={pincodeConfirm || ""} length={6}></PinCode>
                    <KeyPad
                        maxLength={6}
                        onEnter={() => {
                            if (pincodeConfirm === null || pincodeConfirm.length < 6) {
                                alert("핀코드 한번더 입력해주세요.")
                                return
                            }
                            if (pincode !== pincodeConfirm) {
                                alert("핀코드 확인값이 다릅니다.")
                                return
                            }
                            nextStep()
                        }}
                        value={pincodeConfirm || ""}
                        setValue={setPincodeConfirm}
                    ></KeyPad>
                </>
            ) : (
                <>
                    <Input value={filename || ""} onChange={(e: any) => setFilename(e.target.value.slice(0, 20))} onEnter={() => pincodeInput?.current?.focus()} type="text" />
                    <Button onClick={() => reqCreateFile()} type="primary">
                        제출
                    </Button>
                </>
            )}
            {/* 파일이름
            <Input value={filename || ""} onChange={(e: any) => setFilename(e.target.value.slice(0, 20))} onEnter={() => pincodeInput?.current?.focus()} type="text" />
            핀번호
            <Input ref={pincodeInput} type="password" value={pincode || ""} onChange={(e: any) => setPincode(e.target.value.slice(0, 6))} onEnter={() => reqCreateFile()} /> */}
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
    },
})
export default Page
