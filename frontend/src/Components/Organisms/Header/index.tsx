// #region Global Imports
// #endregion Global Imports

// #region Local Imports
import classNames from "classnames"
import { useEffect, useRef, useState } from "react"
import styles from "./Header.module.scss"

// #endregion Local Imports
interface Props {
    prefix?: React.ReactNode
    title?: React.ReactNode
    children?: React.ReactNode
    centerTitle?: boolean
    noMargin?: boolean
}
const Header = (props: Props): JSX.Element => {
    const { prefix, title, centerTitle, noMargin, children } = props
    const [ScrollToTop, setScrollToTop] = useState(0)
    const [isScrollToTop, setIsScrollToTop] = useState(false)
    const refContainer = useRef(null)
    let scrollTop = 0
    useEffect(() => {
        if (refContainer !== null) {
            const ref = refContainer.current as unknown as HTMLElement
            const wrapEl = ref.parentElement as HTMLElement
            wrapEl.addEventListener("scroll", (e) => {
                setIsScrollToTop(wrapEl.scrollTop - scrollTop < 0)
                scrollTop = wrapEl.scrollTop
                setScrollToTop(wrapEl.scrollTop)
            })
        }
    }, [])
    return (
        <header
            ref={refContainer}
            className={classNames({
                [styles["header"]]: true,
                [styles["header--hide"]]: 100 < ScrollToTop && isScrollToTop === false,
                [styles["header--no-margin"]]: noMargin,
            })}
        >
            {prefix && <div className={classNames(styles["header__prefix"])}>{prefix}</div>}

            <h1
                className={classNames(styles["header__title"], {
                    [styles["header__title--center"]]: centerTitle,
                })}
            >
                {title}
            </h1>
            {children}
        </header>
    )
}
export default Header
