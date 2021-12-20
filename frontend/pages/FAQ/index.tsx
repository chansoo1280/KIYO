// #region Global Imports
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
// #endregion Global Imports

// #region Local Imports
import { Title, Header, Space, Button, SettingList, ConfirmModal, Input, AlertModal } from "@Components"
import { useState } from "react"
// #endregion Local Imports

const Page = (): JSX.Element => {
    const { t, i18n } = useTranslation("common")
    const router = useRouter()

    const [modalAnswer, setModalAnswer] = useState({
        show: false,
        title: "",
        contents: "",
    })

    return (
        <>
            <Header prefix={<Button onClick={() => router.back()} icon={<i className="xi-angle-left-min"></i>}></Button>} title="FAQ(자주 묻는 질문)" centerTitle></Header>
            <SettingList>
                <SettingList.Item
                    onClick={() => {
                        setModalAnswer({
                            show: true,
                            title: "보안성이 의심됩니다.",
                            contents:
                                "이 앱은 데이터를 외부에 노출하는 어떤 코드도 없으며 모든 소스코드는 [https://github.com/chansoo1280/KIYO]에 공개되어있습니다. 또한 데이터는 핀번호를 통해 암호화하여 저장하기 때문에 해당 파일과 핀번호가 없으면 누구도 데이터에 접근할 수 없으니 안심하셔도 좋습니다.",
                        })
                    }}
                >
                    <Title as="h3">보안성이 의심됩니다.</Title>
                </SettingList.Item>
                <SettingList.Item
                    onClick={() => {
                        setModalAnswer({
                            show: true,
                            title: "사이트 추천목록을 수정하고 싶습니다.",
                            contents: "이메일(chansoo1280@naver.com)로 추가하실 사이트명과 링크를 보내주시면 검사 후 추가하도록 하겠습니다.",
                        })
                    }}
                >
                    <Title as="h3">사이트 추천목록을 수정하고 싶습니다.</Title>
                </SettingList.Item>
                <SettingList.Item
                    onClick={() => {
                        setModalAnswer({
                            show: true,
                            title: "파일 또는 핀번호를 잊어버렸습니다.",
                            contents: "복구할 수 없습니다. 그만큼 보안성이 철저하다고 생각해주시면 감사하겠습니다.",
                        })
                    }}
                >
                    <Title as="h3">파일 또는 핀번호를 잊어버렸습니다.</Title>
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
            <AlertModal
                title={modalAnswer.title}
                show={modalAnswer.show}
                onClick={() => {
                    setModalAnswer((prevState) => ({
                        ...prevState,
                        show: false,
                    }))
                }}
            >
                {modalAnswer.contents}
            </AlertModal>
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
