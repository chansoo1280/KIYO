// #region Global Imports
import React, { ReactNode, useContext } from "react"
import { ThemeContext } from "styled-components"
// #endregion Global Imports

// #region Local Imports
import styles from "./SettingList.module.scss"
// #endregion Local Imports
interface Props {
    children?: ReactNode
}
const InternalSettingList = (props: Props): JSX.Element => {
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-setting-list"
    return <ul className={styles[prefixCls]} {...props} />
}
interface Props {
    children?: ReactNode
    onClick?: () => void
}
const SettingListInner = (props: Props): JSX.Element => {
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-setting-list"
    return <li className={styles[`${prefixCls}__item`]} {...props} />
}
const SettingListText = (props: Props): JSX.Element => {
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-setting-list"
    return <span className={styles[`${prefixCls}__text`]} {...props} />
}
const SettingListTitle = (props: { as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; children: ReactNode }): JSX.Element => {
    const { children, as } = props
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-setting-list"
    const TitleNode = `${as}` as keyof JSX.IntrinsicElements
    return <TitleNode className={styles[`${prefixCls}__title`]}>{children}</TitleNode>
}
interface CompoundedComponent extends React.ForwardRefExoticComponent<Props> {
    Item: typeof SettingListInner
    Text: typeof SettingListText
    Title: typeof SettingListTitle
}
const SettingList = InternalSettingList as CompoundedComponent

SettingList.displayName = "SettingList"
SettingList.Item = SettingListInner
SettingList.Text = SettingListText
SettingList.Title = SettingListTitle
export default SettingList
