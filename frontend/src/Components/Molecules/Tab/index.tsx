// #region Global Imports
import React, { MouseEventHandler } from "react"
import className from "classnames"
// #endregion Global Imports

// #region Local Imports
import styles from "./Tab.module.scss"
// #endregion Local Imports
interface Props {
    children?: React.ReactNode
}

const InternalTab = (props: Props): JSX.Element => {
    const { children } = props
    return <ul className={styles["tab"]}>{children}</ul>
}
interface InnerProps {
    onClick?: MouseEventHandler<HTMLButtonElement>
    name?: string
    isSelected?: boolean
    isStar?: boolean
}
const TabInner = (props: InnerProps): JSX.Element => {
    const { isStar, name, onClick, isSelected } = props
    const classes = className({
        [styles["tab__btn"]]: true,
        [styles["tab__btn--active"]]: isSelected,
        [styles["tab__btn--icon"]]: isStar,
    })
    if (isStar) {
        return (
            <li>
                <button className={classes} onClick={onClick}>
                    {isSelected ? <img src="/static/images/icon_favorite-menu.svg" alt={name} /> : <img src="/static/images/icon_favorite-menu.svg" alt={name} />}
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
    Item: typeof TabInner
}
const Tab = InternalTab as CompoundedComponent

Tab.displayName = "Tab"
Tab.Item = TabInner

export default Tab
