// #region Global Imports
import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
// #endregion Global Imports

// #region Local Imports
import { Title, Header, Space, Button, SettingList, ConfirmModal, Input } from "@Components"
import { RootState, AcFileActions } from "@Redux"
import { AcFile } from "@Interfaces"
import { RN_API } from "@Definitions"
import { WebViewMessage } from "@Services"
import { useAppVersion } from "@Hooks"
// #endregion Local Imports

const Page = (): JSX.Element => {
    const { t, i18n } = useTranslation("common")
    const router = useRouter()
    const dispatch = useDispatch()
    const { app, acFile } = useSelector(({ appReducer, acFileReducer }: RootState) => ({
        app: appReducer,
        acFile: acFileReducer,
    }))
    const { version } = useAppVersion()

    const [modalSetFilename, setModalSetFilename] = useState({
        show: false,
        inputFilename: "",
    })

    const [modalBackupFile, setModalBackupFile] = useState({
        show: false,
        inputFilename: "",
    })

    const [modalSetPincode, setModalSetPincode] = useState({
        show: false,
        inputPincode: "",
    })
    const [modalReset, setModalReset] = useState({
        show: false,
        inputConfirmText: "",
    })

    const editFilename = async (filename: AcFile["filename"]) => {
        const data = await WebViewMessage<typeof RN_API.SET_FILENAME>(RN_API.SET_FILENAME, {
            myFilename: filename,
            pincode: acFile.pincode,
        }).catch(() => null)
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

    const backupFile = async (filename: AcFile["filename"]) => {
        const data = await WebViewMessage<typeof RN_API.BACKUP_FILE>(RN_API.BACKUP_FILE, {
            filename: filename,
            pincode: acFile.pincode,
        }).catch(() => null)
        if (data === null) return
        if (data === false) {
            alert("파일 백업 실패")
            return
        }
    }

    // const shareFile = async () => {
    //     const data = await WebViewMessage<typeof RN_API.SHARE_FILE>(RN_API.SHARE_FILE).catch(() => null)
    //     if (data === null) return
    // }

    const setPincode = async (newPincode: AcFile["pincode"]) => {
        const data = await WebViewMessage<typeof RN_API.SET_PINCODE>(RN_API.SET_PINCODE, {
            newPincode,
            pincode: acFile.pincode,
        }).catch(() => null)
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
        const data = await WebViewMessage<typeof RN_API.SET_FILE>(RN_API.SET_FILE, {
            list: [],
            pincode: acFile.pincode,
        }).catch(() => null)
        if (data === null) return
        if (data === false) {
            alert("초기화 실패")
            return
        }
        dispatch(
            AcFileActions.setInfo({
                list: data,
            }),
        )
        router.push("/list", "/list")
    }
    return (
        <>
            <Header prefix={<Button onClick={() => router.back()} icon={<i className="xi-angle-left-min"></i>}></Button>} title="설정" centerTitle noMargin></Header>
            <SettingList.Title as="h2">앱</SettingList.Title>
            <SettingList>
                <SettingList.Item>
                    <Title as="h3">앱 평가</Title>
                    <SettingList.Text>
                        <a href="javascript:alert('준비중입니다.');">바로가기</a>
                    </SettingList.Text>
                </SettingList.Item>
                <SettingList.Item
                    onClick={() => {
                        router.push("/FAQ", "/FAQ")
                    }}
                >
                    <Title as="h3">FAQ(자주 묻는 질문)</Title>
                </SettingList.Item>
                <SettingList.Item>
                    <Title as="h3">문의하기</Title>
                    <SettingList.Text>
                        <a href="mailto:chansoo1280@naver.com" target="_blank">
                            이메일 보내기
                        </a>
                    </SettingList.Text>
                </SettingList.Item>
            </SettingList>
            <SettingList.Title as="h2">데이터</SettingList.Title>
            <SettingList>
                <SettingList.Item
                    onClick={() => {
                        setModalSetFilename({
                            show: true,
                            inputFilename: "",
                        })
                    }}
                >
                    <Title as="h3">파일 이름변경</Title>
                </SettingList.Item>
                <SettingList.Item
                    onClick={() => {
                        setModalBackupFile({
                            show: true,
                            inputFilename: "",
                        })
                    }}
                >
                    <Title as="h3">파일 백업</Title>
                </SettingList.Item>
                <SettingList.Item onClick={() => router.push("/files", "/files")}>
                    <Title as="h3">파일 변경</Title>
                </SettingList.Item>
                {/* <SettingList.Item onClick={() => shareFile()}>
                    <Title as="h3">파일 내보내기(공유)</Title>
                </SettingList.Item> */}
                <SettingList.Item
                    onClick={() =>
                        setModalSetPincode({
                            show: true,
                            inputPincode: "",
                        })
                    }
                >
                    <Title as="h3">핀코드 변경</Title>
                </SettingList.Item>
                <SettingList.Item
                    onClick={() =>
                        setModalReset({
                            inputConfirmText: "",
                            show: true,
                        })
                    }
                >
                    <Title as="h3">데이터 초기화</Title>
                </SettingList.Item>
            </SettingList>
            <SettingList>
                {/* <SettingList.Item>
                    <Title as="h3">이용약관</Title>
                </SettingList.Item> */}
                <SettingList.Item>
                    <Title as="h3">개인정보처리방침</Title>
                    <SettingList.Text>
                        <a href="https://chansoo1280.site/privacy/account-manager/" target="_blank">
                            새창으로 열기
                        </a>
                    </SettingList.Text>
                </SettingList.Item>
            </SettingList>
            <SettingList.Title as="h2">앱정보</SettingList.Title>
            <SettingList>
                <SettingList.Item>
                    <Title as="h3">개발자</Title>
                    김찬수
                </SettingList.Item>
                <SettingList.Item>
                    <Title as="h3">앱버전</Title>
                    {version}
                </SettingList.Item>
            </SettingList>
            <ConfirmModal
                title="파일 이름 변경"
                show={modalSetFilename.show}
                cancelButtonProps={{
                    onClick: () => {
                        setModalSetFilename((prevState) => ({
                            ...prevState,
                            show: false,
                        }))
                    },
                }}
                okButtonProps={{
                    onClick: () => {
                        setModalSetFilename((prevState) => ({
                            ...prevState,
                            show: false,
                        }))
                        if (modalSetFilename.inputFilename.length === 0) {
                            alert("변경하실 파일명을 입력해주세요.")
                            return
                        }
                        editFilename(modalSetFilename.inputFilename)
                    },
                }}
            >
                <Input
                    type="text"
                    placeholder="확장자(.txt)는 빼고 입력해주세요."
                    value={modalSetFilename.inputFilename}
                    onChange={(e) => {
                        setModalSetFilename((prevState) => ({
                            ...prevState,
                            inputFilename: e.target.value,
                        }))
                    }}
                ></Input>
            </ConfirmModal>
            <ConfirmModal
                title="파일 백업"
                show={modalBackupFile.show}
                cancelButtonProps={{
                    onClick: () => {
                        setModalBackupFile((prevState) => ({
                            ...prevState,
                            show: false,
                        }))
                    },
                }}
                okButtonProps={{
                    onClick: () => {
                        setModalBackupFile((prevState) => ({
                            ...prevState,
                            show: false,
                        }))
                        if (modalBackupFile.inputFilename.length === 0) {
                            alert("파일명을 입력해주세요.")
                            return
                        }
                        backupFile(modalBackupFile.inputFilename)
                    },
                }}
            >
                <Input
                    type="text"
                    placeholder="확장자(.txt)는 빼고 입력해주세요."
                    value={modalBackupFile.inputFilename}
                    onChange={(e) => {
                        setModalBackupFile((prevState) => ({
                            ...prevState,
                            inputFilename: e.target.value,
                        }))
                    }}
                ></Input>
            </ConfirmModal>
            <ConfirmModal
                title="핀코드 변경"
                show={modalSetPincode.show}
                cancelButtonProps={{
                    onClick: () => {
                        setModalSetPincode((prevState) => ({
                            ...prevState,
                            show: false,
                        }))
                    },
                }}
                okButtonProps={{
                    onClick: () => {
                        setModalSetPincode((prevState) => ({
                            ...prevState,
                            show: false,
                        }))
                        if (modalSetPincode.inputPincode.replace(/[^0-9]/g, "").length !== 6) {
                            alert("6자리의 숫자로 핀코드를 입력해주세요.")
                            return
                        }
                        setPincode(modalSetPincode.inputPincode)
                    },
                }}
            >
                <Input
                    type="number"
                    value={modalSetPincode.inputPincode}
                    onChange={(e) => {
                        setModalSetPincode((prevState) => ({
                            ...prevState,
                            inputPincode: e.target.value.slice(0, 6).replace(/[^0-9]/g, ""),
                        }))
                    }}
                ></Input>
            </ConfirmModal>
            <ConfirmModal
                title="데이터 초기화"
                show={modalReset.show}
                cancelButtonProps={{
                    onClick: () => {
                        setModalReset((prevState) => ({
                            ...prevState,
                            show: false,
                        }))
                    },
                }}
                okButtonProps={{
                    children: "초기화",
                    danger: true,
                    disabled: modalReset.inputConfirmText !== `${acFile.filename}/초기화`,
                    onClick: async () => {
                        await resetFile()
                        setModalReset((prevState) => ({
                            ...prevState,
                            show: false,
                        }))
                    },
                }}
            >
                <Space align="center">
                    <span>"{acFile.filename}/초기화"를 입력해주세요.</span>
                </Space>
                <Input
                    type="text"
                    placeholder={`${acFile.filename}/초기화`}
                    value={modalReset.inputConfirmText}
                    onChange={(e) => {
                        setModalReset((prevState) => ({
                            ...prevState,
                            inputConfirmText: e.target.value,
                        }))
                    }}
                ></Input>
            </ConfirmModal>
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
        transition: "popup",
    },
})
export default Page
