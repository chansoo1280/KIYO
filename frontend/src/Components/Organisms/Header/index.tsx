// #region Global Imports
// #endregion Global Imports

// #region Local Imports
import classNames from "classnames"
import { useEffect, useRef, useState } from "react"
import styles from "./Header.module.scss"

// #endregion Local Imports
interface Props {
    title?: string
    children?: React.ReactNode
    centerTitle?: boolean
}
const Header = (props: Props): JSX.Element => {
    const { title, children } = props
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
            })}
        >
            <h1 className={styles["header__title"]}>{title}</h1>
            {children}
        </header>
    )
}
export default Header
