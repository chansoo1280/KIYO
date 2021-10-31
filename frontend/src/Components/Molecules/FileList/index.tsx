// #region Global Imports
import classNames from "classnames"
import React, { MouseEventHandler, ReactNode, TouchEventHandler } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./FileList.module.scss"
// #endregion Local Imports
interface ListProps {
    children?: ReactNode
}
const InternalFileList = (props: ListProps): JSX.Element => {
    return <ul className={styles["file-list"]} {...props} />
}
interface Props {
    children?: ReactNode
    onClick?: () => void
    onTouchStart?: TouchEventHandler
    onMouseUp?: MouseEventHandler
    isChecked?: boolean
}
const FileListInner = (props: Props): JSX.Element => {
    const { isChecked, ...rest } = props
    const classes = classNames(styles["file-list__item"], {
        [styles["file-list__item--checked"]]: isChecked,
    })
    return <li className={classes} {...rest} />
}
const FileListText = (props: Props): JSX.Element => {
    return <span className={styles["file-list__text"]} {...props} />
}
interface CompoundedComponent extends React.ForwardRefExoticComponent<Props> {
    Item: typeof FileListInner
    Text: typeof FileListText
}
const FileList = InternalFileList as CompoundedComponent

FileList.displayName = "FileList"
FileList.Item = FileListInner
FileList.Text = FileListText
export default FileList
