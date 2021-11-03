// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { Header, Title, Space, Button, FileList } from "@Components"
import { RootState } from "@Redux"
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
                    filepath: selFile,
                },
            }),
        )
    }
    const deleteFile = (filepath: string) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.DELETE_FILE,
                data: {
                    filepath,
                },
            }),
        )
    }

    const listener = (event: any) => {
        const { data, type } = JSON.parse(event.data)
        switch (type) {
            case RN_API.GET_FILE_LIST: {
                // alert(data + "/" + typeof data)
                const dirpathList = data.dirpath.split("%3A")
                setDirpath("/" + ((dirpathList && dirpathList[dirpathList.length - 1]) || "") + "/")
                setFileList(
                    (data.list &&
                        data.list
                            .map((file: any) => {
                                const fileList = decodeURI(file).split("%2F")
                                return {
                                    filepath: file,
                                    name: (fileList && fileList[fileList.length - 1]) || "",
                                    timer: null,
                                    isAction: false,
                                }
                            })
                            .filter((file: any) => file.name.slice(-4, file.name.length) === ".txt")) ||
                        [],
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
            <Header
                title={
                    <>
                        <Button onClick={() => router.back()} icon={<i className="xi-angle-left-min"></i>}></Button>
                        <span>파일목록</span>
                    </>
                }
            >
                <Button
                    onClick={() => {
                        changeFile()
                    }}
                    icon={
                        <i className="xi-log-in">
                            <span className="ir">선택</span>
                        </i>
                    }
                ></Button>
            </Header>
            <Space>
                아래 경로로 .txt 파일을 옮겨주세요. <br />
                {dirpath}
            </Space>
            <FileList>
                {fileList.map((file: any) => {
                    return (
                        <FileList.Item
                            isChecked={file.filepath === selFile}
                            onClick={() => {
                                setSelFile(file.filepath === selFile ? null : file.filepath)
                            }}
                            onTouchStart={(e) => {
                                file.timer = setTimeout(() => {
                                    if (confirm("삭제하시겠습니까?") === false) return
                                    deleteFile(file.filepath)
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
            <Button
                onClick={() => {
                    router.push("/create", "/create")
                }}
                type="primary"
            >
                새로 만들기
            </Button>
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
