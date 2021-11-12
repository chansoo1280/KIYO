// #region Global Imports
import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
// #endregion Global Imports

// #region Local Imports
import { Header, KeyPad, PinCode, Title, Button, Input, Space, AlertModal } from "@Components"
import { RootState, AcFileActions } from "@Redux"
import { RN_API } from "@Definitions"
import { Account, AcFile } from "@Interfaces"
import { WebViewMessage } from "@Services"
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

    const getFilename = async () => {
        const data = await WebViewMessage(RN_API.GET_FILENAME)
        if (data === null) return

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
    }

    const getFile = async () => {
        if (!pincode || pincode.length !== 6) {
            alert("핀코드를 입력해주세요.")
            return
        }
        const data = await WebViewMessage(RN_API.GET_FILE, {
            pincode,
        })
        if (data === null) return
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
    }
    const setDir = async () => {
        const data = await WebViewMessage(RN_API.SET_DIR)
        if (data === null) return

        setShowDescBanner(false)
        router.replace("/create", "/create")
    }
    useEffect(() => {
        if (app.sel_lang !== i18n.language) {
            router.replace("/", "/", { locale: app.sel_lang || "ko" })
        }
        getFilename()
    }, [])
    return (
        <>
            <PinCode value={pincode || ""} length={6}></PinCode>
            <Space align="flex-end" padding="0 16px">
                <Title as="h2">{acFile.filename}</Title>
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
                okText="폴더 선택하기"
            >
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
