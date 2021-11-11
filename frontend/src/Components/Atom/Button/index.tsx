// #region Global Imports
import React, { MouseEventHandler, ReactNode, useContext } from "react"
import Link from "next/link"
import classNames from "classnames"
// #endregion Global Imports

// #region Local Imports
import styles from "./Button.module.scss"
import { ThemeContext } from "styled-components"
// #endregion Local Imports

const ButtonTypes = ["default", "primary", "dashed", "link", "text"] as const
export type ButtonType = typeof ButtonTypes[number]
const ButtonShapes = ["circle", "round"] as const
export type ButtonShape = typeof ButtonShapes[number]
const ButtonHTMLTypes = ["submit", "button", "reset"] as const
export type ButtonHTMLType = typeof ButtonHTMLTypes[number]

interface BaseButtonProps {
    children?: ReactNode
    icon?: React.ReactNode

    type?: ButtonType
    shape?: ButtonShape
    block?: boolean
    fixed?: boolean

    flex?: boolean
    size?: "sm" | "lg"
    show?: boolean
    ghost?: boolean
    danger?: boolean
    loading?: boolean | { delay?: number }

    href?: string
    htmlType?: ButtonHTMLType
    className?: string
    onClick?: MouseEventHandler
}
type AnchorButtonProps = {
    href: string
    target?: string
    onClick?: React.MouseEventHandler<HTMLElement>
} & BaseButtonProps &
    Omit<React.AnchorHTMLAttributes<any>, "type" | "show" | "onClick">

type NativeButtonProps = {
    htmlType?: ButtonHTMLType
    onClick?: React.MouseEventHandler<HTMLElement>
} & BaseButtonProps &
    Omit<React.ButtonHTMLAttributes<any>, "type" | "show" | "onClick">

type ButtonProps = Partial<AnchorButtonProps & NativeButtonProps>

type Loading = number | boolean
const Button = (props: ButtonProps): JSX.Element => {
    const { href, icon, flex, loading = false, show, htmlType = "button", size, type, shape, className, children, block, fixed, ...rest } = props
    const [innerLoading, setLoading] = React.useState<Loading>(!!loading)
    const handleClick = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>) => {
        const { onClick, disabled } = props
        if (innerLoading || disabled) {
            e.preventDefault()
            return
        }
        ;(onClick as React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>)?.(e)
    }
    const iconType = innerLoading ? "loading" : icon
    const { name: theme } = useContext(ThemeContext)
    const prefixCls = theme + "-btn"
    const classes = classNames(
        styles[`${prefixCls}`],
        {
            [styles[`${prefixCls}--hide`]]: show === false,
            [styles[`${prefixCls}--flex`]]: flex,
            [styles[`${prefixCls}--${size}`]]: size,
            [styles[`${prefixCls}--${type}`]]: type,
            [styles[`${prefixCls}--${shape}`]]: shape,
            [styles[`${prefixCls}--icon-only`]]: !children && children !== 0 && !!iconType,
            [styles[`${prefixCls}--loading`]]: innerLoading,
            [styles[`${prefixCls}--block`]]: block,
            [styles[`${prefixCls}--fixed`]]: fixed,
        },
        className,
    )
    return href !== undefined ? (
        <Link href={href}>
            <a {...(rest as AnchorButtonProps)} onClick={handleClick} className={classes}>
                {icon}
                {children}
            </a>
        </Link>
    ) : (
        <button {...(rest as NativeButtonProps)} onClick={handleClick} type={htmlType} className={classes}>
            {icon}
            {children}
        </button>
    )
}

export default Button
