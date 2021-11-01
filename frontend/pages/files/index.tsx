// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { Title, Space, Button, FileList } from "@Components"
import { RootState } from "@Redux"
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
    const [dirpath, setDirpath] = useState("")
    const [selFile, setSelFile] = useState(null)
    const [fileList, setFileList] = useState<any>([])

    const getFileList = () => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.GET_FILE_LIST,
            }),
        )
    }
    const changeFile = () => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        if (selFile === null) {
            alert("파일을 선택해주세요.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_SEL_FILENAME,
                data: {
                    filename: selFile,
                },
            }),
        )
    }
    const deleteFile = (filename: Ac["filename"]) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.DELETE_FILE,
                data: {
                    filename,
                },
            }),
        )
    }

    const listener = (event: any) => {
        const { data, type } = JSON.parse(event.data)
        switch (type) {
            case RN_API.GET_FILE_LIST: {
                // alert(data + "/" + typeof data)
                setDirpath(data.dirpath || "")
                setFileList(
                    data.list.filter((file: any)=>file.name.slice(-4, file.name.length) === ".txt").map((file: any) => ({
                        ...file,
                        timer: null,
                        isAction: false,
                    })) || [],
                )
                break
            }
            case RN_API.SET_SEL_FILENAME: {
                // alert(data)
                if (data === true) {
                    router.replace("/", "/")
                }
                break
            }
            case RN_API.DELETE_FILE: {
                if (data === true) {
                    alert("삭제되었습니다.")
                    getFileList()
                }
                break
            }

            default: {
                break
            }
        }
    }
    useEffect(() => {
        getFileList()
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
            <Space>
                <Button onClick={() => router.replace("/setting", "/setting")} icon={<i className="xi-angle-left-min"></i>}></Button>
                <Title flex as="h1">
                    파일목록
                </Title>
                <Button
                    onClick={() => {
                        changeFile()
                    }}
                >
                    선택
                </Button>
            </Space>
            {dirpath}
            <FileList>
                {fileList.map((file: any) => {
                    return (
                        <FileList.Item
                            isChecked={file.name === selFile}
                            onClick={() => {
                                setSelFile(file.name === selFile ? null : file.name)
                            }}
                            onTouchStart={(e) => {
                                file.timer = setTimeout(() => {
                                    if (confirm("삭제하시겠습니까?") === false) return
                                    deleteFile(file.name)
                                }, 300)
                            }}
                            onMouseUp={(e) => {
                                if (file.timer !== null) clearTimeout(file.timer)
                            }}
                        >
                            <Title flex as="h2">
                                {file.name}
                            </Title>
                            {file.mTime}
                        </FileList.Item>
                    )
                })}
            </FileList>
        </>
    )
}
export const getStaticProps = async ({ locale }: { locale: string }): Promise<any> => ({
    props: {
        // ...(await serverSideTranslations(locale, ["common"])),
    },
})
export default Page
