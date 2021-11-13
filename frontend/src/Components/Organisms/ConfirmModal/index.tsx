// #region Global Imports
import { Modal, Button } from "@Components"
import { Space } from "@Components/Atom"
// #endregion Global Imports

// #region Local Imports
import styles from "./ConfirmModal.module.scss"

// #endregion Local Imports

interface Props {
    children?: React.ReactNode
    show?: boolean
    title?: string
    onClickOk?: () => void
    onClickCancel?: () => void
}

const ConfirmModal = (props: Props) => {
    const { children, onClickOk, onClickCancel, ...rest } = props
    return (
        <>
            <Modal {...rest}>
                <div className={styles["confirm-modal"]}>{children}</div>
                <Space cover className={styles["confirm-modal__btns"]} gap="4px">
                    <Button className={styles["confirm-modal__btn"]} type="default" flex onClick={onClickCancel}>
                        취소
                    </Button>
                    <Button className={styles["confirm-modal__btn"]} type="primary" flex onClick={onClickOk}>
                        확인
                    </Button>
                </Space>
            </Modal>
        </>
    )
}
export default ConfirmModal
