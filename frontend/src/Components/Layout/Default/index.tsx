// #region Global Imports
import Head from "next/head"
// #endregion Global Imports

// #region Local Imports
import { LayoutProps } from "@Components"
import styles from "./Default.module.scss"
import classNames from "classnames"
// #endregion Local Imports

export const Default = ({ children }: LayoutProps): JSX.Element => {
    return (
        <>
            <Head>
                <title>내가 기억할개</title>
                <meta name="description" content="" />
                <link rel="icon" href="/favicon.ico" />
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xeicon@2.3.3/xeicon.min.css"></link>
            </Head>
            <div
                className={classNames("l_wrap", {
                    [styles["default-wrap"]]: true,
                })}
            >
                {children}
            </div>
        </>
    )
}
