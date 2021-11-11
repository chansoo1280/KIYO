// #region Global Imports
import { Modal, Button } from "@Components"
import { Space } from "@Components/Atom"
// #endregion Global Imports

// #region Local Imports
import styles from "./AlertModal.module.scss"

// #endregion Local Imports

interface Props {
    children?: React.ReactNode
    show?: boolean
    title?: string
    onClick?: () => void
    okText?: string
}

const AlertModal = (props: Props) => {
    const { children, onClick, okText, ...rest } = props
    return (
        <>
            <Modal {...rest}>
                <div className={styles["alert-modal"]}>{children}</div>
                <Space cover padding="4px">
                    <Button type="primary" onClick={onClick} flex>
                        {okText ? okText : "확인"}
                    </Button>
                </Space>
            </Modal>
        </>
    )
}
export default AlertModal
