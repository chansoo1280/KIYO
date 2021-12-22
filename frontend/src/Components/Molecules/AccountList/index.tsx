// #region Global Imports
import React from "react"
import { useDispatch, useSelector } from "react-redux"
import { useRouter } from "next/router"
// #endregion Global Imports

// #region Local Imports
import { Space, AccountCard, Button } from "@Components"
import { Account } from "@Interfaces"
import { WebViewMessage } from "@Services"
import { RN_API } from "@Definitions/MainConsts"
import { AcFileActions, RootState } from "@Reducers"
// #endregion Local Imports
interface Props {
    list: Account[]
    filterText: string
}
const AccountList = (props: Props): JSX.Element => {
    const { list, filterText } = props
    const { acFile } = useSelector(({ acFileReducer }: RootState) => ({
        acFile: acFileReducer,
    }))
    const router = useRouter()
    const dispatch = useDispatch()
    const reqCopyPw = async (account: Account) => {
        const data = await WebViewMessage<typeof RN_API.SET_COPY>(RN_API.SET_COPY, {
            text: account.pw,
        }).catch(() => null)
        if (data === null) return
        const data2 = await WebViewMessage<typeof RN_API.SET_FILE>(RN_API.SET_FILE, {
            list: [
                ...list.filter(({ idx }) => idx !== account.idx),
                {
                    ...account,
                    copiedAt: String(new Date()),
                },
            ],
            pincode: acFile.pincode,
        }).catch(() => null)
        if (data2 === null) return
        if (data2 === false) {
            alert("파일 수정 실패")
            return
        }
        setFile(data2)
    }
    const setFile = (data: Account[]) => {
        const tags = data.reduce((acc: string[], cur) => acc.concat(cur.tags), [])
        dispatch(
            AcFileActions.setInfo({
                list: data,
                tags: Array.from(new Set(tags)),
            }),
        )
    }
    return (
        <Space direction="column" padding="0 16px 36px" gap="22px">
            {!list || list.length === 0 ? (
                filterText === "" ? (
                    <span>아래의 +버튼을 통해 계정을 생성해주세요.</span>
                ) : (
                    <span>검색된 계정 정보가 없습니다!</span>
                )
            ) : (
                list.map((account) => (
                    <AccountCard key={account.idx} account={account}>
                        <Button
                            onClick={() => {
                                reqCopyPw(account)
                            }}
                            icon={
                                <i className="xi-documents">
                                    <span className="ir">copy</span>
                                </i>
                            }
                            type="default"
                        ></Button>
                        <Button
                            onClick={() => {
                                router.push({
                                    pathname: "/modify",
                                    query: {
                                        idx: account.idx,
                                    },
                                })
                            }}
                            icon={
                                <i className="xi-pen">
                                    <span className="ir">modify</span>
                                </i>
                            }
                            type="default"
                        ></Button>
                    </AccountCard>
                ))
            )}
        </Space>
    )
}

export default React.memo(AccountList)
