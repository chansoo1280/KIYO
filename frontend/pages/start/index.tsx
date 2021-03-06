// #region Global Imports
import { useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
// #endregion Global Imports

// #region Local Imports
import { Header, PinCode, Space, KeyPad, Button, Input } from "@Components"
import { RootState, AcFileActions } from "@Redux"
import { AcFile } from "@Interfaces"
import { RN_API } from "@Definitions"
import { WebViewMessage } from "@Services"
// #endregion Local Imports

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
    // const { app, acFile } = useSelector(({ appReducer, acFileReducer }: RootState) => ({
    //     app: appReducer,
    //     acFile: acFileReducer,
    // }))
    const [pincode, setPincode] = useState<AcFile["pincode"]>("")
    const [pincodeConfirm, setPincodeConfirm] = useState<AcFile["pincode"]>("")
    const pinCodeLen = 6
    const [filename, setFilename] = useState<AcFile["filename"]>("my-list")
    const pincodeInput = useRef<HTMLInputElement>(null)

    const reqCreateFile = async () => {
        if (filename === "") {
            alert("filename 없음")
            return
        }
        if (pincode === "") {
            alert("pincode 없음")
            return
        }
        const data = await WebViewMessage<typeof RN_API.CREATE_FILE>(RN_API.CREATE_FILE, {
            pincode,
            filename,
            list: [],
        }).catch(() => null)
        if (data === null) return
        if (data === false) {
            alert("생성 실패")
            return
        }
        dispatch(
            AcFileActions.setInfo({
                ...data,
            }),
        )
        alert("생성 성공")
        router.replace("/", "/")
    }
    const nextStep = () => {
        if (step === STEP.INPUT_PINCODE) {
            setStep(STEP.CONFIRM_PINCODE)
        } else if (step === STEP.CONFIRM_PINCODE) {
            setStep(STEP.INPUT_FILENAME)
        }
    }
    return (
        <>
            <Header
                prefix={
                    <Button
                        onClick={() => {
                            if (step === STEP.INPUT_PINCODE) {
                                router.push("/files", "/files")
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
                }
                title={step === STEP.INPUT_PINCODE ? "1. 핀코드 입력" : step === STEP.CONFIRM_PINCODE ? "2. 핀코드 확인" : step === STEP.INPUT_FILENAME ? "3. 파일명 입력" : ""}
                centerTitle
                noMargin
            >
                파일 생성
            </Header>
            {step === STEP.INPUT_PINCODE ? (
                <>
                    <PinCode value={pincode || ""} length={pinCodeLen}></PinCode>
                    <Space padding="0 16px" align="flex-end">
                        <Button type="link" onClick={() => router.push("/files", "/files")}>
                            파일 목록으로 이동
                        </Button>
                    </Space>
                    <KeyPad
                        maxLength={pinCodeLen}
                        onEnter={() => {
                            if (!pincode || pincode.length !== pinCodeLen) {
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
                    <PinCode value={pincodeConfirm || ""} length={pinCodeLen}></PinCode>
                    <KeyPad
                        maxLength={pinCodeLen}
                        onEnter={() => {
                            if (!pincodeConfirm || pincodeConfirm.length !== pinCodeLen) {
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
                    <Input value={filename || ""} onChange={(e: any) => setFilename(e.target.value.slice(0, 20))} onEnter={() => pincodeInput.current?.focus()} type="text" />
                    <Button onClick={() => reqCreateFile()} type="primary">
                        제출
                    </Button>
                </>
            )}
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
    },
})
export default Page
