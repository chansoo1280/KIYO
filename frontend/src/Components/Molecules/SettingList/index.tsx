// #region Global Imports
import React, { ReactNode } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./SettingList.module.scss"
// #endregion Local Imports
interface Props {
    children?: ReactNode
}
const InternalSettingList = (props: Props): JSX.Element => {
    return <ul className={styles["setting-list"]} {...props} />
}
interface Props {
    children?: ReactNode
    onClick?: () => void
}
const SettingListInner = (props: Props): JSX.Element => {
    return <li className={styles["setting-list__item"]} {...props} />
}
const SettingListText = (props: Props): JSX.Element => {
    return <span className={styles["setting-list__text"]} {...props} />
}
interface CompoundedComponent extends React.ForwardRefExoticComponent<Props> {
    Item: typeof SettingListInner
    Text: typeof SettingListText
}
const SettingList = InternalSettingList as CompoundedComponent

SettingList.displayName = "SettingList"
SettingList.Item = SettingListInner
SettingList.Text = SettingListText
export default SettingList
