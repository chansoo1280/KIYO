// #region Global Imports
import React, { MouseEventHandler } from "react"
import className from "classnames"
// #endregion Global Imports

// #region Local Imports
import styles from "./SlideTab.module.scss"
// #endregion Local Imports
interface Props {
    children?: React.ReactNode
}

const InternalSlideTab = (props: Props): JSX.Element => {
    const { children } = props
    return <ul className={styles["slide-tab"]}>{children}</ul>
}
interface InnerProps {
    onClick?: MouseEventHandler<HTMLButtonElement>
    name?: string
    isSelected?: boolean
    isStar?: boolean
}
const SlideTabInner = (props: InnerProps): JSX.Element => {
    const { isStar, name, onClick, isSelected } = props
    const classes = className({
        [styles["slide-tab__btn"]]: true,
        [styles["slide-tab__btn--active"]]: isSelected,
        [styles["slide-tab__btn--icon"]]: isStar,
    })
    if (isStar) {
        return (
            <li>
                <button className={classes} onClick={onClick}>
                    {isSelected ? <img src="/static/images/icon_favorite-menu_active.svg" alt={name} /> : <img src="/static/images/icon_favorite-menu.svg" alt={name} />}
                </button>
            </li>
        )
    }
    return (
        <li>
            <button className={classes} onClick={onClick}>
                {name}
            </button>
        </li>
    )
}
interface CompoundedComponent extends React.ForwardRefExoticComponent<Props> {
    Item: typeof SlideTabInner
}
const SlideTab = InternalSlideTab as CompoundedComponent

SlideTab.displayName = "SlideTab"
SlideTab.Item = SlideTabInner

export default SlideTab
