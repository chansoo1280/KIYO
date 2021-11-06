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
    gap?: string
}

const InternalTag = (props: Props): JSX.Element => {
    const { gap, children } = props
    return (
        <ul style={{ gap }} className={styles["tag"]}>
            {children}
        </ul>
    )
}
interface InnerProps {
    onClick?: MouseEventHandler<HTMLLIElement>
    onDelete?: () => void
    children?: ReactNode
    isSelected?: boolean
}
const TagInner = (props: InnerProps): JSX.Element => {
    const { children, onClick, onDelete, isSelected } = props
    const classes = className({
        [styles["tag__btn"]]: true,
        [styles["tag__btn--delete"]]: onDelete,
        [styles["tag__btn--selected"]]: isSelected,
    })
    return (
        <li className={classes} onClick={onClick}>
            {children}
            {onDelete ? (
                <Button
                    onClick={onDelete}
                    icon={
                        <i className="xi-close-min">
                            <span className="ir">설정</span>
                        </i>
                    }
                ></Button>
            ) : (
                ""
            )}
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
