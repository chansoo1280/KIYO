// #region Global Imports
import React, { MouseEventHandler, ReactNode } from "react"
import className from "classnames"
import { Button } from "@Components"
// #endregion Global Imports

// #region Local Imports
import styles from "./Tag.module.scss"
// #endregion Local Imports
interface Props {
    children?: React.ReactNode
}

const InternalTag = (props: Props): JSX.Element => {
    const { children } = props
    return <ul className={styles["tag"]}>{children}</ul>
}
interface InnerProps {
    onClick?: MouseEventHandler<HTMLLIElement>
    children?: ReactNode
}
const TagInner = (props: InnerProps): JSX.Element => {
    const { children, onClick } = props
    const classes = className({
        [styles["tag__btn"]]: true,
    })
    return (
        <li className={classes} onClick={onClick}>
            {children}
        </li>
    )
}
interface CompoundedComponent extends React.ForwardRefExoticComponent<Props> {
    Item: typeof TagInner
}
const Tag = InternalTag as CompoundedComponent

Tag.displayName = "Tag"
Tag.Item = TagInner

export default Tag
