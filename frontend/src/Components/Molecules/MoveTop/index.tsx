// #region Global Imports
import { ForwardedRef, MutableRefObject, ReactNode, RefObject, useContext } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./MoveTop.module.scss"
import { Button } from "@Components"
import { useTranslation } from "next-i18next"
import { ThemeContext } from "styled-components"
import classnames from "classnames"

// #endregion Local Imports
interface Props {
    children?: ReactNode
    layoutRef: ForwardedRef<HTMLDivElement>
}
const MoveTop = (props: Props): JSX.Element => {
    const { layoutRef } = props
    const { t } = useTranslation("common")
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-move-top"
    return (
        <div
            className={classnames(styles[prefixCls], {
                [styles[`${prefixCls}--hide`]]: typeof layoutRef !== "function" && layoutRef?.current?.scrollTop !== 0,
            })}
        >
            <Button
                size="sm"
                shape="circle"
                onClick={() => {
                    if (typeof layoutRef === "function") {
                        return
                    }
                    layoutRef?.current?.scrollTo(0, 0)
                }}
                icon={
                    <i className="xi-angle-up-min">
                        <span className="ir">맨위로</span>
                    </i>
                }
            ></Button>
        </div>
    )
}
export default MoveTop
