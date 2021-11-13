// #region Global Imports
import { Title } from "@Components/Atom"
import React, { useContext } from "react"
import className from "classnames"
// #endregion Global Imports

// #region Local Imports
import styles from "./Modal.module.scss"
import { ThemeContext } from "styled-components"
// #endregion Local Imports
interface Props {
    children?: React.ReactNode
    show?: boolean
    title?: string
}

const Modal = (props: Props): JSX.Element => {
    const { show, title, children } = props
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-modal"
    return (
        <section
            className={className(styles[prefixCls], {
                [styles[`${prefixCls}--show`]]: show,
            })}
        >
            <div
                className={className(styles[`${prefixCls}__box`], {
                    [styles[`${prefixCls}--show__box`]]: show,
                })}
            >
                {title && (
                    <header className={styles[`${prefixCls}__header`]}>
                        <Title as="h1">{title}</Title>
                    </header>
                )}
                {children}
            </div>
        </section>
    )
}
export default Modal
