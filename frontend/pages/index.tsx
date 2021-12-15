// #region Global Imports
import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
// #endregion Global Imports

// #region Local Imports
import { KeyPad, PinCode, Title, Button, Space, AlertModal } from "@Components"
import { RootState, AcFileActions } from "@Redux"
import { RN_API } from "@Definitions"
import { Account, AcFile } from "@Interfaces"
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
    const { version, getVersion } = useAppVersion()
    const [pincode, setPincode] = useState<AcFile["pincode"]>("")
    const pinCodeLen = 6
    const [showDescBanner, setShowDescBanner] = useState(false)

    const getFilename = async () => {
        const data = await WebViewMessage<typeof RN_API.GET_FILENAME>(RN_API.GET_FILENAME)
        if (data === null) return
        if (data === "no-folder") {
            setShowDescBanner(true)
            return
        } else if (data === false) {
            router.replace("/files", "/files")
            return
        }
        dispatch(
            AcFileActions.setInfo({
                filename: data,
                pincode: "",
            }),
        )
    }

    const getFile = async () => {
        if (!pincode || pincode.length !== pinCodeLen) {
            alert("핀코드를 입력해주세요.")
            return
        }
        const data = await WebViewMessage<typeof RN_API.GET_FILE>(RN_API.GET_FILE, {
            pincode,
        })
        if (data === null) return
        if (data === false) {
            alert("올바르지 않은 핀번호입니다.")
            setPincode("")
            return
        }
        // alert(data.pincode + "/" + data.filename + "/" + data.list.length)
        const list: Account[] =
            data.list.map((account: Account, idx: number) => ({
                ...account,
                siteName: account.siteName || "",
                tags: account.tags || [],
                idx: idx,
                copiedAt: account.copiedAt || "",
            })) || []
        const tags = list.reduce((acc: Account["tags"], cur) => acc.concat(cur.tags), [])
        dispatch(
            AcFileActions.setInfo({
                pincode: data.pincode,
                filename: data.filename,
                sortType: data.sortType || acFile.sortType,
                list: list,
                tags: Array.from(new Set(tags)),
            }),
        )
        router.push("/list", "/list")
    }
    const setDir = async () => {
        const data = await WebViewMessage<typeof RN_API.SET_DIR>(RN_API.SET_DIR)
        if (data === null) return

        setShowDescBanner(false)
        router.replace("/start", "/start")
    }
    useEffect(() => {
        if (app.sel_lang !== i18n.language) {
            router.replace("/", "/", { locale: app.sel_lang || "ko" })
        }
        getVersion()
            .then((res) => {
                if (res !== "1.8") {
                    alert("최신버전이 아닙니다. 업데이트를 진행해주세요.")
                }
            })
            .then(getFilename)
    }, [])
    return (
        <>
            <PinCode value={pincode || ""} length={pinCodeLen}></PinCode>
            <Space align="flex-end" padding="0 16px">
                <Title as="h2">{acFile.filename}</Title>
                <Button type="link" onClick={() => router.push("/files", "/files")}>
                    파일 목록으로 이동
                </Button>
            </Space>
            <KeyPad
                onChange={() => {
                    if (pincode && pincode.length === pinCodeLen) {
                        getFile()
                    }
                }}
                maxLength={pinCodeLen}
                onEnter={() => getFile()}
                value={pincode || ""}
                setValue={setPincode}
            ></KeyPad>
            <AlertModal show={showDescBanner} onClick={() => setDir()} okText="폴더 선택하기">
                <img style={{ objectFit: "contain" }} src="/static/images/banner/select-folder.png" alt="" />
                <Space align="center">사용하실 폴더를 선택해주세요!</Space>
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
