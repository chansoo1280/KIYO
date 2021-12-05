// #region Global Imports
import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
// #endregion Global Imports

// #region Local Imports
import { Header, Title, Space, Button, FileList } from "@Components"
import { RootState } from "@Redux"
import { RNFile } from "@Interfaces"
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
    const [dirpath, setDirpath] = useState("")
    const [selFile, setSelFile] = useState<string | null>(null)
    const [fileList, setFileList] = useState<RNFile[]>([])

    const getFileList = async () => {
        const data = await WebViewMessage<typeof RN_API.GET_FILE_LIST>(RN_API.GET_FILE_LIST)
        if (data === null) return
        setDirpath(decodeURIComponent(data.dirpath))
        setFileList(
            (data.list &&
                data.list.map((fileInfo) => ({
                    ...fileInfo,
                    timer: null,
                    isAction: false,
                }))) ||
                [],
        )
    }
    const setDir = async () => {
        const data = await WebViewMessage<typeof RN_API.SET_DIR>(RN_API.SET_DIR)
        if (data === null) return
        getFileList()
    }
    const changeFile = async () => {
        if (selFile === null) {
            alert("파일을 선택해주세요.")
            return
        }
        const data = await WebViewMessage<typeof RN_API.SET_SEL_FILENAME>(RN_API.SET_SEL_FILENAME, {
            filepath: selFile,
        })
        if (data === null) return
        if (data === true) {
            router.replace("/", "/")
        }
    }
    const deleteFile = async (filepath: string) => {
        const data = await WebViewMessage<typeof RN_API.DELETE_FILE>(RN_API.DELETE_FILE, {
            filepath,
        })
        if (data === null) return
        if (data === true) {
            alert("삭제되었습니다.")
            await getFileList()
        }
    }
    useEffect(() => {
        getFileList()
    }, [])
    return (
        <>
            <Header prefix={<Button onClick={() => router.back()} icon={<i className="xi-angle-left-min"></i>}></Button>} title="파일목록" centerTitle>
                <Button
                    onClick={() => {
                        router.push("/start", "/start")
                    }}
                    icon={
                        <i className="xi-plus-min">
                            <span className="ir">새로 만들기</span>
                        </i>
                    }
                ></Button>
            </Header>
            <Space direction="column" padding="10px">
                아래 경로로 .txt 파일을 옮겨주세요. <br />
                {dirpath}
                <Button
                    block
                    onClick={() => {
                        setDir()
                    }}
                >
                    폴더변경
                </Button>
            </Space>
            <FileList>
                {fileList.map((file) => {
                    return (
                        <FileList.Item
                            isChecked={file.filepath === selFile}
                            onClick={() => {
                                setSelFile(file.filepath === selFile ? null : file.filepath)
                            }}
                            onTouchStart={(e) => {
                                file.timer = setTimeout(() => {
                                    if (confirm("삭제하시겠습니까?") === false) return
                                    deleteFile(file.filepath || "")
                                }, 300)
                            }}
                            onMouseUp={(e) => {
                                if (file.timer !== null) clearTimeout(file.timer)
                            }}
                        >
                            <Title flex as="h2">
                                {file.filename}
                            </Title>
                            {file.mTime}
                        </FileList.Item>
                    )
                })}
            </FileList>
            <Button
                type="primary"
                size="lg"
                fixed
                onClick={() => {
                    changeFile()
                }}
                icon={
                    <i className="xi-log-in">
                        <span className="ir">선택</span>
                    </i>
                }
            ></Button>
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
