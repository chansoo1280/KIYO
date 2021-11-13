// #region Global Imports
import Head from "next/head"
// #endregion Global Imports

// #region Local Imports
import { LayoutProps } from "@Components"
import styles from "./Default.module.scss"
import classNames from "classnames"
import { ForwardedRef, forwardRef, useContext } from "react"
import { ThemeContext } from "styled-components"
// #endregion Local Imports

export const Default = forwardRef(({ children }: LayoutProps, ref: ForwardedRef<HTMLDivElement>): JSX.Element => {
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-wrap"
    return (
        <>
            <Head>
                <title>내가 기억할개</title>
                <meta name="description" content="" />
                <link rel="icon" href="/favicon.ico" />
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xeicon@2.3.3/xeicon.min.css"></link>
            </Head>
            <div ref={ref} id="wrap" className={classNames(prefixCls, styles["default-wrap"])}>
                {children}
            </div>
        </>
    )
})
