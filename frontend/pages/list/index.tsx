// #region Global Imports
import { useEffect } from "react"
// #endregion Global Imports

// #region Local Imports
import { Title, Space, Button, AccountCard } from "@Components"
import { RootState, AcActions } from "@Redux"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useRouter } from "next/router"
import { Account } from "@Interfaces"
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
    const createAccount = ({ address, id, pw }: Pick<Account, "address" | "id" | "pw">) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_FILE,
                data: {
                    contents: [...ac.list, { address, id, pw, modifiedAt: new Date(), createdAt: new Date() }],
                    pincode: ac.pincode,
                },
            }),
        )
    }
    const modifyAccount = (account: Account) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        const newList = ac.list.filter((acInfo) => {
            return acInfo.address !== account.address || acInfo.id !== account.id
        })
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_FILE,
                data: {
                    contents: [...newList, { ...account, modifiedAt: new Date() }],
                    pincode: ac.pincode,
                },
            }),
        )
    }
    const deleteAccount = ({ address, id }: Account) => {
        if (!window.ReactNativeWebView) {
            alert("ReactNativeWebView 객체가 없습니다.")
            return
        }
        const newList = ac.list.filter((account) => {
            return account.address !== address || account.id !== id
        })
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: RN_API.SET_FILE,
                data: {
                    contents: newList,
                    pincode: ac.pincode,
                },
            }),
        )
    }

    const listener = (event: any) => {
        const { data, type } = JSON.parse(event.data)
        switch (type) {
            case RN_API.SET_FILE: {
                // alert(data + "/" + typeof data)
                if (data === false) {
                    alert("파일 수정 실패")
                    return
                }
                dispatch(
                    AcActions.setInfo({
                        list: data,
                    }),
                )
                break
            }
            case RN_API.SET_COPY: {
                if (data === false) {
                    alert("복사 실패")
                    return
                }
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
            <Space>
                <Title flex as="h2">
                    계정 목록
                </Title>
                <Button
                    href="/setting"
                    icon={
                        <i className="xi-cog">
                            <span className="ir">설정</span>
                        </i>
                    }
                ></Button>
            </Space>
            {!ac.list || ac.list.length === 0 ? (
                <span>계정이 없습니다!</span>
            ) : (
                ac.list.map((account) => {
                    return (
                        <AccountCard
                            account={account}
                            onClickDel={(e) => {
                                e.stopPropagation()
                                if (confirm("삭제하시겠습니까?") === false) {
                                    return
                                }
                                deleteAccount(account)
                            }}
                            onClickMod={(newAccount) => {
                                modifyAccount(newAccount)
                            }}
                        ></AccountCard>
                    )
                })
            )}
            <Button
                onClick={() => {
                    const address = prompt("address 입력")
                    if (address === null) return
                    const id = prompt("id 입력")
                    if (id === null) return
                    const pw = prompt("pw 입력")
                    if (pw === null) return
                    createAccount({ address, id, pw })
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
    },
})
export default Page
