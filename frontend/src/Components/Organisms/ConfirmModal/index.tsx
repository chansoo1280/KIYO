// #region Global Imports
import { Modal, Button } from "@Components"
import { Space } from "@Components/Atom"
import React from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./ConfirmModal.module.scss"

// #endregion Local Imports

interface Props {
    children?: React.ReactNode
    show?: boolean
    title?: string
    okButtonProps?: any
    cancelButtonProps?: any
}

const ConfirmModal = (props: Props): JSX.Element => {
    const { children, okButtonProps, cancelButtonProps, ...rest } = props
    return (
        <>
            <Modal {...rest}>
                <div className={styles["confirm-modal"]}>{children}</div>
                <Space cover className={styles["confirm-modal__btns"]} gap="4px">
                    <Button className={styles["confirm-modal__btn"]} type="default" flex children="취소" {...cancelButtonProps}></Button>
                    <Button className={styles["confirm-modal__btn"]} type="primary" flex children="확인" {...okButtonProps}></Button>
                </Space>
            </Modal>
        </>
    )
}
export default ConfirmModal
