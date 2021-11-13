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

    const [modalSetPincode, setModalSetPincode] = useState({
        show: false,
        inputPincode: "",
    })

    const editFilename = async (filename: AcFile["filename"]) => {
        const data = await WebViewMessage(RN_API.SET_FILENAME, {
            myFilename: filename,
            pincode: acFile.pincode,
        })
        if (data === null) return
        if (data === false) {
            alert("파일 수정 실패")
            return
        }
        dispatch(
            AcFileActions.setInfo({
                filename: data,
            }),
        )
    }

    const shareFile = async () => {
        const data = await WebViewMessage(RN_API.SHARE_FILE)
        if (data === null) return
    }

    const setPincode = async (newPincode: AcFile["pincode"]) => {
        const data = await WebViewMessage(RN_API.SET_PINCODE, {
            newPincode,
            pincode: acFile.pincode,
        })
        if (data === null) return
        if (data === false) {
            alert("pincode 수정 실패")
            return
        }
        dispatch(
            AcFileActions.setInfo({
                pincode: data,
            }),
        )
    }

    const resetFile = async () => {
        const data = await WebViewMessage(RN_API.SET_FILE, {
            contents: [],
            pincode: acFile.pincode,
        })
        if (data === null) return
        if (data === false) {
            alert("파일 수정 실패")
            return
        }

        dispatch(
            AcFileActions.setInfo({
                list: data,
            }),
        )
    }
    return (
        <>
            <Header prefix={<Button onClick={() => router.replace("/list", "/list")} icon={<i className="xi-angle-left-min"></i>}></Button>} title="설정" centerTitle noMargin></Header>
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
